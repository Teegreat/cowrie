import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { Profile, PublicProfile } from 'src/identity/domain/profile';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { SanctionsScreeningGateway } from '../ports/sanctions-screening-gateway.port';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class CreateProfileUseCase {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly screeningGateway: SanctionsScreeningGateway,
    private readonly complianceCaseRepository: ComplianceCaseRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    userId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    bvn: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<PublicProfile> {
    const existing = await this.profileRepository.findByUserId(input.userId);
    if (existing) {
      throw new DomainException('Profile already exists for this account');
    }
    const screening = await this.screeningGateway.screen({
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
    });

    const profile = Profile.create({
      ...input,
      riskScore: screening.riskScore,
      watchlistHits: screening.watchlistHits,
    });

    const created = await this.transactionManager.run(async (ctx) => {
      const created = await this.profileRepository.create(profile, ctx);

      if (created.screeningStatus !== 'CLEARED') {
        await this.complianceCaseRepository.create(
          {
            userId: created.userId,
            riskScore: screening.riskScore,
            watchlistHits: screening.watchlistHits,
          },
          ctx,
        );
      }

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: input.userId,
          actorEmail: null,
          action: 'PROFILE_CREATED',
          targetType: 'Profile',
          targetId: created.userId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );

      return created;
    });

    return created.toPublicProfile();
  }
}
