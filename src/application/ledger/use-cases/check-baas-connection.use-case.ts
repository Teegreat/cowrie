import { Injectable } from '@nestjs/common';
import { BaaSGateway } from 'src/application/ports/baas-gateway.port';

@Injectable()
export class CheckBaasConnectionUseCase {
  // Depends on BaaSGateway (the abstraction), never MockBaaSGateway
  // directly — this is the line that makes the whole pattern work.
  constructor(private readonly baas: BaaSGateway) {}

  async execute(): Promise<string> {
    return this.baas.ping();
  }
}
