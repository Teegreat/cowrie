import { VirtualAccount } from 'src/wallet/domain/virtual-account';

export abstract class VirtualAccountRepository {
  abstract findByWalletId(walletId: string): Promise<VirtualAccount | null>;
  abstract findByAccountNumber(
    accountNumber: string,
  ): Promise<VirtualAccount | null>;

  abstract create(account: VirtualAccount): Promise<VirtualAccount>;
}
