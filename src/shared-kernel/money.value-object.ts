import { DomainException } from './domain-exception';

export class Money {
  // Constructor is private: the only way to get a Money is through
  // Money.of(), which runs validation. This makes an invalid Money
  // unrepresentable rather than something you have to remember to check.
  private constructor(
    private readonly minorUnits: number,
    private readonly currency: string,
  ) {}

  static of(minorUnits: number, currency: string): Money {
    if (!Number.isInteger(minorUnits)) {
      // Floats lose precision on arithmetic (0.1 + 0.2 !== 0.3 in JS).
      // Integer minor units sidestep that entirely.
      throw new DomainException(
        'Money must be expressed in integer minor units',
      );
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainException('Currency must be a 3-letter ISO code');
    }
    return new Money(minorUnits, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits - other.minorUnits, this.currency);
  }

  equals(other: Money): boolean {
    // Equal by value, not by reference — this is what makes it a value
    // object rather than an entity (Ch. 5).
    return (
      this.minorUnits === other.minorUnits && this.currency === other.currency
    );
  }

  private assertSameCurrency(other: Money): void {
    // Without this guard, NGN and USD amounts could be added together
    // as if they were the same unit — a silent, catastrophic bug.
    if (this.currency !== other.currency) {
      throw new DomainException(
        `Cannot operate on different currencies: ${this.currency} vs ${other.currency}`,
      );
    }
  }

  toString(): string {
    return `${(this.minorUnits / 100).toFixed(2)} ${this.currency}`;
  }
}
