import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { Profile, PublicProfile } from 'src/identity/domain/profile';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { SanctionsScreeningGateway } from '../ports/sanctions-screening-gateway.port';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';

@Injectable()
export class CreateProfileUseCase {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly screeningGateway: SanctionsScreeningGateway,
    private readonly complianceCaseRepository: ComplianceCaseRepository,
  ) {}

  async execute(input: {
    userId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    bvn: string;
  }): Promise<PublicProfile> {
    const existing = await this.profileRepository.findByUserId(input.userId);
    if (existing) {
      throw new DomainException('Profile already exists for this account');
    }
    const screening = await this.screeningGateway.screen({
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
    });

    const profile = Profile.create({
      ...input,
      riskScore: screening.riskScore,
      watchlistHits: screening.watchlistHits,
    });

    const created = await this.profileRepository.create(profile);

    if (created.screeningStatus !== 'CLEARED') {
      await this.complianceCaseRepository.create({
        userId: created.userId,
        riskScore: screening.riskScore,
        watchlistHits: screening.watchlistHits,
      });
    }

    return created.toPublicProfile();
  }
}
