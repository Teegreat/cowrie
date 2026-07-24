import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { PublicProfile } from 'src/identity/domain/profile';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class UpgradeToTier2UseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(input: {
    userId: string;
    nin: string;
  }): Promise<PublicProfile> {
    const profile = await this.profileRepository.findByUserId(input.userId);
    if (!profile) {
      throw new NotFoundDomainException(
        'Complete your profile before upgrading KYC tier',
      );
    }

    const upgraded = profile.upgradeToTier2(input.nin);
    const saved = await this.profileRepository.update(upgraded);
    return saved.toPublicProfile();
  }
}
