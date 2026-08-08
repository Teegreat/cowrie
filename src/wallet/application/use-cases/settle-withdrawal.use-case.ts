import { Injectable } from '@nestjs/common';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import {
  PENDING_WITHDRAWALS_ACCOUNT_NAME,
  POOLED_ASSET_ACCOUNT_NAME,
  PooledAccountService,
} from 'src/ledger/application/pooled-account.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { WithdrawalRepository } from '../ports/withdrawal-repository.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { Withdrawal } from 'src/wallet/domain/withdrawal';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import { Money } from 'src/shared-kernel/money.value-object';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class SettleWithdrawalUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly ledgerRepository: LedgerRepository,
    private readonly pooledAccountService: PooledAccountService,
    private readonly withdrawalRepository: WithdrawalRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    withdrawal: Withdrawal,
    externalReference: string,
  ): Promise<void> {
    await this.transactionManager.run(async (ctx) => {
      const pendingAccountId = await this.pooledAccountService.getOrCreate(
        PENDING_WITHDRAWALS_ACCOUNT_NAME,
        'LIABILITY',
        withdrawal.currency,
        ctx,
      );

      const pooledAccountId = await this.pooledAccountService.getOrCreate(
        POOLED_ASSET_ACCOUNT_NAME,
        'ASSET',
        withdrawal.currency,
        ctx,
      );

      const settlement = LedgerTransaction.balanced([
        {
          accountId: pendingAccountId,
          money: Money.of(withdrawal.amountMinorUnits, withdrawal.currency),
          direction: 'DEBIT',
        },
        {
          accountId: pooledAccountId,
          money: Money.of(withdrawal.amountMinorUnits, withdrawal.currency),
          direction: 'CREDIT',
        },
      ]);

      const resolutionTransactionId =
        await this.ledgerRepository.saveTransaction(settlement, ctx);

      await this.withdrawalRepository.markSuccessful(
        withdrawal.id!,
        resolutionTransactionId,
        externalReference,
        ctx,
      );

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: null,
          actorEmail: null,
          action: 'WITHDRAWAL_SUCCEEDED',
          targetType: 'Withdrawal',
          targetId: withdrawal.id,
          metadata: { externalReference },
          ipAddress: null,
          userAgent: null,
        }),
        ctx,
      );
    });
  }
}
