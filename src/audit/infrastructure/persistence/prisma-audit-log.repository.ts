import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import {
  type AuditLogFilter,
  AuditLogRepository,
  Pagination,
} from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaAuditLogRepository extends AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async create(log: AuditLog, ctx?: TransactionContext): Promise<void> {
    await this.client(ctx).auditLog.create({
      data: {
        id: log.id,
        actorUserId: log.actorUserId,
        actorEmail: log.actorEmail,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        // Cast is needed because Record<string, unknown> isn't
        // structurally assignable to Prisma's InputJsonValue (unknown
        // isn't guaranteed JSON-safe) — the metadata we build is always
        // a plain JSON-serializable object.
        metadata: (log.metadata ?? undefined) as
          Prisma.InputJsonValue | undefined,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      },
    });
  }

  async findMany(
    filter: AuditLogFilter,
    pagination: Pagination,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      actorUserId: filter.actorUserId,
      action: filter.action,
      targetType: filter.targetType,
      createdAt:
        filter.from || filter.to
          ? { gte: filter.from, lte: filter.to }
          : undefined,
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: records.map((r) => AuditLog.existing(r)),
      total,
    };
  }
}
