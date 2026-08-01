import { DomainException } from './domain-exception';

export class Money {
  // Constructor is private: the only way to get a Money is through
  // Money.of(), which runs validation. This makes an invalid Money
  // unrepresentable rather than something you have to remember to check.
  private constructor(
    private readonly minorUnits: bigint,
    private readonly currency: string,
  ) {}

  static of(minorUnits: bigint, currency: string): Money {
    // No integer check needed anymore — bigint has no fractional
    // representation at all. That's the actual fix: eliminating
    // float/precision bugs by construction, not by validation.

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
    // Display-only conversion to Number — safe here because it's for
    // human-readable formatting, not further arithmetic. Every actual
    // calculation stays in bigint minor units end to end; only the
    // final string for a human ever passes through a float division.
    return `${(Number(this.minorUnits) / 100).toFixed(2)} ${this.currency}`;
  }

  get minorUnitsValue(): bigint {
    return this.minorUnits;
  }

  get currencyCode(): string {
    return this.currency;
  }
}
