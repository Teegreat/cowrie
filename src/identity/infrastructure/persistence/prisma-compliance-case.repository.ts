import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import {
  ComplianceCaseRepository,
  ComplianceCaseSummary,
} from 'src/identity/application/ports/compliance-case-repository.port';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

@Injectable()
export class PrismaComplianceCaseRepository extends ComplianceCaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    input: { userId: string; riskScore: number; watchlistHits: string[] },
    ctx?: TransactionContext,
  ): Promise<void> {
    const client = (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
    await client.complianceCase.create({ data: input });
  }

  async findOpenCases(): Promise<ComplianceCaseSummary[]> {
    const cases = await this.prisma.complianceCase.findMany({
      where: { status: 'OPEN' },
      include: { user: { include: { profile: true } } },
    });
    return cases.map((c) => this.toSummary(c));
  }

  async findById(caseId: string): Promise<ComplianceCaseSummary | null> {
    const c = await this.prisma.complianceCase.findUnique({
      where: { id: caseId },
      include: { user: { include: { profile: true } } },
    });
    return c ? this.toSummary(c) : null;
  }

  private toSummary(c: {
    id: string;
    userId: string;
    riskScore: number;
    watchlistHits: string[];
    status: 'OPEN' | 'RESOLVED';
    resolvedByUserId: string | null;
    createdAt: Date;
    user: {
      email: string;
      profile: { firstName: string; lastName: string } | null;
    };
  }): ComplianceCaseSummary {
    return {
      id: c.id,
      userId: c.userId,
      userEmail: c.user.email,
      userFullName: c.user.profile
        ? `${c.user.profile.firstName} ${c.user.profile.lastName}`
        : null,
      riskScore: c.riskScore,
      watchlistHits: c.watchlistHits,
      status: c.status,
      resolvedByUserId: c.resolvedByUserId,
      createdAt: c.createdAt,
    };
  }

  async resolveIfOpen(
    input: {
      caseId: string;
      notes: string;
      resolvedByUserId: string;
      disposition: 'CLEARED' | 'CONFIRMED_BLOCK';
    },
    ctx: TransactionContext,
  ): Promise<{ userId: string } | null> {
    const tx = ctx as Prisma.TransactionClient;
    // Conditional update: only matches if still OPEN. Two admins
    // resolving the same case concurrently — the second one gets
    // count: 0 and knows it lost the race, instead of silently
    // overwriting the first admin's determination.
    const result = await tx.complianceCase.updateMany({
      where: { id: input.caseId, status: 'OPEN' },
      data: {
        status: 'RESOLVED',
        resolutionNotes: input.notes,
        resolvedByUserId: input.resolvedByUserId,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    const caseRecord = await tx.complianceCase.findUniqueOrThrow({
      where: { id: input.caseId },
    });
    return { userId: caseRecord.userId };
  }
}
