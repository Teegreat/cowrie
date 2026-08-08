import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { DepositRepository } from 'src/wallet/application/ports/deposit-repository.port';
import { Deposit } from 'src/wallet/domain/deposit';

@Injectable()
export class PrismaDepositRepository extends DepositRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findByExternalReference(
    externalReference: string,
  ): Promise<Deposit | null> {
    const record = await this.prisma.deposit.findUnique({
      where: { externalReference },
    });
    return record ? Deposit.existing(record) : null;
  }

  async create(deposit: Deposit, ctx?: TransactionContext): Promise<Deposit> {
    try {
      const created = await this.client(ctx).deposit.create({
        data: {
          walletId: deposit.walletId,
          amountMinorUnits: deposit.amountMinorUnits,
          currency: deposit.currency,
          externalReference: deposit.externalReference,
          ledgerTransactionId: deposit.ledgerTransactionId,
        },
      });
      return Deposit.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException('This deposit has already been processed');
      }
      throw error;
    }
  }
}
