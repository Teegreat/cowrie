export interface ScreeningResult {
  riskScore: number;
  watchlistHits: string[];
}

export abstract class SanctionsScreeningGateway {
  abstract screen(input: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    dateOfBirth: Date;
  }): Promise<ScreeningResult>;
}
