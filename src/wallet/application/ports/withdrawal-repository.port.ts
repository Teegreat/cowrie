import { Withdrawal, WithdrawalStatus } from 'src/wallet/domain/withdrawal';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class WithdrawalRepository {
  abstract findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Withdrawal | null>;
  abstract findById(id: string): Promise<Withdrawal | null>;
  abstract create(
    withdrawal: Withdrawal,
    ctx?: TransactionContext,
  ): Promise<Withdrawal>;
  abstract updateStatus(id: string, status: WithdrawalStatus): Promise<void>;
  abstract markSuccessful(
    id: string,
    resolutionTransactionId: string,
    externalReference: string,
    ctx?: TransactionContext,
  ): Promise<void>;
  abstract markFailed(
    id: string,
    resolutionTransactionId: string,
    failureReason: string,
    ctx?: TransactionContext,
  ): Promise<void>;
}
