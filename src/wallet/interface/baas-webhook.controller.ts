import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProcessDepositUseCase } from '../application/use-cases/process-deposit.use-case';
import { SimulateDepositDto } from './dto/simulate-deposit.dto';
import { ForbiddenDomainException } from 'src/shared-kernel/domain-exception';

@ApiTags('baas-webhooks')
@Controller('wallets/deposits')
export class BaasWebhookController {
  constructor(private readonly processDeposit: ProcessDepositUseCase) {}

  @ApiOperation({
    summary: 'Simulated inbound deposit notification',
    description:
      'Stand-in for a real BaaS webhook — proper signature verification/replay protection belong to Ch. 37. Gated by a shared secret, not a customer JWT.',
  })
  @Post('simulate')
  async simulate(
    @Headers('x-baas-webhook-secret') secret: string,
    @Body() dto: SimulateDepositDto,
  ) {
    if (secret !== process.env.BAAS_WEBHOOK_SECRET) {
      throw new ForbiddenDomainException('Invalid webhook secret');
    }
    const deposit = await this.processDeposit.execute({
      virtualAccountNumber: dto.virtualAccountNumber,
      amountMinorUnits: BigInt(dto.amountMinorUnits),
      currency: dto.currency,
      externalReference: dto.externalReference,
    });
    return {
      id: deposit.id,
      walletId: deposit.walletId,
      amountMinorUnits: deposit.amountMinorUnits.toString(),
      currency: deposit.currency,
      externalReference: deposit.externalReference,
    };
  }
}
