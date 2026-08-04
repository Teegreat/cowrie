export class Wallet {
  private constructor(
    readonly id: string | undefined,
    readonly userId: string,
    readonly accountId: string,
    readonly currency: string,
    readonly createdAt: Date,
  ) {}

  // Same shape as User.register() (Ch. 17) — id is undefined until the
  // repository persists it and hands back the real one via existing().
  static open(input: {
    userId: string;
    accountId: string;
    currency: string;
  }): Wallet {
    return new Wallet(
      undefined,
      input.userId,
      input.accountId,
      input.currency,
      new Date(),
    );
  }

  static existing(input: {
    id: string;
    userId: string;
    accountId: string;
    currency: string;
    createdAt: Date;
  }): Wallet {
    return new Wallet(
      input.id,
      input.userId,
      input.accountId,
      input.currency,
      input.createdAt,
    );
  }
}