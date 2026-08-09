import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { WalletRepository } from 'src/wallet/application/ports/wallet-repository.port';
import { Wallet } from 'src/wallet/domain/wallet';

@Injectable()
export class PrismaWalletRepository extends WalletRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    const record = await this.prisma.wallet.findUnique({ where: { userId } });
    return record ? Wallet.existing(record) : null;
  }

  async create(wallet: Wallet, ctx?: TransactionContext): Promise<Wallet> {
    try {
      const created = await this.client(ctx).wallet.create({
        data: {
          userId: wallet.userId,
          accountId: wallet.accountId,
          currency: wallet.currency,
          phoneNumber: wallet.phoneNumber,
        },
      });
      return Wallet.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException('A wallet already exists for this account');
      }
      throw error;
    }
  }
  async findById(id: string): Promise<Wallet | null> {
    const record = await this.prisma.wallet.findUnique({
      where: { id },
    });
    return record ? Wallet.existing(record) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Wallet | null> {
    const record = await this.prisma.wallet.findUnique({
      where: { phoneNumber },
    });
    return record ? Wallet.existing(record) : null;
  }
}
