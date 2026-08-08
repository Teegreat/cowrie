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
import { AttemptExternalTransferUseCase } from './attempt-external-transfer.use-case';

@Injectable()
export class InitiateWithdrawalUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly ledgerRepository: LedgerRepository,
    private readonly pooledAccountService: PooledAccountService,
    private readonly walletRepository: WalletRepository,
    private readonly withdrawalRepository: WithdrawalRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly attemptExternalTransferUseCase: AttemptExternalTransferUseCase,
  ) {}

  async execute(input: {
    userId: string;
    amountMinorUnits: bigint;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    idempotencyKey: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<Withdrawal> {
    const existingRequest =
      await this.withdrawalRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );
    if (existingRequest) return existingRequest;

    const wallet = await this.walletRepository.findByUserId(input.userId);
    if (!wallet) {
      throw new NotFoundDomainException('No wallet found for this account');
    }

    const withdrawal = await this.transactionManager.run(async (ctx) => {
      const pendingAccountId = await this.pooledAccountService.getOrCreate(
        PENDING_WITHDRAWALS_ACCOUNT_NAME,
        'LIABILITY',
        input.currency,
        ctx,
      );

      const reservation = LedgerTransaction.balanced([
        {
          accountId: wallet.accountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'DEBIT',
        },
        {
          accountId: pendingAccountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'CREDIT',
        },
      ]);

      const reservationTransactionId =
        await this.ledgerRepository.saveTransaction(reservation, ctx);

      const created = await this.withdrawalRepository.create(
        Withdrawal.request({
          walletId: wallet.id!,
          amountMinorUnits: input.amountMinorUnits,
          currency: input.currency,
          destinationAccountNumber: input.destinationAccountNumber,
          destinationBankCode: input.destinationBankCode,
          idempotencyKey: input.idempotencyKey,
          reservationTransactionId,
        }),
        ctx,
      );

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: input.userId,
          actorEmail: null,
          action: 'WITHDRAWAL_INITIATED',
          targetType: 'Withdrawal',
          targetId: created.id,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );
      return created;
    });

    await this.attemptExternalTransferUseCase.execute(withdrawal.id!);
    return (await this.withdrawalRepository.findById(withdrawal.id!))!;
  }
}
