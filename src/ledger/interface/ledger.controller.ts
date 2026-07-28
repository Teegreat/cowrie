import { Body, Controller, Get, Post } from '@nestjs/common';
import { CheckBaasConnectionUseCase } from '../application/use-cases/check-baas-connection.use-case';
import { CheckMoneyDto } from './dto/check-money.dto';
import { Money } from 'src/shared-kernel/money.value-object';
import { PostTransactionDto } from './dto/post-transaction.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateAccountUseCase } from '../application/use-cases/create-account.use-case';
import { PostTransactionUseCase } from '../application/use-cases/post-transaction.use-case';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('ledger')
@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly checkBaasConnection: CheckBaasConnectionUseCase,
    private readonly createAccount: CreateAccountUseCase,
    private readonly postTransaction: PostTransactionUseCase,
  ) {}

  @ApiOperation({ summary: 'Health-check the (mocked) BaaS gateway wiring' })
  @Get('baas-check')
  async baasCheck() {
    // Controller only translates HTTP <-> use case. No business logic,
    // not even an `if` on the ping result, belongs here.
    return {
      status: await this.checkBaasConnection.execute(),
    };
  }

  @ApiOperation({ summary: 'Validate and format a Money amount + currency' })
  @Post('money-check')
  moneyCheck(@Body() dto: CheckMoneyDto) {
    // Money.of() throws DomainException on an invalid currency format —
    // the DTO already guaranteed minorUnits is an int and currency is a
    // 3-char string, so anything that throws here is a business-rule
    // violation, not a shape problem.
    const money = Money.of(dto.minorUnits, dto.currency);
    return { formatted: money.toString() };
  }

  @ApiOperation({ summary: 'Create a ledger account (ASSET or LIABILITY)' })
  @Post('accounts')
  async createAccountEndpoint(@Body() dto: CreateAccountDto) {
    const id = await this.createAccount.execute(dto);
    return { id };
  }

  @ApiOperation({
    summary: 'Post a balanced double-entry transaction',
    description:
      'Total debits must equal total credits across all postings, or the request is rejected.',
  })
  @Post('transactions')
  async postTransactionEndpoint(@Body() dto: PostTransactionDto) {
    // The controller's job: translate raw DTO primitives into real domain
    // types (Money) before the application layer ever sees them.
    const postings = dto.postings.map((posting) => ({
      accountId: posting.accountId,
      money: Money.of(posting.minorUnits, posting.currency),
      direction: posting.direction,
    }));
    const id = await this.postTransaction.execute(postings);
    return { id };
  }
}
