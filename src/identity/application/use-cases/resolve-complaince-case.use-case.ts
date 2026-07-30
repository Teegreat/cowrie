import { Injectable } from '@nestjs/common';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { ProfileRepository } from '../ports/profile-repository.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class ResolveComplianceCaseUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly complianceCaseRepository: ComplianceCaseRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    caseId: string,
    notes: string,
    disposition: 'CLEARED' | 'CONFIRMED_BLOCK',
    resolvedByUserId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    await this.transactionManager.run(async (ctx) => {
      // Atomic guard: null means the case was already resolved (by
      // someone else, concurrently) — race condition from Ch. 20, still
      // closed the same way.
      const resolved = await this.complianceCaseRepository.resolveIfOpen(
        { caseId, notes, resolvedByUserId, disposition },
        ctx,
      );
      if (!resolved) {
        throw new NotFoundDomainException(
          'Compliance case not found or already resolved',
        );
      }

      const profile = await this.profileRepository.findByUserId(
        resolved.userId,
      );
      if (profile) {
        const updatedProfile =
          disposition === 'CLEARED'
            ? profile.clearScreening()
            : profile.confirmBlock();
        await this.profileRepository.update(updatedProfile, ctx);
      }

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: resolvedByUserId,
          actorEmail: null,
          action: 'COMPLIANCE_CASE_RESOLVED',
          targetType: 'ComplianceCase',
          targetId: caseId,
          metadata: { disposition },
          ipAddress,
          userAgent,
        }),
        ctx,
      );
    });
  }
}
