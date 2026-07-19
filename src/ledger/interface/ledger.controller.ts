import { Controller, Get } from '@nestjs/common';
import { CheckBaasConnectionUseCase } from '../application/use-cases/check-baas-connection.use-case';

@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly checkBaasConnection: CheckBaasConnectionUseCase,
  ) {}

  @Get('baas-check')
  async baasCheck() {
    // Controller only translates HTTP <-> use case. No business logic,
    // not even an `if` on the ping result, belongs here.
    return {
      status: await this.checkBaasConnection.execute(),
    };
  }
}
