import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../ports/ledger-respository.port';
import {
  LedgerTransaction,
  PostingInput,
} from 'src/ledger/domain/ledger-transaction';

@Injectable()
export class PostTransactionUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  execute(postings: PostingInput[]): Promise<string> {
    // The balance invariant is enforced here, in the domain layer, before
    // the repository ever sees the data — persistence has no business
    // logic of its own to violate.

    const transaction = LedgerTransaction.balanced(postings);
    return this.ledgerRepository.saveTransaction(transaction);
  }
}
