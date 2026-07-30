import { Profile } from 'src/identity/domain/profile';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class ProfileRepository {
  abstract findByUserId(userId: string): Promise<Profile | null>;
  abstract create(profile: Profile, ctx?: TransactionContext): Promise<Profile>;
  abstract update(profile: Profile, ctx?: TransactionContext): Promise<Profile>;
}
