import { AuditAction, AuditLog } from 'src/audit/domain/audit-log';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export interface AuditLogFilter {
  actorUserId?: string;
  action?: AuditAction;
  targetType?: string;
  from?: Date;
  to?: Date;
}

export interface Pagination {
  page: number;
  limit: number;
}

// No update(), no delete() — immutability is enforced by the port's
// shape: there is no method a use case could even call to mutate a row.
export abstract class AuditLogRepository {
  abstract create(log: AuditLog, ctx?: TransactionContext): Promise<void>;
  abstract findMany(
    filter: AuditLogFilter,
    pagination: Pagination,
  ): Promise<{ items: AuditLog[]; total: number }>;
}
