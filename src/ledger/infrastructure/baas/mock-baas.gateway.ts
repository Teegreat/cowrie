import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  BaaSGateway,
  ExternalTransferOutcome,
  VirtualAccountDetails,
} from 'src/ledger/application/ports/baas-gateway.port';

const MOCK_BANK_CODE = '999'; // fictious - not a real CBN sort code
const MOCK_BANK_NAME = 'Cowrie MFB (Mock)';

@Injectable()
export class MockBaaSGateway extends BaaSGateway {
  ping(): Promise<string> {
    // Stands in for a real network call to a BaaS sandbox (Ch. 29).
    // No `async` keyword needed since there's nothing to await yet —
    // the Promise<string> return type is what matters for the future
    // swap, not this keyword.
    return Promise.resolve('pong from mock BaaS');
  }

  createVirtualAccount(input: {
    reference: string;
    accountName: string;
  }): Promise<VirtualAccountDetails> {
    // Deterministic, derived from the reference — calling this twice
    // for the same wallet always returns the same number, mimicking a
    // real BaaS partner's idempotent account creation.
    const serial = this.deriveSerial(input.reference);
    const accountNumber = this.buildNuban(serial);
    return Promise.resolve({
      accountNumber,
      bankCode: MOCK_BANK_CODE,
      bankName: MOCK_BANK_NAME,
    });
  }

  private deriveSerial(reference: string): string {
    const hash = createHash('sha256').update(reference).digest('hex');
    const numeric = BigInt('0x' + hash.slice(0, 12)) % 1_000_000_000n; // 10-digit number
    return numeric.toString().padStart(9, '0');
  }

  private buildNuban(serial: string): string {
    // Mirrors the published NIBSS NUBAN checksum format (weighted
    // mod-10 over the 3-digit bank code + 9-digit serial, producing one
    // check digit) purely so a mock number *looks* and *behaves* like a
    // real one locally. In production this entire calculation belongs
    // to the BaaS partner — Cowrie never mints real NUBANs.
    const digits = `${MOCK_BANK_CODE}${serial}`.split('').map(Number);
    const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0);
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    return `${serial}${checkDigit}`;
  }

  initiateExternalTransfer(input: {
    idempotencyKey: string;
    amountMinorUnits: bigint;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
  }): Promise<ExternalTransferOutcome> {
    const suffix = input.destinationAccountNumber.slice(-2);
    if (suffix === '01') {
      return Promise.resolve({
        status: 'FAILED',
        reason: 'Account name mismatch',
      });
    }
    if (suffix === '02') {
      return Promise.resolve({ status: 'UNKNOWN' });
    }
    return Promise.resolve({
      status: 'SUCCESSFUL',
      externalReference: `MOCK-${input.idempotencyKey}`,
    });
  }
}
