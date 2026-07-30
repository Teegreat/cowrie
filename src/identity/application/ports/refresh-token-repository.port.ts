import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class RefreshTokenRepository {
  abstract store(input: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void>;
  abstract consumeValidToken(
    hashedToken: string,
  ): Promise<{ userId: string } | null>;
  abstract revokeByHashedToken(
    hashedToken: string,
    ctx?: TransactionContext,
  ): Promise<void>;
  // ctx is mandatory here — the lock-then-delete-then-insert sequence
  // must join whatever transaction the caller (LoginUseCase) opened, so
  // its audit entry can commit or roll back with it.
  abstract replaceAllForUser(
    input: { userId: string; hashedToken: string; expiresAt: Date },
    ctx: TransactionContext,
  ): Promise<void>;
}
