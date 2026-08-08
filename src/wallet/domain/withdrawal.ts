export type WithdrawalStatus =
  'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED';

export class Withdrawal {
  private constructor(
    readonly id: string | undefined,
    readonly walletId: string,
    readonly amountMinorUnits: bigint,
    readonly currency: string,
    readonly destinationAccountNumber: string,
    readonly destinationBankCode: string,
    readonly status: WithdrawalStatus,
    readonly idempotencyKey: string,
    readonly externalReference: string | null,
    readonly reservationTransactionId: string,
    readonly resolutionTransactionId: string | null,
    readonly failureReason: string | null,
    readonly createdAt: Date,
    readonly resolvedAt: Date | null,
  ) {}

  static request(input: {
    walletId: string;
    amountMinorUnits: bigint;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    idempotencyKey: string;
    reservationTransactionId: string;
  }): Withdrawal {
    return new Withdrawal(
      undefined,
      input.walletId,
      input.amountMinorUnits,
      input.currency,
      input.destinationAccountNumber,
      input.destinationBankCode,
      'PENDING',
      input.idempotencyKey,
      null,
      input.reservationTransactionId,
      null,
      null,
      new Date(),
      null,
    );
  }

  static existing(input: {
    id: string;
    walletId: string;
    amountMinorUnits: bigint;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    status: WithdrawalStatus;
    idempotencyKey: string;
    externalReference: string | null;
    reservationTransactionId: string;
    resolutionTransactionId: string | null;
    failureReason: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): Withdrawal {
    return new Withdrawal(
      input.id,
      input.walletId,
      input.amountMinorUnits,
      input.currency,
      input.destinationAccountNumber,
      input.destinationBankCode,
      input.status,
      input.idempotencyKey,
      input.externalReference,
      input.reservationTransactionId,
      input.resolutionTransactionId,
      input.failureReason,
      input.createdAt,
      input.resolvedAt,
    );
  }
}
