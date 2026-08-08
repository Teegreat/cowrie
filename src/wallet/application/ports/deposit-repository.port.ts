import { Deposit } from 'src/wallet/domain/deposit';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class DepositRepository {
  abstract findByExternalReference(
    externalReference: string,
  ): Promise<Deposit | null>;
  abstract create(deposit: Deposit, ctx?: TransactionContext): Promise<Deposit>;
}
