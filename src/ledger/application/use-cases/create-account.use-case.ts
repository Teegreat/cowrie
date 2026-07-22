import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../ports/ledger-repository.port';

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  execute(input: {
    name: string;
    accountType: 'ASSET' | 'LIABILITY';
  }): Promise<string> {
    return this.ledgerRepository.createAccount(input);
  }
}
