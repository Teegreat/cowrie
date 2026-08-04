import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/identity/interface/guards/jwt-auth.guard';
import { CurrentUser } from 'src/identity/interface/decorators/current-user.decorator';
import { GetWalletUseCase } from '../application/use-cases/get-wallet.use-case';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly getWallet: GetWalletUseCase) {}

  @ApiOperation({ summary: 'Get your own wallet and current balance' })
  @Get('me')
  get(@CurrentUser() user: { id: string }) {
    return this.getWallet.execute(user.id);
  }
}
