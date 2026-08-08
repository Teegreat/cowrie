import { Injectable } from '@nestjs/common';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import {
  POOLED_ASSET_ACCOUNT_NAME,
  PooledAccountService,
} from 'src/ledger/application/pooled-account.service';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { WalletRepository } from '../ports/wallet-repository.port';
import { VirtualAccountRepository } from '../ports/virtual-account-repository.port';
import { DepositRepository } from '../ports/deposit-repository.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import { Money } from 'src/shared-kernel/money.value-object';
import { Deposit } from 'src/wallet/domain/deposit';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class ProcessDepositUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly ledgerRepository: LedgerRepository,
    private readonly pooledAccountService: PooledAccountService,
    private readonly walletRepository: WalletRepository,
    private readonly virtualAccountRepository: VirtualAccountRepository,
    private readonly depositRepository: DepositRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    virtualAccountNumber: string;
    amountMinorUnits: bigint;
    currency: string;
    externalReference: string;
  }): Promise<Deposit> {
    const existing = await this.depositRepository.findByExternalReference(
      input.externalReference,
    );
    if (existing) return existing;

    const virtualAccount =
      await this.virtualAccountRepository.findByAccountNumber(
        input.virtualAccountNumber,
      );
    if (!virtualAccount) {
      throw new NotFoundDomainException(
        'No wallet found for this virtual account number',
      );
    }

    const wallet = await this.walletRepository.findById(
      virtualAccount.walletId,
    );

    if (!wallet) {
      throw new NotFoundDomainException('Wallet not found');
    }

    return this.transactionManager.run(async (ctx) => {
      const pooledAccountId = await this.pooledAccountService.getOrCreate(
        POOLED_ASSET_ACCOUNT_NAME,
        'ASSET',
        input.currency,
        ctx,
      );

      const transaction = LedgerTransaction.balanced([
        {
          accountId: pooledAccountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'DEBIT',
        },
        {
          accountId: wallet.accountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'CREDIT',
        },
      ]);

      const ledgerTransactionId = await this.ledgerRepository.saveTransaction(
        transaction,
        ctx,
      );

      const deposit = await this.depositRepository.create(
        Deposit.record({
          walletId: wallet.id!,
          amountMinorUnits: input.amountMinorUnits,
          currency: input.currency,
          externalReference: input.externalReference,
          ledgerTransactionId,
        }),
        ctx,
      );

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: null,
          actorEmail: null,
          action: 'DEPOSIT_RECEIVED',
          targetType: 'Wallet',
          targetId: wallet.id,
          metadata: { externalReference: input.externalReference },
          ipAddress: null,
          userAgent: null,
        }),
        ctx,
      );

      return deposit;
    });
  }
}
