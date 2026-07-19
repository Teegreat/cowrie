import { Module } from '@nestjs/common';
import { LedgerController } from './interface/ledger.controller';
import { CheckBaasConnectionUseCase } from './application/use-cases/check-baas-connection.use-case';
import { BaaSGateway } from './application/ports/baas-gateway.port';
import { MockBaaSGateway } from './infrastructure/baas/mock-baas.gateway';

@Module({
  controllers: [LedgerController],
  providers: [
    CheckBaasConnectionUseCase,
    // This binding is the entire ports-and-adapters mechanism: anything
    // that injects BaaSGateway gets a MockBaaSGateway instance without
    // knowing that's what it's getting. Swap this one line in Ch. 29.
    { provide: BaaSGateway, useClass: MockBaaSGateway },
  ],
})
export class LedgerModule {}
