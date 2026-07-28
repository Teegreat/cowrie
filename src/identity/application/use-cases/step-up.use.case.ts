import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';
import { ForbiddenDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class StepUpUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(
    userId: string,
    password: string,
  ): Promise<{ stepUpToken: string }> {
    const user = await this.userRepository.findById(userId);
    const invalid = () => new ForbiddenDomainException('Incorrect password');
    if (!user) throw invalid();

    const valid = await this.passwordHasher.verify(
      password,
      user.hashedPassword,
    );
    if (!valid) throw invalid();

    const stepUpToken = await this.tokenIssuer.issueStepUpToken({
      sub: userId,
    });
    return { stepUpToken };
  }
}
