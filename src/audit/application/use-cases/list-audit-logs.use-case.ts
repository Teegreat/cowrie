import { Injectable } from '@nestjs/common';
import {
  AuditLogFilter,
  AuditLogRepository,
  Pagination,
} from '../ports/audit-log-repository.port';

@Injectable()
export class ListAuditLogsUseCase {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  execute(filter: AuditLogFilter, pagination: Pagination) {
    return this.auditLogRepository.findMany(filter, pagination);
  }
}
