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
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { RolesGuard } from './interface/guards/role.guard';
import { CreateProfileUseCase } from './application/use-cases/create-profile.use-case';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpgradeToTier2UseCase } from './application/use-cases/upgrade-to-tier2.use-case';
import { UpgradeToTier3UseCase } from './application/use-cases/upgrade-to-tier3.use-case';
import { ProfileRepository } from './application/ports/profile-repository.port';
import { PrismaProfileRepository } from './infrastructure/persistence/prisma-profile.repository';
import { ProfileController } from './interface/profile.controller';
import { ComplainceController } from './interface/compliance.controller';
import { ListComplianceCaseUseCase } from './application/use-cases/list-compliance-case.use-case';
import { ResolveComplianceCaseUseCase } from './application/use-cases/resolve-complaince-case.use-case';
import { ComplianceCaseRepository } from './application/ports/compliance-case-repository.port';
import { PrismaComplianceCaseRepository } from './infrastructure/persistence/prisma-compliance-case.repository';
import { SanctionsScreeningGateway } from './application/ports/sanctions-screening-gateway.port';
import { MockSanctionsScreeningGateway } from './infrastructure/mock-sanctions-screening.gateway';
import { StepUpUseCase } from './application/use-cases/step-up.use.case';
import { RevealBvnUseCase } from './application/use-cases/reveal-bvn.use-case';
import { StepUpGuard } from './interface/guards/step-up.guard';

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
  controllers: [IdentityController, ProfileController, ComplainceController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshAccessTokenUseCase,
    LogoutUseCase,
    ListUsersUseCase,
    GetUserByIdUseCase,
    CreateProfileUseCase,
    GetProfileUseCase,
    UpgradeToTier2UseCase,
    UpgradeToTier3UseCase,
    ListComplianceCaseUseCase,
    ResolveComplianceCaseUseCase,
    StepUpUseCase,
    RevealBvnUseCase,
    StepUpGuard,
    JwtStrategy,
    RolesGuard,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    { provide: ProfileRepository, useClass: PrismaProfileRepository },
    {
      provide: ComplianceCaseRepository,
      useClass: PrismaComplianceCaseRepository,
    },
    {
      provide: SanctionsScreeningGateway,
      useClass: MockSanctionsScreeningGateway,
    },
  ],
  exports: [UserRepository],
})
export class IdentityModule {}
