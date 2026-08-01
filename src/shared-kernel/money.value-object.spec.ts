import { Money } from './money.value-object';

describe('Money', () => {
  describe('construction', () => {
    it('creates a valid Money from integer minor units and a 3-letter currency', () => {
      const money = Money.of(150000n, 'NGN'); // ₦1,500.00 in kobo
      expect(money.toString()).toBe('1500.00 NGN');
    });

    it('rejects a currency code that is not a 3-letter ISO code', () => {
      expect(() => Money.of(1000n, 'naira')).toThrow(
        'Currency must be a 3-letter ISO code',
      );
    });
  });

  describe('add', () => {
    it('adds two Money values in the same currency', () => {
      const a = Money.of(1000n, 'NGN');
      const b = Money.of(500n, 'NGN');
      expect(a.add(b).equals(Money.of(1500n, 'NGN'))).toBe(true);
    });

    it('throws when adding different currencies', () => {
      // This is the actual test for the guard we care about most: it's
      // the one thing standing between this class and silently treating
      // NGN and USD as interchangeable.
      const ngn = Money.of(1000n, 'NGN');
      const usd = Money.of(1000n, 'USD');
      expect(() => ngn.add(usd)).toThrow(
        'Cannot operate on different currencies: NGN vs USD',
      );
    });
  });

  describe('equals', () => {
    it('is true for the same amount and currency', () => {
      expect(Money.of(1000n, 'NGN').equals(Money.of(1000n, 'NGN'))).toBe(true);
    });

    it('is false for a different amount', () => {
      expect(Money.of(1000n, 'NGN').equals(Money.of(2000n, 'NGN'))).toBe(false);
    });

    it('is false for a different currency', () => {
      expect(Money.of(1000n, 'NGN').equals(Money.of(1000n, 'USD'))).toBe(false);
    });
  });
});
