import { Injectable } from '@nestjs/common';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class ResolveComplianceCaseUseCase {
  constructor(
    private readonly complainceCaseRepository: ComplianceCaseRepository,
  ) {}

  async execute(
    caseId: string,
    notes: string,
    disposition: 'CLEARED' | 'CONFIRMED_BLOCK',
    resolvedByUserId: string,
  ) {
    const succeeded =
      await this.complainceCaseRepository.resolveAndUpdateProfile({
        caseId,
        notes,
        resolvedByUserId,
        disposition,
      });

    if (!succeeded) {
      throw new NotFoundDomainException(
        'Compliance case not found or already resolved',
      );
    }
  }
}
