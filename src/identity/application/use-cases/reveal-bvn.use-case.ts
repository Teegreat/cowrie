import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class RevealBvnUseCase {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<{ bvn: string }> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundDomainException('Profile not found');
    }

    // Never the BVN itself in metadata — only the fact that a reveal
    // happened and for which profile.
    await this.auditLogRepository.create(
      AuditLog.record({
        actorUserId: userId,
        actorEmail: null,
        action: 'BVN_REVEALED',
        targetType: 'Profile',
        targetId: userId,
        metadata: { profileUserId: userId },
        ipAddress,
        userAgent,
      }),
    );

    // The one deliberate place the full, unmasked value is ever returned.
    return { bvn: profile.bvn.value };
  }
}
