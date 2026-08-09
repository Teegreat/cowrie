import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { TransferRepository } from 'src/wallet/application/ports/transfer-repository.port';
import { Transfer } from 'src/wallet/domain/transfer';

@Injectable()
export class PrismaTransferRepository extends TransferRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Transfer | null> {
    const record = await this.prisma.transfer.findUnique({
      where: { idempotencyKey },
    });
    return record ? Transfer.existing(record) : null;
  }

  async create(
    transfer: Transfer,
    ctx?: TransactionContext,
  ): Promise<Transfer> {
    try {
      const created = await this.client(ctx).transfer.create({
        data: {
          senderWalletId: transfer.senderWalletId,
          recipientWalletId: transfer.recipientWalletId,
          amountMinorUnits: transfer.amountMinorUnits,
          currency: transfer.currency,
          idempotencyKey: transfer.idempotencyKey,
          ledgerTransactionId: transfer.ledgerTransactionId,
          narration: transfer.narration,
        },
      });
      return Transfer.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'A transfer with this idempotency key already exists',
        );
      }
      throw error;
    }
  }
}
