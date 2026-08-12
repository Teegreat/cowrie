import {
  ReconciliationDiscrepancyType,
  ReconciliationRun,
} from 'src/reconciliation/domain/reconciliation-run';

export abstract class ReconciliationRepository {
  abstract createRun(): Promise<ReconciliationRun>;
  abstract recordDiscrepancy(
    runId: string,
    type: ReconciliationDiscrepancyType,
    description: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void>;
  abstract completeRun(
    runId: string,
    discrepancyCount: number,
  ): Promise<ReconciliationRun>;
}
