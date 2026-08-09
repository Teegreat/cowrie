import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { LedgerTransaction } from 'src/ledger/domain/ledger-transaction';
import {
  DomainException,
  NotFoundDomainException,
} from 'src/shared-kernel/domain-exception';
import { Money } from 'src/shared-kernel/money.value-object';
import { TransferRepository } from 'src/wallet/application/ports/transfer-repository.port';
import { WalletRepository } from 'src/wallet/application/ports/wallet-repository.port';
import { Transfer } from 'src/wallet/domain/transfer';

@Injectable()
export class InitiateTransferUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly ledgerRepository: LedgerRepository,
    private readonly walletRepository: WalletRepository,
    private readonly transferRepository: TransferRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    senderUserId: string;
    recipientPhoneNumber: string;
    amountMinorUnits: bigint;
    currency: string;
    narration: string | null;
    idempotencyKey: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<Transfer> {
    const existing = await this.transferRepository.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) return existing;

    const senderWallet = await this.walletRepository.findByUserId(
      input.senderUserId,
    );
    if (!senderWallet) {
      throw new NotFoundDomainException('No wallet found for this account');
    }

    const recipientWallet = await this.walletRepository.findByPhoneNumber(
      input.recipientPhoneNumber,
    );
    if (!recipientWallet) {
      throw new NotFoundDomainException(
        'No wallet found for this phone number',
      );
    }

    if (senderWallet.id === recipientWallet.id) {
      throw new DomainException('Cannot transfer to your own wallet');
    }

    return this.transactionManager.run(async (ctx) => {
      // On-us: both postings hit LIABILITY wallet accounts only — the
      // pooled asset account is never touched, because no real money
      // leaves Cowrie (Ch. 3/4).
      const transaction = LedgerTransaction.balanced([
        {
          accountId: senderWallet.accountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'DEBIT',
        },
        {
          accountId: recipientWallet.accountId,
          money: Money.of(input.amountMinorUnits, input.currency),
          direction: 'CREDIT',
        },
      ]);

      const ledgerTransactionId = await this.ledgerRepository.saveTransaction(
        transaction,
        ctx,
      );

      const created = await this.transferRepository.create(
        Transfer.record({
          senderWalletId: senderWallet.id!,
          recipientWalletId: recipientWallet.id!,
          amountMinorUnits: input.amountMinorUnits,
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
          ledgerTransactionId,
          narration: input.narration,
        }),
        ctx,
      );

      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: input.senderUserId,
          actorEmail: null,
          action: 'TRANSFER_SENT',
          targetType: 'Transfer',
          targetId: created.id,
          metadata: { recipientWalletId: recipientWallet.id },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );

      return created;
    });
  }
}
