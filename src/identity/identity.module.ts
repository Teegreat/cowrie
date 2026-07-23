import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IdentityController } from './interface/identity.controller';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { PasswordHasher } from './application/ports/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/hashing/argon2-password-hasher';
import { UserRepository } from './application/ports/user-repository.port';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { TokenIssuer } from './application/ports/token-issuer.port';
import { JwtTokenIssuer } from './infrastructure/auth/jwt-token-issuer';
import { RefreshAccessTokenUseCase } from './application/use-cases/refresh-access-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshTokenRepository } from './application/ports/refresh-token-repository.port';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshAccessTokenUseCase,
    LogoutUseCase,
    JwtStrategy,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
  ],
  exports: [UserRepository],
})
export class IdentityModule {}
