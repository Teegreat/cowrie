# Chapter 15 — ACID Transactions

## Learning Objectives

- Define Atomicity, Consistency, Isolation, and Durability, each tied to
  something already built rather than left abstract.
- Reproduce and fix a real bug: `saveTransaction` currently returns a
  raw 500 if a posting references a non-existent account.
- Use an explicit Prisma interactive transaction (`$transaction(async
  (tx) => {...})`) to make a check-then-write sequence atomic.

## Key Concepts

**ACID, tied to what's already built**
- Atomicity — proved by hand in Ch. 12's `ROLLBACK`; `saveTransaction`'s
  nested `create` already gets this for free (confirmed directly
  against this project's bundled Prisma docs: nested writes are
  automatically transactional).
- Consistency — Ch. 12's constraints (`CHECK`, `FOREIGN KEY`) plus
  Ch. 4/5's domain invariants (`LedgerTransaction.balanced()`) acting
  together; a transaction violating either is rejected entirely.
- Isolation — concurrent transactions don't see each other's
  uncommitted changes. Postgres defaults to `READ COMMITTED`. Whether
  that's strong enough for specific race conditions (e.g. two
  simultaneous withdrawals) is Ch. 16's problem, not solved here.
- Durability — committed data survives a crash, via Postgres's WAL;
  nothing configured at this stage.

**The bug**
- Posting a transaction with a nonexistent `accountId` fails inside the
  nested `create` with a raw Postgres foreign-key violation — not a
  `DomainException` — so `DomainExceptionFilter` never catches it and
  it falls through to a generic 500. Nothing verified the account
  existed before attempting the write.

**The fix: interactive transaction**
- `saveTransaction` rewritten to check account existence and perform the
  nested create inside one `prisma.$transaction(async (tx) => {...})`,
  both operating on the transaction-scoped `tx` client.
- Throwing inside the callback (a `DomainException` for missing
  accounts) triggers an automatic rollback and re-throw — nothing is
  written, and the error now reaches `DomainExceptionFilter` correctly.

## File Changes

`src/ledger/infrastructure/persistence/prisma-ledger.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LedgerRepository } from '../../application/ports/ledger-repository.port';
import { LedgerTransaction } from '../../domain/ledger-transaction';
import { DomainException } from '../../../shared-kernel/domain-exception';

@Injectable()
export class PrismaLedgerRepository extends LedgerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createAccount(input: { name: string; accountType: 'ASSET' | 'LIABILITY' }): Promise<string> {
    const account = await this.prisma.account.create({ data: input });
    return account.id;
  }

  async saveTransaction(transaction: LedgerTransaction): Promise<string> {
    const accountIds = [...new Set(transaction.postings.map((p) => p.accountId))];

    // Everything inside `tx` is one atomic unit. Throwing here rolls
    // back automatically — nothing is written if any referenced
    // account doesn't exist.
    return this.prisma.$transaction(async (tx) => {
      const existingAccounts = await tx.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true },
      });

      if (existingAccounts.length !== accountIds.length) {
        const foundIds = new Set(existingAccounts.map((a) => a.id));
        const missing = accountIds.filter((id) => !foundIds.has(id));
        throw new DomainException(`Account(s) not found: ${missing.join(', ')}`);
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

- `POST /ledger/transactions` — a posting referencing a nonexistent
  account now returns a clean `DomainException`-shaped 400
  (`Account(s) not found: ...`) instead of a raw 500.

## Business Rules

- Any operation combining a validation read and a write that must
  succeed or fail together runs inside a single
  `prisma.$transaction(async (tx) => {...})`, using the `tx` client for
  every step — never a mix of `tx` and the top-level `prisma` client.
- A thrown exception inside an interactive transaction must be a typed
  domain exception, never a bare `Error`, so it's translated correctly
  by `DomainExceptionFilter`.

## Definition of Done

- [ ] Reproduced the bug: a bad `accountId` returns a raw 500.
- [ ] `saveTransaction` rewritten with an explicit `prisma.$transaction()`,
      verifying account existence before writing.
- [ ] Bad reference now returns a clean `DomainException`-shaped 400.
- [ ] Valid balanced transaction still succeeds unchanged.

## Common Interview Questions

- Define each of the four ACID properties in your own words.
- Why is Prisma's nested `create` already atomic, and when do you need
  an explicit `$transaction` instead?
- What happens if code inside a Prisma interactive transaction throws?
- Why is a raw foreign-key violation reaching the client a problem, and
  how do you prevent it?

## Further Reading (optional)

- This project's bundled Prisma reference:
  `cowrie/.agents/skills/prisma-client-api/references/transactions.md`.
- PostgreSQL documentation: transaction isolation levels, write-ahead
  logging (WAL).
