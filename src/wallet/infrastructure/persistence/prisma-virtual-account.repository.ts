import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { VirtualAccountRepository } from 'src/wallet/application/ports/virtual-account-repository.port';
import { VirtualAccount } from 'src/wallet/domain/virtual-account';

@Injectable()
export class PrismaVirtualAccountRepository extends VirtualAccountRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByWalletId(walletId: string): Promise<VirtualAccount | null> {
    const record = await this.prisma.virtualAccount.findUnique({
      where: { walletId },
    });
    return record ? VirtualAccount.existing(record) : null;
  }

  async create(account: VirtualAccount): Promise<VirtualAccount> {
    try {
      const created = await this.prisma.virtualAccount.create({
        data: {
          walletId: account.walletId,
          accountNumber: account.accountNumber,
          bankCode: account.bankCode,
          bankName: account.bankName,
        },
      });
      return VirtualAccount.existing(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'A virtual account already exists for this wallet',
        );
      }
      throw error;
    }
  }
}
