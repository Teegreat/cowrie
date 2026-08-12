import { Injectable } from '@nestjs/common';
import { BaaSGateway } from 'src/ledger/application/ports/baas-gateway.port';
import { WithdrawalRepository } from 'src/wallet/application/ports/withdrawal-repository.port';
import { ReleaseWithdrawalUseCase } from 'src/wallet/application/use-cases/release-withdrawal.use-case';
import { SettleWithdrawalUseCase } from 'src/wallet/application/use-cases/settle-withdrawal.use-case';
import { ReconciliationRepository } from '../ports/reconciliation-repository.port';

@Injectable()
export class ReconcileStuckWithdrawalsUseCase {
  constructor(
    private readonly baasGateway: BaaSGateway,
    private readonly withdrawalRepository: WithdrawalRepository,
    private readonly settleWithdrawal: SettleWithdrawalUseCase,
    private readonly releaseWithdrawal: ReleaseWithdrawalUseCase,
    private readonly reconciliationRepository: ReconciliationRepository,
  ) {}

  async execute(runId: string): Promise<number> {
    const stuck = await this.withdrawalRepository.findAllProcessing();
    let resolvedCount = 0;

    for (const withdrawal of stuck) {
      const outcome = await this.baasGateway.checkTransferStatus(
        withdrawal.idempotencyKey,
      );

      if (outcome.status === 'SUCCESSFUL') {
        await this.settleWithdrawal.execute(
          withdrawal,
          outcome.externalReference,
        );
        await this.reconciliationRepository.recordDiscrepancy(
          runId,
          'STUCK_WITHDRAWAL_RESOLVED',
          `Withdrawal ${withdrawal.id} was stuck PROCESSING; requery resolved it as SUCCESSFUL`,
          { withdrawalId: withdrawal.id },
        );
        resolvedCount++;
      } else if (outcome.status === 'FAILED') {
        await this.releaseWithdrawal.execute(withdrawal, outcome.reason);
        await this.reconciliationRepository.recordDiscrepancy(
          runId,
          'STUCK_WITHDRAWAL_RESOLVED',
          `Withdrawal ${withdrawal.id} was stuck PROCESSING; requery resolved it as FAILED`,
          { withdrawalId: withdrawal.id },
        );
        resolvedCount++;
      }
      // Still UNKNOWN on requery: genuinely still pending, not a
      // discrepancy — leave it exactly where it is.
    }
    return resolvedCount;
  }
}
