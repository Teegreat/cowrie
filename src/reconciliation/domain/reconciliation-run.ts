export type ReconciliationDiscrepancyType =
  'STUCK_WITHDRAWAL_RESOLVED' | 'BALANCE_MISMATCH';

export class ReconciliationRun {
  private constructor(
    readonly id: string,
    readonly startedAt: Date,
    readonly completedAt: Date | null,
    readonly discrepancyCount: number,
  ) {}

  static existing(input: {
    id: string;
    startedAt: Date;
    completedAt: Date | null;
    discrepancyCount: number;
  }): ReconciliationRun {
    return new ReconciliationRun(
      input.id,
      input.startedAt,
      input.completedAt,
      input.discrepancyCount,
    );
  }
}
