import { Injectable } from '@nestjs/common';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import {
  PENDING_WITHDRAWALS_ACCOUNT_NAME,
  PooledAccountService,
} from 'src/ledger/application/pooled-account.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { WalletRepository } from '../ports/wallet-repository.port';
import { WithdrawalRepository } from '../ports/withdrawal-repository.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { Withdrawal } from 'src/wallet/domain/withdrawal';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import { Money } from 'src/shared-kernel/money.value-object';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class ReleaseWithdrawalUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly ledgerRepository: LedgerRepository,
    private readonly pooledAccountService: PooledAccountService,
    private readonly walletRepository: WalletRepository,
    private readonly withdrawalRepository: WithdrawalRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(withdrawal: Withdrawal, reason: string): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(
      withdrawal.walletId,
    );

    if (!wallet) {
      throw new NotFoundDomainException('Wallet not found');
    }

    await this.transactionManager.run(async (ctx) => {
      const pendingAccountId = await this.pooledAccountService.getOrCreate(
        PENDING_WITHDRAWALS_ACCOUNT_NAME,
        'LIABILITY',
        withdrawal.currency,
        ctx,
      );

      const reversal = LedgerTransaction.balanced([
        {
          accountId: pendingAccountId,
          money: Money.of(withdrawal.amountMinorUnits, withdrawal.currency),
          direction: 'DEBIT',
        },
        {
          accountId: wallet.accountId,
          money: Money.of(withdrawal.amountMinorUnits, withdrawal.currency),
          direction: 'CREDIT',
        },
      ]);

      const resolutionTransactionId =
        await this.ledgerRepository.saveTransaction(reversal, ctx);

      await this.withdrawalRepository.markFailed(
        withdrawal.id!,
        resolutionTransactionId,
        reason,
        ctx,
      );

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: null,
          actorEmail: null,
          action: 'WITHDRAWAL_FAILED',
          targetType: 'Withdrawal',
          targetId: withdrawal.id,
          metadata: { reason },
          ipAddress: null,
          userAgent: null,
        }),
        ctx,
      );
    });
  }
}
