import { Injectable } from '@nestjs/common';
import {
  SanctionsScreeningGateway,
  ScreeningResult,
} from '../application/ports/sanctions-screening-gateway.port';

@Injectable()
export class MockSanctionsScreeningGateway extends SanctionsScreeningGateway {
  screen(input: { lastName: string }): Promise<ScreeningResult> {
    const lastName = input.lastName.toUpperCase();
    if (lastName === 'SANCTIONED') {
      return Promise.resolve({
        riskScore: 10,
        watchlistHits: ['MOCK-OFAC-SDN'],
      });
    }
    if (lastName === 'LOWSCORE') {
      return Promise.resolve({ riskScore: 50, watchlistHits: [] });
    }
    return Promise.resolve({ riskScore: 95, watchlistHits: [] });
  }
}
