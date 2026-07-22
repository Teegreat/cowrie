import { LedgerTransaction } from './ledger-transaction';
import { Money } from '../../shared-kernel/money.value-object';

describe('LedgerTransaction.balanced', () => {
  it('accepts a balanced pair of postings', () => {
    const transaction = LedgerTransaction.balanced([
      { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
      { accountId: 'b', money: Money.of(1000, 'NGN'), direction: 'CREDIT' },
    ]);
    expect(transaction.postings).toHaveLength(2);
  });

  it('rejects an unbalanced transaction', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(500, 'NGN'), direction: 'CREDIT' },
      ]),
    ).toThrow('Transaction does not balance');
  });

  it('rejects mixed currencies', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(1000, 'USD'), direction: 'CREDIT' },
      ]),
    ).toThrow('must share one currency');
  });

  it('rejects fewer than two postings', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
      ]),
    ).toThrow('at least two postings');
  });
});
