import { User } from 'src/identity/domain/user';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract create(user: User, ctx?: TransactionContext): Promise<User>;
}
