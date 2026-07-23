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
}
