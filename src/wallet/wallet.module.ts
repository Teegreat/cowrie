import { Module } from '@nestjs/common';
import { LedgerModule } from 'src/ledger/ledger.module';
import { WalletController } from './interface/wallet.controller';
import { WalletRepository } from './application/ports/wallet-repository.port';
import { PrismaWalletRepository } from './infrastructure/persistence/prisma-wallet.repository';
import { CreateWalletUseCase } from './application/use-cases/create-wallet.use-case';
import { GetWalletUseCase } from './application/use-cases/get-wallet.use-case';
import { PrismaVirtualAccountRepository } from './infrastructure/persistence/prisma-virtual-account.repository';
import { RetryVirtualAccountProvisioningUseCase } from './application/use-cases/retry-virtual-account-provisioning.use-case';
import { CreateVirtualAccountUseCase } from './application/use-cases/create-virtual-account.use-case';
import { VirtualAccountRepository } from './application/ports/virtual-account-repository.port';
import { AuditModule } from 'src/audit/audit.module';
import { BaasWebhookController } from './interface/baas-webhook.controller';
import { DepositRepository } from './application/ports/deposit-repository.port';
import { PrismaDepositRepository } from './infrastructure/persistence/prisma-deposit.repository';
import { WithdrawalRepository } from './application/ports/withdrawal-repository.port';
import { PrismaWithdrawalRepository } from './infrastructure/persistence/prisma-withdrawal.repository';
import { ProcessDepositUseCase } from './application/use-cases/process-deposit.use-case';
import { InitiateWithdrawalUseCase } from './application/use-cases/initiate-withdrawal.use-case';
import { AttemptExternalTransferUseCase } from './application/use-cases/attempt-external-transfer.use-case';
import { SettleWithdrawalUseCase } from './application/use-cases/settle-withdrawal.use-case';
import { ReleaseWithdrawalUseCase } from './application/use-cases/release-withdrawal.use-case';
import { TransferRepository } from './application/ports/transfer-repository.port';
import { PrismaTransferRepository } from './infrastructure/persistence/prisma-transfer.repository';
import { InitiateTransferUseCase } from './application/use-cases/initiate-transfer.use-case';
import { JwtModule } from '@nestjs/jwt';
import { StepUpGuard } from 'src/identity/interface/guards/step-up.guard';

@Module({
  imports: [
    LedgerModule,
    AuditModule,

    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [WalletController, BaasWebhookController],
  providers: [
    { provide: WalletRepository, useClass: PrismaWalletRepository },

    {
      provide: VirtualAccountRepository,
      useClass: PrismaVirtualAccountRepository,
    },
    { provide: DepositRepository, useClass: PrismaDepositRepository },
    { provide: WithdrawalRepository, useClass: PrismaWithdrawalRepository },
    { provide: TransferRepository, useClass: PrismaTransferRepository },
    CreateWalletUseCase,
    GetWalletUseCase,
    CreateVirtualAccountUseCase,
    RetryVirtualAccountProvisioningUseCase,
    ProcessDepositUseCase,
    InitiateWithdrawalUseCase,
    AttemptExternalTransferUseCase,
    SettleWithdrawalUseCase,
    ReleaseWithdrawalUseCase,
    InitiateTransferUseCase,
    StepUpGuard,
  ],
  exports: [CreateWalletUseCase, WalletRepository, CreateVirtualAccountUseCase],
})
export class WalletModule {}
