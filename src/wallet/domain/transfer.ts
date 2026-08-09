export class Transfer {
  private constructor(
    readonly id: string | undefined,
    readonly senderWalletId: string,
    readonly recipientWalletId: string,
    readonly amountMinorUnits: bigint,
    readonly currency: string,
    readonly idempotencyKey: string,
    readonly ledgerTransactionId: string,
    readonly narration: string | null,
    readonly createdAt: Date,
  ) {}

  static record(input: {
    senderWalletId: string;
    recipientWalletId: string;
    amountMinorUnits: bigint;
    currency: string;
    idempotencyKey: string;
    ledgerTransactionId: string;
    narration: string | null;
  }): Transfer {
    return new Transfer(
      undefined,
      input.senderWalletId,
      input.recipientWalletId,
      input.amountMinorUnits,
      input.currency,
      input.idempotencyKey,
      input.ledgerTransactionId,
      input.narration,
      new Date(),
    );
  }

  static existing(input: {
    id: string;
    senderWalletId: string;
    recipientWalletId: string;
    amountMinorUnits: bigint;
    currency: string;
    idempotencyKey: string;
    ledgerTransactionId: string;
    narration: string | null;
    createdAt: Date;
  }): Transfer {
    return new Transfer(
      input.id,
      input.senderWalletId,
      input.recipientWalletId,
      input.amountMinorUnits,
      input.currency,
      input.idempotencyKey,
      input.ledgerTransactionId,
      input.narration,
      input.createdAt,
    );
  }
}
