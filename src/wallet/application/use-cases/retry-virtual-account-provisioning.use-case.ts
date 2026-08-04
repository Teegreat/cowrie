import { Injectable } from '@nestjs/common';
import { WalletRepository } from '../ports/wallet-repository.port';
import { CreateVirtualAccountUseCase } from './create-virtual-account.use-case';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class RetryVirtualAccountProvisioningUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly createVirtualAccountUseCase: CreateVirtualAccountUseCase,
  ) {}

  async execute(
    userId: string,
    accountName: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundDomainException(
        'No wallet found for this account — complete KYC verification to open one',
      );
    }
    return this.createVirtualAccountUseCase.execute(
      wallet.id!,
      userId,
      accountName,
      ipAddress,
      userAgent,
    );
  }
}
