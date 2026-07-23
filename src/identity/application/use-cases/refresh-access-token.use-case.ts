import { Injectable } from '@nestjs/common';
import { TokenIssuer } from '../ports/token-issuer.port';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { generateRawRefreshToken, hashToken } from '../token-hash.util';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token.constants';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';

@Injectable()
export class RefreshAccessTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const consumed = await this.refreshTokenRepository.consumeValidToken(
      hashToken(rawRefreshToken),
    );

    if (!consumed) {
      throw new DomainException('Invalid or expired refresh token');
    }

    const accessToken = await this.tokenIssuer.issueAccessToken({
      sub: consumed.userId,
    });
    const newRawRefreshToken = generateRawRefreshToken();
    await this.refreshTokenRepository.store({
      userId: consumed.userId,
      hashedToken: hashToken(newRawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  }
}
