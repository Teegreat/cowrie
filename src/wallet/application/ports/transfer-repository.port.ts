import { Transfer } from 'src/wallet/domain/transfer';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class TransferRepository {
  abstract findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Transfer | null>;
  abstract create(
    transfer: Transfer,
    ctx?: TransactionContext,
  ): Promise<Transfer>;
}
