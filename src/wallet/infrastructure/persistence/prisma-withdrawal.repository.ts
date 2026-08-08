import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { WithdrawalRepository } from 'src/wallet/application/ports/withdrawal-repository.port';
import { Withdrawal, WithdrawalStatus } from 'src/wallet/domain/withdrawal';

@Injectable()
export class PrismaWithdrawalRepository extends WithdrawalRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Withdrawal | null> {
    const record = await this.prisma.withdrawal.findUnique({
      where: { idempotencyKey },
    });
    return record ? Withdrawal.existing(record) : null;
  }

  async findById(id: string): Promise<Withdrawal | null> {
    const record = await this.prisma.withdrawal.findUnique({ where: { id } });
    return record ? Withdrawal.existing(record) : null;
  }

  async create(
    withdrawal: Withdrawal,
    ctx?: TransactionContext,
  ): Promise<Withdrawal> {
    try {
      const created = await this.client(ctx).withdrawal.create({
        data: {
          walletId: withdrawal.walletId,
          amountMinorUnits: withdrawal.amountMinorUnits,
          currency: withdrawal.currency,
          destinationAccountNumber: withdrawal.destinationAccountNumber,
          destinationBankCode: withdrawal.destinationBankCode,
          status: withdrawal.status,
          idempotencyKey: withdrawal.idempotencyKey,
          reservationTransactionId: withdrawal.reservationTransactionId,
        },
      });
      return Withdrawal.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'A withdrawal with this idempotency key already exists',
        );
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: WithdrawalStatus): Promise<void> {
    await this.prisma.withdrawal.update({ where: { id }, data: { status } });
  }

  async markSuccessful(
    id: string,
    resolutionTransactionId: string,
    externalReference: string,
    ctx?: TransactionContext,
  ): Promise<void> {
    await this.client(ctx).withdrawal.update({
      where: { id },
      data: {
        status: 'SUCCESSFUL',
        resolutionTransactionId,
        externalReference,
        resolvedAt: new Date(),
      },
    });
  }

  async markFailed(
    id: string,
    resolutionTransactionId: string,
    failureReason: string,
    ctx?: TransactionContext,
  ): Promise<void> {
    await this.client(ctx).withdrawal.update({
      where: { id },
      data: {
        status: 'FAILED',
        resolutionTransactionId,
        failureReason,
        resolvedAt: new Date(),
      },
    });
  }
}
