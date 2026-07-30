import { Module } from '@nestjs/common';
import { PrismaAuditLogRepository } from './infrastructure/persistence/prisma-audit-log.repository';
import { ListAuditLogsUseCase } from './application/use-cases/list-audit-logs.use-case';
import { AuditController } from './interface/audit.controller';
import { AuditLogRepository } from './application/ports/audit-log-repository.port';

@Module({
  controllers: [AuditController],
  providers: [
    { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
    ListAuditLogsUseCase,
  ],
  exports: [AuditLogRepository], // Identity's use cases will inject this directly
})
export class AuditModule {}
