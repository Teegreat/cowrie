import { randomUUID } from 'crypto';

// Kept as an independent TS union (not imported from Prisma's generated
// client) for the same reason KycTier/ScreeningStatus are — the domain
// layer doesn't depend on generated infrastructure code.
export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_LOGGED_IN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGGED_OUT'
  | 'PROFILE_CREATED'
  | 'KYC_TIER_UPGRADED'
  | 'COMPLIANCE_CASE_RESOLVED'
  | 'BVN_REVEALED'
  | 'WALLET_CREATED';

export class AuditLog {
  private constructor(
    readonly id: string,
    readonly actorUserId: string | null,
    readonly actorEmail: string | null,
    readonly action: AuditAction,
    readonly targetType: string | null,
    readonly targetId: string | null,
    readonly metadata: Record<string, unknown> | null,
    readonly ipAddress: string | null,
    readonly userAgent: string | null,
    readonly createdAt: Date,
  ) {}

  // Identity is assigned here, client-side, not by a DB default — the
  // domain owns the entry the moment it's recorded, before it's ever
  // persisted, which is what lets one AuditLog instance be handed to
  // a repository call inside a transaction that might still roll back.
  static record(input: {
    actorUserId: string | null;
    actorEmail: string | null;
    action: AuditAction;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
  }): AuditLog {
    return new AuditLog(
      randomUUID(),
      input.actorUserId,
      input.actorEmail,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.metadata ?? null,
      input.ipAddress,
      input.userAgent,
      new Date(),
    );
  }

  static existing(input: {
    id: string;
    actorUserId: string | null;
    actorEmail: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }): AuditLog {
    return new AuditLog(
      input.id,
      input.actorUserId,
      input.actorEmail,
      input.action as AuditAction,
      input.targetType,
      input.targetId,
      (input.metadata as Record<string, unknown>) ?? null,
      input.ipAddress,
      input.userAgent,
      input.createdAt,
    );
  }
}
