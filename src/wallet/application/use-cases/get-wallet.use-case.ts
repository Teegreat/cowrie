import { Injectable } from '@nestjs/common';
import { WalletRepository } from '../ports/wallet-repository.port';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { Money } from 'src/shared-kernel/money.value-object';
import { VirtualAccountRepository } from '../ports/virtual-account-repository.port';

@Injectable()
export class GetWalletUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly virtualAccountRepository: VirtualAccountRepository,
  ) {}

  async execute(userId: string) {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundDomainException(
        'No wallet found for this account — complete KYC verification to open one',
      );
    }

    const balance = await this.ledgerRepository.getBalance(wallet.accountId);

    const virtualAccount = await this.virtualAccountRepository.findByWalletId(
      wallet.id!,
    );

    return {
      walletId: wallet.id,
      currency: wallet.currency,
      // Both a raw digit string (for programmatic clients) and a
      // formatted string (for display) — never a raw bigint (Ch. 24:
      // JSON.stringify throws on bigint).
      minorUnits: balance.minorUnits.toString(),
      balance: Money.of(balance.minorUnits, balance.currency).toString(),
      virtualAccount: virtualAccount
        ? {
            accountNumber: virtualAccount.accountNumber,
            bankCode: virtualAccount.bankCode,
            bankName: virtualAccount.bankName,
          }
        : null,
    };
  }
}
