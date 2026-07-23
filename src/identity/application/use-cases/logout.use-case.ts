import { Injectable } from '@nestjs/common';
import { hashToken } from '../token-hash.util';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  execute(rawRefreshToken: string): Promise<void> {
    return this.refreshTokenRepository.revokeByHashedToken(
      hashToken(rawRefreshToken),
    );
  }
}
