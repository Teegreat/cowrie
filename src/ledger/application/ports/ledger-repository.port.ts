import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';

export abstract class LedgerRepository {
  abstract createAccount(
    input: {
      name: string;
      accountType: 'ASSET' | 'LIABILITY';
      currency: string;
    },
    ctx?: TransactionContext,
  ): Promise<string>;
  abstract saveTransaction(
    transaction: LedgerTransaction,
    ctx?: TransactionContext,
  ): Promise<string>;
  abstract getBalance(
    accountId: string,
    ctx?: TransactionContext,
  ): Promise<{ minorUnits: bigint; currency: string }>;
  abstract findAccountByName(
    name: string,
    currency: string,
  ): Promise<{ id: string } | null>;
}
