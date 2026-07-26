import { Injectable } from '@nestjs/common';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';

@Injectable()
export class ListComplianceCaseUseCase {
  constructor(
    private readonly complianceCaseRepository: ComplianceCaseRepository,
  ) {}

  execute() {
    return this.complianceCaseRepository.findOpenCases();
  }
}
