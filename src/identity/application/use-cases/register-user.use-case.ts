import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { User } from 'src/identity/domain/user';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: {
    email: string;
    password: string;
  }): Promise<{ id: string; email: string }> {
    const normalizedEmail = User.normalizeEmail(input.email);

    // A fast, friendly pre-check — not the real guarantee. See
    // PrismaUserRepository.create for why.
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new DomainException('Email already registered');
    }

    const hashedPassword = await this.passwordHasher.hash(input.password);
    const user = User.register(normalizedEmail, hashedPassword);
    const created = await this.userRepository.create(user);

    return created.toPublicProfile();
  }
}
