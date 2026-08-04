import { Module } from '@nestjs/common';
import { LedgerModule } from 'src/ledger/ledger.module';
import { WalletController } from './interface/wallet.controller';
import { WalletRepository } from './application/ports/wallet-repository.port';
import { PrismaWalletRepository } from './infrastructure/persistence/prisma-wallet.repository';
import { CreateWalletUseCase } from './application/use-cases/create-wallet.use-case';
import { GetWalletUseCase } from './application/use-cases/get-wallet.use-case';

@Module({
  imports: [LedgerModule],
  controllers: [WalletController],
  providers: [
    { provide: WalletRepository, useClass: PrismaWalletRepository },
    CreateWalletUseCase,
    GetWalletUseCase,
  ],
  exports: [CreateWalletUseCase, WalletRepository],
})
export class WalletModule {}
