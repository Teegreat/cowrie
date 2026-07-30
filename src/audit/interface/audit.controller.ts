import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/identity/interface/guards/jwt-auth.guard';
import { RolesGuard } from 'src/identity/interface/guards/role.guard';
import { ListAuditLogsUseCase } from '../application/use-cases/list-audit-logs.use-case';
import { Roles } from 'src/identity/interface/decorators/role.decorators';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly listAuditLogsUseCase: ListAuditLogsUseCase) {}

  @Roles('ADMIN')
  @Get('logs')
  list(@Query() query: AuditLogQueryDto) {
    return this.listAuditLogsUseCase.execute(
      {
        actorUserId: query.actorUserId,
        action: query.action,
        targetType: query.targetType,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { page: query.page, limit: query.limit },
    );
  }
}
