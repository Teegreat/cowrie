import { Wallet } from 'src/wallet/domain/wallet';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class WalletRepository {
  abstract findByUserId(userId: string): Promise<Wallet | null>;
  abstract create(wallet: Wallet, ctx?: TransactionContext): Promise<Wallet>;
  abstract findById(id: string): Promise<Wallet | null>;
  abstract findByPhoneNumber(phoneNumber: string): Promise<Wallet | null>;
}
