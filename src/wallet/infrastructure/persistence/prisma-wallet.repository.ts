import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
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

  async findByUserId(
    userId: string,
    ctx?: TransactionContext,
  ): Promise<Wallet | null> {
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
        },
      });
      return Wallet.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error('Wallet already exists for this user');
      }
      throw error;
    }
  }
}
