import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';

export abstract class LedgerRepository {
  abstract createAccount(input: {
    name: string;
    accountType: 'ASSET' | 'LIABILITY';
  }): Promise<string>;
  abstract saveTransaction(transaction: LedgerTransaction): Promise<string>;
}
