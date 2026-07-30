import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { User } from 'src/identity/domain/user';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { generateRawRefreshToken, hashToken } from '../token-hash.util';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token.constants';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const normalizedEmail = User.normalizeEmail(input.email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    const invalidCredentials = () =>
      new DomainException('Invalid email or password');

    // Both failure branches audit the same way: a failed login is a
    // security-relevant event in its own right, not just a rejected
    // request. No transaction needed here — there's no other write to
    // join, just the one audit insert.
    if (!user) {
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: null,
          actorEmail: normalizedEmail,
          action: 'USER_LOGIN_FAILED',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
      );
      throw invalidCredentials();
    }

    const passwordValid = await this.passwordHasher.verify(
      input.password,
      user.hashedPassword,
    );
    if (!passwordValid) {
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: user.id ?? null,
          actorEmail: normalizedEmail,
          action: 'USER_LOGIN_FAILED',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
      );
      throw invalidCredentials();
    }

    const accessToken = await this.tokenIssuer.issueAccessToken({
      sub: user.id!,
    });

    const rawRefreshToken = generateRawRefreshToken();

    await this.transactionManager.run(async (ctx) => {
      // Single-active-session policy (matches Kuda's real-world model):
      // logging in anywhere invalidates any previous session for this
      // user, atomically, so at most one refresh token ever exists.
      await this.refreshTokenRepository.replaceAllForUser(
        {
          userId: user.id!,
          hashedToken: hashToken(rawRefreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
        ctx,
      );
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: user.id ?? null,
          actorEmail: normalizedEmail,
          action: 'USER_LOGGED_IN',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
