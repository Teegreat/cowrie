import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../ports/ledger-repository.port';
import { DomainException } from 'src/shared-kernel/domain-exception';

// Mirrors Money's currency validation — Account isn't wrapped in Money
// (there's no amount here, just a currency code), so this is a small,
// deliberate duplication rather than a new shared abstraction for one line.
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  execute(input: {
    name: string;
    accountType: 'ASSET' | 'LIABILITY';
    currency: string;
  }): Promise<string> {
    if (!CURRENCY_CODE_PATTERN.test(input.currency)) {
      throw new DomainException('Currency must be a 3-letter ISO code');
    }
    return this.ledgerRepository.createAccount(input);
  }
}
