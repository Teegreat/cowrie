import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { User } from 'src/identity/domain/user';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { generateRawRefreshToken, hashToken } from '../token-hash.util';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token.constants';

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: {
    email: string;
    password: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const normalizedEmail = User.normalizeEmail(input.email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    const invalidCredentials = () =>
      new DomainException('Invalid email or password');

    if (!user) {
      throw invalidCredentials();
    }

    const passwordValid = await this.passwordHasher.verify(
      input.password,
      user.hashedPassword,
    );
    if (!passwordValid) {
      throw invalidCredentials();
    }

    const accessToken = await this.tokenIssuer.issueAccessToken({
      sub: user.id!,
    });

    const rawRefreshToken = generateRawRefreshToken();
    // Single-active-session policy (matches Kuda's real-world model):
    // logging in anywhere invalidates any previous session for this
    // user, atomically, so at most one refresh token ever exists.
    await this.refreshTokenRepository.replaceAllForUser({
      userId: user.id!,
      hashedToken: hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
