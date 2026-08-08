// This is the port. Lives in the application layer because the
// application layer is what decides it needs an external banking
// connection at all. Abstract class, not a TS `interface`, because
// interfaces vanish at runtime and can't be used as a NestJS DI token.

export type ExternalTransferOutcome =
  | { status: 'SUCCESSFUL'; externalReference: string }
  | { status: 'FAILED'; reason: string }
  | { status: 'UNKNOWN' };

export interface VirtualAccountDetails {
  accountNumber: string;
  bankCode: string;
  bankName: string;
}
export abstract class BaaSGateway {
  abstract ping(): Promise<string>;
  abstract createVirtualAccount(input: {
    reference: string;
    accountName: string;
  }): Promise<VirtualAccountDetails>;
  abstract initiateExternalTransfer(input: {
    idempotencyKey: string;
    amountMinorUnits: bigint;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
  }): Promise<ExternalTransferOutcome>;
}
