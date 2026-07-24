import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { Profile, PublicProfile } from 'src/identity/domain/profile';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class CreateProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

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
    const created = await this.profileRepository.create(Profile.create(input));
    return created.toPublicProfile();
  }
}
