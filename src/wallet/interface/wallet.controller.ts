import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/identity/interface/guards/jwt-auth.guard';
import { CurrentUser } from 'src/identity/interface/decorators/current-user.decorator';
import { GetWalletUseCase } from '../application/use-cases/get-wallet.use-case';
import { Throttle } from '@nestjs/throttler';
import { CreateVirtualAccountDto } from './dto/create-virtual-account.dto';
import { RetryVirtualAccountProvisioningUseCase } from '../application/use-cases/retry-virtual-account-provisioning.use-case';
import type { Request } from 'express';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly getWallet: GetWalletUseCase,
    private readonly retryVirtualAccountProvisioning: RetryVirtualAccountProvisioningUseCase,
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
}
