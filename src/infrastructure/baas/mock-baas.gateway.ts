import { Injectable } from '@nestjs/common';
import { BaaSGateway } from 'src/application/ports/baas-gateway.port';

@Injectable()
export class MockBaaSGateway extends BaaSGateway {
  ping(): Promise<string> {
    // Stands in for a real network call to a BaaS sandbox (Ch. 29).
    // No `async` keyword needed since there's nothing to await yet —
    // the Promise<string> return type is what matters for the future
    // swap, not this keyword.
    return Promise.resolve('pong from mock BaaS');
  }
}
