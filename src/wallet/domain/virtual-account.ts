export class VirtualAccount {
  private constructor(
    readonly id: string | undefined,
    readonly walletId: string,
    readonly accountNumber: string,
    readonly bankName: string,
    readonly bankCode: string,
    readonly createdAt: Date,
  ) {}

  static open(input: {
    walletId: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
  }): VirtualAccount {
    return new VirtualAccount(
      undefined,
      input.walletId,
      input.accountNumber,
      input.bankName,
      input.bankCode,
      new Date(),
    );
  }

  static existing(input: {
    id: string;
    walletId: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
    createdAt: Date;
  }): VirtualAccount {
    return new VirtualAccount(
      input.id,
      input.walletId,
      input.accountNumber,
      input.bankName,
      input.bankCode,
      input.createdAt,
    );
  }
}
