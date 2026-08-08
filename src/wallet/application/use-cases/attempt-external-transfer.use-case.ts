import { Injectable } from '@nestjs/common';
import { BaaSGateway } from 'src/ledger/application/ports/baas-gateway.port';
import { WithdrawalRepository } from '../ports/withdrawal-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { SettleWithdrawalUseCase } from './settle-withdrawal.use-case';
import { ReleaseWithdrawalUseCase } from './release-withdrawal.use-case';

@Injectable()
export class AttemptExternalTransferUseCase {
  constructor(
    private readonly baasGateway: BaaSGateway,
    private readonly withdrawalRepository: WithdrawalRepository,
    private readonly settleWithdrawalUseCase: SettleWithdrawalUseCase,
    private readonly releaseWithdrawalUseCase: ReleaseWithdrawalUseCase,
  ) {}

  async execute(withdrawalId: string): Promise<void> {
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundDomainException('Withdrawal not found');
    }

    await this.withdrawalRepository.updateStatus(withdrawalId, 'PROCESSING');

    const outcome = await this.baasGateway.initiateExternalTransfer({
      idempotencyKey: withdrawal.idempotencyKey,
      amountMinorUnits: withdrawal.amountMinorUnits,
      currency: withdrawal.currency,
      destinationAccountNumber: withdrawal.destinationAccountNumber,
      destinationBankCode: withdrawal.destinationBankCode,
    });

    if (outcome.status === 'SUCCESSFUL') {
      await this.settleWithdrawalUseCase.execute(
        withdrawal,
        outcome.externalReference,
      );
    } else if (outcome.status === 'FAILED') {
      await this.releaseWithdrawalUseCase.execute(withdrawal, outcome.reason);
    }
  }
}
