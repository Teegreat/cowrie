import { LedgerTransaction } from './ledger-transaction';
import { Money } from '../../shared-kernel/money.value-object';

describe('LedgerTransaction.balanced', () => {
  it('accepts a balanced pair of postings', () => {
    const transaction = LedgerTransaction.balanced([
      { accountId: 'a', money: Money.of(1000n, 'NGN'), direction: 'DEBIT' },
      { accountId: 'b', money: Money.of(1000n, 'NGN'), direction: 'CREDIT' },
    ]);
    expect(transaction.postings).toHaveLength(2);
  });

  it('rejects an unbalanced transaction', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000n, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(500n, 'NGN'), direction: 'CREDIT' },
      ]),
    ).toThrow('Transaction does not balance');
  });

  it('rejects mixed currencies', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000n, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(1000n, 'USD'), direction: 'CREDIT' },
      ]),
    ).toThrow('must share one currency');
  });

  it('rejects fewer than two postings', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000n, 'NGN'), direction: 'DEBIT' },
      ]),
    ).toThrow('at least two postings');
  });

  it('preserves precision past Number.MAX_SAFE_INTEGER', () => {
    const huge = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    const transaction = LedgerTransaction.balanced([
      { accountId: 'a', money: Money.of(huge, 'NGN'), direction: 'DEBIT' },
      { accountId: 'b', money: Money.of(huge, 'NGN'), direction: 'CREDIT' },
    ]);
    expect(transaction.postings[0].money.minorUnitsValue).toBe(huge);
  });
});
