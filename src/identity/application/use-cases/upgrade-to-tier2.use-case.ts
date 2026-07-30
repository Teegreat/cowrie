import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { PublicProfile } from 'src/identity/domain/profile';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class UpgradeToTier2UseCase {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    userId: string;
    nin: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<PublicProfile> {
    const profile = await this.profileRepository.findByUserId(input.userId);
    if (!profile) {
      throw new NotFoundDomainException(
        'Complete your profile before upgrading KYC tier',
      );
    }

    const upgraded = profile.upgradeToTier2(input.nin);

    const saved = await this.transactionManager.run(async (ctx) => {
      const saved = await this.profileRepository.update(upgraded, ctx);
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: input.userId,
          actorEmail: null,
          action: 'KYC_TIER_UPGRADED',
          targetType: 'Profile',
          targetId: input.userId,
          metadata: { fromTier: profile.kycTier, toTier: saved.kycTier },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );
      return saved;
    });

    return saved.toPublicProfile();
  }
}
