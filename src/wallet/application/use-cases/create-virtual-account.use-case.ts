import { Injectable } from '@nestjs/common';
import { VirtualAccountRepository } from '../ports/virtual-account-repository.port';
import { BaaSGateway } from 'src/ledger/application/ports/baas-gateway.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { VirtualAccount } from 'src/wallet/domain/virtual-account';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class CreateVirtualAccountUseCase {
  constructor(
    private readonly baasGateway: BaaSGateway,
    private readonly virtualAccountRepository: VirtualAccountRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    walletId: string,
    userId: string,
    accountName: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<VirtualAccount> {
    // Idempotent — safe to call again after a prior failure (Ch. 10:
    // saga steps must tolerate re-invocation).
    const existing =
      await this.virtualAccountRepository.findByWalletId(walletId);

    if (existing) {
      return existing;
    }

    const details = await this.baasGateway.createVirtualAccount({
      reference: walletId,
      accountName,
    });

    const created = await this.virtualAccountRepository.create(
      VirtualAccount.open({
        walletId,
        ...details,
      }),
    );

    await this.auditLogRepository.create(
      AuditLog.record({
        actorUserId: userId,
        actorEmail: null,
        action: 'VIRTUAL_ACCOUNT_CREATED',
        targetType: 'VirtualAccount',
        targetId: created.id,
        metadata: { walletId, bankCode: details.bankCode },
        ipAddress,
        userAgent,
      }),
    );

    return created;
  }
}
