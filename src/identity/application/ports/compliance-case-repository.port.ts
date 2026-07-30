import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export interface ComplianceCaseSummary {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string | null;
  riskScore: number;
  watchlistHits: string[];
  status: 'OPEN' | 'RESOLVED';
  resolvedByUserId: string | null;
  createdAt: Date;
}

export abstract class ComplianceCaseRepository {
  abstract create(
    input: { userId: string; riskScore: number; watchlistHits: string[] },
    ctx?: TransactionContext,
  ): Promise<void>;
  abstract findOpenCases(): Promise<ComplianceCaseSummary[]>;

  abstract findById(caseId: string): Promise<ComplianceCaseSummary | null>;
  // Resolves the case only, atomically guarded so a case can never be
  // resolved twice — returns the subject's userId on success so the
  // caller can update their Profile as a separate step in the same
  // transaction, or null if the case was already resolved. Updating the
  // linked Profile is no longer this repository's job now that a third
  // repository (audit) needs to join the same commit — see Ch. 23.
  abstract resolveIfOpen(
    input: {
      caseId: string;
      notes: string;
      resolvedByUserId: string;
      disposition: 'CLEARED' | 'CONFIRMED_BLOCK';
    },
    ctx: TransactionContext,
  ): Promise<{ userId: string } | null>;
}
