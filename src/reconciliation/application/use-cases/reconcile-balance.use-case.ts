import { Injectable } from '@nestjs/common';
import {
  POOLED_ASSET_ACCOUNT_NAME,
  PooledAccountService,
} from 'src/ledger/application/pooled-account.service';
import { BaaSGateway } from 'src/ledger/application/ports/baas-gateway.port';
import { LedgerRepository } from 'src/ledger/application/ports/ledger-repository.port';
import { ReconciliationRepository } from '../ports/reconciliation-repository.port';

@Injectable()
export class ReconcileBalanceUseCase {
  constructor(
    private readonly baasGateway: BaaSGateway,
    private readonly ledgerRepository: LedgerRepository,
    private readonly pooledAccountService: PooledAccountService,
    private readonly reconciliationRepository: ReconciliationRepository,
  ) {}

  async execute(runId: string): Promise<number> {
    const pooledAccountId = await this.pooledAccountService.getOrCreate(
      POOLED_ASSET_ACCOUNT_NAME,
      'ASSET',
      'NGN',
    );
    const internal = await this.ledgerRepository.getBalance(pooledAccountId);
    const external = await this.baasGateway.getAccountBalance();

    if (internal.minorUnits !== external.minorUnits) {
      await this.reconciliationRepository.recordDiscrepancy(
        runId,
        'BALANCE_MISMATCH',
        `Pooled asset account balance mismatch: internal=${internal.minorUnits}, external=${external.minorUnits}`,
        {
          internal: internal.minorUnits.toString(),
          external: external.minorUnits.toString(),
        },
      );
      return 1;
    }
    return 0;
  }
}
