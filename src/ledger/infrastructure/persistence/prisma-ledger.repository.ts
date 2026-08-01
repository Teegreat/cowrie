// the only file that imports Prisma types directly.

import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class PrismaLedgerRepository extends LedgerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createAccount(input: {
    name: string;
    accountType: 'ASSET' | 'LIABILITY';
    currency: string;
  }): Promise<string> {
    const account = await this.prisma.account.create({ data: input });
    return account.id;
  }

  async saveTransaction(transaction: LedgerTransaction): Promise<string> {
    const accountIds = [
      ...new Set(transaction.postings.map((p) => p.accountId)),
    ];

    // An interactive transaction: everything inside `tx` is one atomic
    // unit. Throwing here rolls back automatically — nothing gets
    // written if any referenced account doesn't exist.
    return this.prisma.$transaction(async (tx) => {
      // FOR UPDATE locks these rows for the rest of this transaction.
      // We don't need their data — this is a mutex: any other
      // transaction trying to lock the same accounts must wait until
      // we commit or roll back.
      const lockedAccounts = await tx.$queryRaw<
        { id: string; accountType: string; currency: string }[]
      >`SELECT id, "accountType", "currency" FROM "Account" WHERE id IN (${Prisma.join(accountIds)}) FOR UPDATE`;

      if (lockedAccounts.length !== accountIds.length) {
        const foundIds = new Set(lockedAccounts.map((a) => a.id));
        const missing = accountIds.filter((id) => !foundIds.has(id));
        throw new DomainException(
          `Account(s) not found: ${missing.join(', ')}`,
        );
      }

      const accountTypeById = new Map(
        lockedAccounts.map((a) => [a.id, a.accountType]),
      );

      const currencyById = new Map(
        lockedAccounts.map((a) => [a.id, a.currency]),
      );

      // Only debits against a LIABILITY account (money leaving a
      // customer's wallet) can overdraw — a debit against an ASSET
      // account is a different concern (pool solvency), not handled
      // here.
      for (const posting of transaction.postings) {
        // Accounts are single-currency by design — mixing currencies on
        // one account would make its balance meaningless (summing NGN
        // kobo with USD cents as if fungible). Checked for every posting,
        // regardless of account type or direction.
        const accountCurrency = currencyById.get(posting.accountId);
        if (posting.money.currencyCode !== accountCurrency) {
          throw new DomainException(
            `Posting currency ${posting.money.currencyCode} does not match account ${posting.accountId}'s currency ${accountCurrency}`,
          );
        }
        if (
          accountTypeById.get(posting.accountId) === 'LIABILITY' &&
          posting.direction === 'DEBIT'
        ) {
          const sums = await tx.posting.groupBy({
            by: ['direction'],
            where: {
              accountId: posting.accountId,
              currency: posting.money.currencyCode,
            },
            _sum: { minorUnits: true },
          });
          const credits =
            sums.find((s) => s.direction === 'CREDIT')?._sum.minorUnits ?? 0n;
          const debits =
            sums.find((s) => s.direction === 'DEBIT')?._sum.minorUnits ?? 0n;
          const currentBalance = credits - debits; // liability: credit increases, debit decreases

          // No more BigInt(...) wrapping — minorUnitsValue is bigint now,
          // matching the column, with no conversion at this boundary at all.
          if (currentBalance < posting.money.minorUnitsValue) {
            throw new DomainException(
              `Insufficient balance on account ${posting.accountId}`,
            );
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
