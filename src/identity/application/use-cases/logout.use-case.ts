import { Injectable } from '@nestjs/common';
import { hashToken } from '../token-hash.util';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    rawRefreshToken: string,
    actorUserId: string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    await this.transactionManager.run(async (ctx) => {
      await this.refreshTokenRepository.revokeByHashedToken(
        hashToken(rawRefreshToken),
        ctx,
      );
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId,
          actorEmail: null,
          action: 'USER_LOGGED_OUT',
          ipAddress,
          userAgent,
        }),
        ctx,
      );
    });
  }
}
