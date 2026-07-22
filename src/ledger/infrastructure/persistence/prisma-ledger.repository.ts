// the only file that imports Prisma types directly.

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';

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
    const created = await this.prisma.ledgerTransaction.create({
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
  }
}
