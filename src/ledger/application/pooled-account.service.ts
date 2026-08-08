import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './ports/ledger-repository.port';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export const POOLED_ASSET_ACCOUNT_NAME = 'Pooled BaaS Settlement Account';
export const PENDING_WITHDRAWALS_ACCOUNT_NAME = 'Pending Withdrawals';

@Injectable()
export class PooledAccountService {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async getOrCreate(
    name: string,
    accountType: 'ASSET' | 'LIABILITY',
    currency: string,
    ctx?: TransactionContext,
  ): Promise<string> {
    const existing = await this.ledgerRepository.findAccountByName(
      name,
      currency,
    );
    if (existing) {
      return existing.id;
    }
    try {
      return await this.ledgerRepository.createAccount(
        { name, accountType, currency },
        ctx,
      );
    } catch {
      // Lost the create race to a concurrent caller — the row exists now.

      const created = await this.ledgerRepository.findAccountByName(
        name,
        currency,
      );
      return created!.id;
    }
  }
}
