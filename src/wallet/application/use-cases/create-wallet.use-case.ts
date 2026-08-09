import { Injectable } from '@nestjs/common';
import { WalletRepository } from '../ports/wallet-repository.port';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { Wallet } from 'src/wallet/domain/wallet';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class CreateWalletUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly ledgerRepository: LedgerRepository,
  ) {}

  async execute(
    userId: string,
    phoneNumber: string,
    ctx: TransactionContext,
  ): Promise<Wallet> {
    const existing = await this.walletRepository.findByUserId(userId);
    if (existing) {
      throw new DomainException('A wallet already exists for this account');
    }
    // LIABILITY: a customer's wallet balance is money the platform owes
    // them — the exact account type Ch. 16/24's insufficient-balance
    // guard was built to protect, finally put to its real use.

    const accountId = await this.ledgerRepository.createAccount(
      {
        name: `Wallet — ${userId}`,
        accountType: 'LIABILITY',
        currency: 'NGN',
      },
      ctx,
    );

    const wallet = Wallet.open({
      userId,
      accountId,
      currency: 'NGN',
      phoneNumber,
    });
    return this.walletRepository.create(wallet, ctx);
  }
}
