import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/identity/interface/guards/jwt-auth.guard';
import { RolesGuard } from 'src/identity/interface/guards/role.guard';
import { RunReconciliationUseCase } from '../application/use-cases/run-reconciliation.use-case';
import { Roles } from 'src/identity/interface/decorators/role.decorators';
import { CurrentUser } from 'src/identity/interface/decorators/current-user.decorator';

@ApiTags('reconciliation')
@ApiBearerAuth()
@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReconciliationController {
  constructor(private readonly runReconciliation: RunReconciliationUseCase) {}

  @ApiOperation({
    summary: 'Manually trigger a reconciliation run (admin only)',
    description:
      'Requeries stuck PROCESSING withdrawals and checks the pooled asset account balance against the BaaS partner. Manual for now — automatic scheduling belongs to Ch. 34/35.',
  })
  @Roles('ADMIN')
  @Post('run')
  run(@CurrentUser() user: { id: string }) {
    return this.runReconciliation.execute(user.id);
  }
}
