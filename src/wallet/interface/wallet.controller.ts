import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/identity/interface/guards/jwt-auth.guard';
import { CurrentUser } from 'src/identity/interface/decorators/current-user.decorator';
import { GetWalletUseCase } from '../application/use-cases/get-wallet.use-case';
import { Throttle } from '@nestjs/throttler';
import { CreateVirtualAccountDto } from './dto/create-virtual-account.dto';
import { RetryVirtualAccountProvisioningUseCase } from '../application/use-cases/retry-virtual-account-provisioning.use-case';
import type { Request } from 'express';
import { InitiateWithdrawalUseCase } from '../application/use-cases/initiate-withdrawal.use-case';
import { InitiateWithdrawalDto } from './dto/initiate-withdrawal.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly getWallet: GetWalletUseCase,
    private readonly retryVirtualAccountProvisioning: RetryVirtualAccountProvisioningUseCase,
    private readonly initiateWithdrawalUseCase: InitiateWithdrawalUseCase,
  ) {}

  @ApiOperation({ summary: 'Get your own wallet and current balance' })
  @Get('me')
  get(@CurrentUser() user: { id: string }) {
    return this.getWallet.execute(user.id);
  }

  @ApiOperation({
    summary: 'Retry provisioning your virtual account number',
    description:
      'Idempotent — safe to call again if provisioning previously failed. No-op if one already exists.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('me/virtual-account')
  createVirtualAccount(
    @Body() dto: CreateVirtualAccountDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.retryVirtualAccountProvisioning.execute(
      user.id,
      dto.accountName,
      req.ip ?? null,
      req.headers['user-agent'] ?? null,
    );
  }

  @ApiOperation({
    summary: 'Initiate a withdrawal to an external bank account',
    description:
      'Reserves funds immediately, then attempts the external transfer. Requires a client-generated idempotency key.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('withdrawals')
  async initiateWithdrawal(
    @Body() dto: InitiateWithdrawalDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const withdrawal = await this.initiateWithdrawalUseCase.execute({
      userId: user.id,
      amountMinorUnits: BigInt(dto.amountMinorUnits),
      currency: dto.currency,
      destinationAccountNumber: dto.destinationAccountNumber,
      destinationBankCode: dto.destinationBankCode,
      idempotencyKey: dto.idempotencyKey,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return {
      id: withdrawal.id,
      status: withdrawal.status,
      amountMinorUnits: withdrawal.amountMinorUnits.toString(),
      currency: withdrawal.currency,
      destinationAccountNumber: withdrawal.destinationAccountNumber,
      destinationBankCode: withdrawal.destinationBankCode,
      failureReason: withdrawal.failureReason,
    };
  }
}
