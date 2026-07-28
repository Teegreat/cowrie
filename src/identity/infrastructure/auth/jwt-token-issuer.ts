import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuer } from 'src/identity/application/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuer extends TokenIssuer {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  issueAccessToken(payload: { sub: string }): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  issueStepUpToken(payload: { sub: string }): Promise<string> {
    // `type` matters as much as the signature itself.
    return this.jwtService.signAsync(
      { ...payload, type: 'step-up' },
      { expiresIn: '5m' },
    );
  }
}
