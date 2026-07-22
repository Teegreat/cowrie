import { DomainException } from 'src/shared-kernel/domain-exception';
import { Money } from 'src/shared-kernel/money.value-object';

export type PostingDirection = 'DEBIT' | 'CREDIT';

export interface PostingInput {
  accountId: string;
  money: Money;
  direction: PostingDirection;
}

export class LedgerTransaction {
  private constructor(readonly postings: PostingInput[]) {}

  // The only way to get a LedgerTransaction is through balanced(), which
  // enforces Ch. 4's invariant — there is no other path to construct one,
  // which is what makes the invariant structural rather than remembered.
  static balanced(postings: PostingInput[]): LedgerTransaction {
    if (postings.length < 2) {
      throw new DomainException('A transaction requires at least two postings');
    }

    const currency = postings[0].money.currencyCode;
    const netMinorUnits = postings.reduce((sum, posting) => {
      if (posting.money.currencyCode !== currency) {
        throw new DomainException(
          'All postings in a transaction must share one currency',
        );
      }
      const signed =
        posting.direction === 'DEBIT'
          ? posting.money.minorUnitsValue
          : -posting.money.minorUnitsValue;
      return sum + signed;
    }, 0);

    if (netMinorUnits !== 0) {
      throw new DomainException(
        `Transaction does not balance: debits and credits differ by ${Math.abs(netMinorUnits)}`,
      );
    }

    return new LedgerTransaction(postings);
  }
}
