import { Profile } from 'src/identity/domain/profile';

export abstract class ProfileRepository {
  abstract findByUserId(userId: string): Promise<Profile | null>;
  abstract create(profile: Profile): Promise<Profile>;
  abstract update(profile: Profile): Promise<Profile>;
}
