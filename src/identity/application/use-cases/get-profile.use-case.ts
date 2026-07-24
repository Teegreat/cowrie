import { PublicProfile } from 'src/identity/domain/profile';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';
import { ProfileRepository } from '../ports/profile-repository.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string): Promise<PublicProfile> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundDomainException(
        'Profile not found — complete your profile first',
      );
    }
    return profile.toPublicProfile();
  }
}
