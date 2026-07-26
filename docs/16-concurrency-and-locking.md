# Chapter 16 — Concurrency & Locking

## Learning Objectives

- Understand the classic double-spend race condition: two concurrent
  requests both reading a stale balance before either writes.
- Add a minimal "insufficient balance" rule as the motivating example
  for locking.
- Use `SELECT ... FOR UPDATE` as a mutex (not for its data) to make the
  balance check race-free.
- Understand why pessimistic locking fits a derived-balance
  architecture better than optimistic locking.
- Resolve Ch. 5's open question: neither `Account` nor `Transaction`
  alone stops an overdraft — the repository does, because it requires a
  database read against persisted state.

## Key Concepts

**The race condition**
- Two concurrent withdrawal requests both read the same starting
  balance (via Ch. 14's `groupBy` sum) before either has written
  anything. Both pass their individual sufficiency check, both proceed,
  and the account is overdrawn — the bug isn't in the math, it's that
  neither request knew about the other's in-flight write.

**Row lock as mutex**
- `SELECT ... FOR UPDATE` locks the selected rows for the rest of the
  transaction; any other transaction trying to lock the same rows must
  wait. Used here purely for mutual exclusion — the account row's data
  isn't needed, only the guarantee that no concurrent transaction can be
  mid-flight against the same account.

**Pessimistic vs. optimistic locking**
- Pessimistic (used here): lock first, then act — fits when conflict is
  likely enough to prevent upfront.
- Optimistic: read a version, write conditionally
  (`WHERE id = ? AND version = ?`), retry on conflict — requires a
  stored mutable value to version, which we deliberately don't have
  (balance is derived, Ch. 4).
- Pessimistic locking on the account row is the architecturally correct
  fit here, not just a default choice.

**Where the check lives**
- The insufficient-balance check lives in `PrismaLedgerRepository`
  (infrastructure), not in `LedgerTransaction` or an `Account` domain
  aggregate — because it requires reading already-persisted state,
  which a pure in-memory aggregate can't do. This resolves Ch. 5's open
  question: neither aggregate alone is responsible; the repository is,
  by architectural necessity.

**A known simplification**
- `minorUnits` is `BigInt` in Postgres/Prisma but a plain `number` inside
  `Money` (Ch. 7) — safe below `Number.MAX_SAFE_INTEGER`, revisited
  properly in Ch. 24 (Money Precision).

## File Changes

`src/ledger/infrastructure/persistence/prisma-ledger.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { Prisma } from '../../../../generated/prisma/client';

@Injectable()
export class PrismaLedgerRepository extends LedgerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createAccount(input: {
    name: string;
    accountType: 'ASSET' | 'LIABILITY';
  }): Promise<string> {
    const account = await this.prisma.account.create({ data: input });
    return account.id;
  }

  async saveTransaction(transaction: LedgerTransaction): Promise<string> {
    const accountIds = [...new Set(transaction.postings.map((p) => p.accountId))];

    return this.prisma.$transaction(async (tx) => {
      // FOR UPDATE locks these rows for the rest of this transaction.
      // We don't need their data — this is a mutex: any other
      // transaction trying to lock the same accounts must wait until
      // we commit or roll back.
      const lockedAccounts = await tx.$queryRaw<{ id: string; accountType: string }[]>`
        SELECT id, "accountType" FROM "Account" WHERE id IN (${Prisma.join(accountIds)}) FOR UPDATE
      `;

      if (lockedAccounts.length !== accountIds.length) {
        const foundIds = new Set(lockedAccounts.map((a) => a.id));
        const missing = accountIds.filter((id) => !foundIds.has(id));
        throw new DomainException(`Account(s) not found: ${missing.join(', ')}`);
      }

      const accountTypeById = new Map(lockedAccounts.map((a) => [a.id, a.accountType]));

      // Only debits against a LIABILITY account (money leaving a
      // customer's wallet) can overdraw — a debit against an ASSET
      // account is a different concern (pool solvency), not handled
      // here.
      for (const posting of transaction.postings) {
        if (accountTypeById.get(posting.accountId) === 'LIABILITY' && posting.direction === 'DEBIT') {
          const sums = await tx.posting.groupBy({
            by: ['direction'],
            where: { accountId: posting.accountId },
            _sum: { minorUnits: true },
          });
          const credits = sums.find((s) => s.direction === 'CREDIT')?._sum.minorUnits ?? 0n;
          const debits = sums.find((s) => s.direction === 'DEBIT')?._sum.minorUnits ?? 0n;
          const currentBalance = credits - debits; // liability: credit increases, debit decreases

          if (currentBalance < BigInt(posting.money.minorUnitsValue)) {
            throw new DomainException(`Insufficient balance on account ${posting.accountId}`);
          }
        }
      }

      const created = await tx.ledgerTransaction.create({
        data: {
          postings: {
            create: transaction.postings.map((posting) => ({
              accountId: posting.accountId,
              minorUnits: posting.money.minorUnitsValue,
              currency: posting.money.currencyCode,
              direction: posting.direction,
            })),
          },
        },
      });

      return created.id;
    });
  }
}
```

## APIs Affected

- `POST /ledger/transactions` — a debit against a `LIABILITY` account
  that would take its balance negative is now rejected with a clean
  `DomainException` (`Insufficient balance on account ...`), and this
  check is race-free under concurrent requests against the same account.

## Business Rules

- Any operation checking balance sufficiency must lock the relevant
  account row(s) via `FOR UPDATE` inside the same transaction as the
  check and the write — never check and write as separate,
  unsynchronized steps.
- A debit against a `LIABILITY` account must never be permitted if it
  would take that account's derived balance below zero.

## Definition of Done

- [ ] `saveTransaction` locks referenced accounts via `FOR UPDATE`
      before checking balance.
- [ ] A debit that would overdraw a `LIABILITY` account is rejected
      with a clean `DomainException`.
- [ ] Sequential test: fund ₦10,000, a ₦12,000 withdrawal fails, a
      ₦7,000 withdrawal succeeds.
- [ ] Concurrent test: two simultaneous ₦7,000 withdrawals against a
      ₦10,000 balance — exactly one succeeds.

## Common Interview Questions

- Walk through how two concurrent withdrawal requests could overdraw an
  account without locking.
- What does `SELECT ... FOR UPDATE` actually do, and why might you use
  it without needing the row's data?
- What's the difference between pessimistic and optimistic locking, and
  when would you choose each?
- Why does the insufficient-balance check belong in the repository
  rather than in `LedgerTransaction` or an `Account` aggregate?

## Further Reading (optional)

- PostgreSQL documentation: explicit row locking (`SELECT ... FOR
  UPDATE`), `SERIALIZABLE` isolation as an alternative approach.
- This project's bundled Prisma reference:
  `cowrie/.agents/skills/prisma-client-api/references/raw-queries.md`.
