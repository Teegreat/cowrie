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

@Module({
  imports: [LedgerModule, AuditModule],
  controllers: [WalletController],
  providers: [
    { provide: WalletRepository, useClass: PrismaWalletRepository },

    {
      provide: VirtualAccountRepository,
      useClass: PrismaVirtualAccountRepository,
    },
    CreateWalletUseCase,
    GetWalletUseCase,
    CreateVirtualAccountUseCase,
    RetryVirtualAccountProvisioningUseCase,
  ],
  exports: [CreateWalletUseCase, WalletRepository, CreateVirtualAccountUseCase],
})
export class WalletModule {}
