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
  abstract create(input: {
    userId: string;
    riskScore: number;
    watchlistHits: string[];
  }): Promise<void>;
  abstract findOpenCases(): Promise<ComplianceCaseSummary[]>;

  abstract findById(caseId: string): Promise<ComplianceCaseSummary | null>;
  // Returns false if the case was already resolved (race-condition guard) —
  // true means it resolved this case AND updated the linked Profile,
  // atomically, in one transaction.
  abstract resolveAndUpdateProfile(input: {
    caseId: string;
    notes: string;
    resolvedByUserId: string;
    disposition: 'CLEARED' | 'CONFIRMED_BLOCK';
  }): Promise<boolean>;
}
