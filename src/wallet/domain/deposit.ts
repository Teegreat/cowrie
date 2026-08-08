export class Deposit {
  private constructor(
    readonly id: string | undefined,
    readonly walletId: string,
    readonly amountMinorUnits: bigint,
    readonly currency: string,
    readonly externalReference: string,
    readonly ledgerTransactionId: string,
    readonly createdAt: Date,
  ) {}

  static record(input: {
    walletId: string;
    amountMinorUnits: bigint;
    currency: string;
    externalReference: string;
    ledgerTransactionId: string;
  }): Deposit {
    return new Deposit(
      undefined,
      input.walletId,
      input.amountMinorUnits,
      input.currency,
      input.externalReference,
      input.ledgerTransactionId,
      new Date(),
    );
  }

  static existing(input: {
    id: string;
    walletId: string;
    amountMinorUnits: bigint;
    currency: string;
    externalReference: string;
    ledgerTransactionId: string;
    createdAt: Date;
  }): Deposit {
    return new Deposit(
      input.id,
      input.walletId,
      input.amountMinorUnits,
      input.currency,
      input.externalReference,
      input.ledgerTransactionId,
      input.createdAt,
    );
  }
}
