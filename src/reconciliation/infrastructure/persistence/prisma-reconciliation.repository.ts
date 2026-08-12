import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { ReconciliationRepository } from 'src/reconciliation/application/ports/reconciliation-repository.port';
import {
  ReconciliationDiscrepancyType,
  ReconciliationRun,
} from 'src/reconciliation/domain/reconciliation-run';

@Injectable()
export class PrismaReconciliationRepository extends ReconciliationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createRun(): Promise<ReconciliationRun> {
    const created = await this.prisma.reconciliationRun.create({ data: {} });
    return ReconciliationRun.existing(created);
  }

  async recordDiscrepancy(
    runId: string,
    type: ReconciliationDiscrepancyType,
    description: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    await this.prisma.reconciliationDiscrepancy.create({
      data: {
        runId,
        type,
        description,
        // Cast needed because Record<string, unknown> isn't
        // structurally assignable to Prisma's InputJsonValue (unknown
        // isn't guaranteed JSON-safe) — same fix as AuditLog's repository.
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async completeRun(
    runId: string,
    discrepancyCount: number,
  ): Promise<ReconciliationRun> {
    const updated = await this.prisma.reconciliationRun.update({
      where: { id: runId },
      data: {
        completedAt: new Date(),
        discrepancyCount,
      },
    });
    return ReconciliationRun.existing(updated);
  }
}
