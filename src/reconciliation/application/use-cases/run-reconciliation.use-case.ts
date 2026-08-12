import { Injectable } from '@nestjs/common';
import { ReconciliationRepository } from '../ports/reconciliation-repository.port';
import { ReconcileStuckWithdrawalsUseCase } from './reconcile-stuck-withdrawals.use-case';
import { ReconcileBalanceUseCase } from './reconcile-balance.use-case';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class RunReconciliationUseCase {
  constructor(
    private readonly reconciliationRepository: ReconciliationRepository,
    private readonly reconcileStuckWithdrawals: ReconcileStuckWithdrawalsUseCase,
    private readonly reconcileBalance: ReconcileBalanceUseCase,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(actorUserId: string) {
    const run = await this.reconciliationRepository.createRun();

    const withdrawalDiscrepancies =
      await this.reconcileStuckWithdrawals.execute(run.id);
    const balanceDiscrepancies = await this.reconcileBalance.execute(run.id);
    const total = withdrawalDiscrepancies + balanceDiscrepancies;

    const completed = await this.reconciliationRepository.completeRun(
      run.id,
      total,
    );

    await this.auditLogRepository.create(
      AuditLog.record({
        actorUserId,
        actorEmail: null,
        action: 'RECONCILIATION_RUN_COMPLETED',
        targetType: 'ReconciliationRun',
        targetId: completed.id,
        metadata: { discrepancyCount: total },
        ipAddress: null,
        userAgent: null,
      }),
    );
    return completed;
  }
}
