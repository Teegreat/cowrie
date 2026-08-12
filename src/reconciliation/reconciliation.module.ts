import { Module } from '@nestjs/common';
import { LedgerModule } from 'src/ledger/ledger.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { AuditModule } from 'src/audit/audit.module';
import { ReconciliationController } from './interface/reconciliation.controller';
import { ReconciliationRepository } from './application/ports/reconciliation-repository.port';
import { PrismaReconciliationRepository } from './infrastructure/persistence/prisma-reconciliation.repository';
import { ReconcileStuckWithdrawalsUseCase } from './application/use-cases/reconcile-stuck-withdrawals.use-case';
import { ReconcileBalanceUseCase } from './application/use-cases/reconcile-balance.use-case';
import { RunReconciliationUseCase } from './application/use-cases/run-reconciliation.use-case';

@Module({
  imports: [LedgerModule, WalletModule, AuditModule],
  controllers: [ReconciliationController],
  providers: [
    {
      provide: ReconciliationRepository,
      useClass: PrismaReconciliationRepository,
    },
    ReconcileStuckWithdrawalsUseCase,
    ReconcileBalanceUseCase,
    RunReconciliationUseCase,
  ],
})
export class ReconciliationModule {}
