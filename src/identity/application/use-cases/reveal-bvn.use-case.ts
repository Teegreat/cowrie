import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class RevealBvnUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string): Promise<{ bvn: string }> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundDomainException('Profile not found');
    }
    // The one deliberate place the full, unmasked value is ever returned.
    return { bvn: profile.bvn.value };
  }
}
