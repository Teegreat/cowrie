// the only file that imports Prisma types directly.

import { Injectable } from '@nestjs/common';
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
      const existingAccounts = await tx.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true },
      });

      if (existingAccounts.length != accountIds.length) {
        const foundIds = new Set(existingAccounts.map((a) => a.id));
        const missing = accountIds.filter((id) => !foundIds.has(id));
        throw new DomainException(
          `Account(s) not found: ${missing.join(', ')}`,
        );
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
