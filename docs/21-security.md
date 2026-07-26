# Chapter 21 — Security

## Learning Objectives

- Implement step-up authentication — the mechanism deferred back in
  Ch. 17 — now applied to a genuine high-risk action (revealing a full
  BVN).
- Add rate limiting specifically to password-verification endpoints
  (login, register, step-up), not just a flat global limit.
- Add Helmet security headers.
- Understand why CORS, CSRF, and SQL injection each need a different
  kind of attention — some requiring new code, some requiring an audit
  confirming the architecture already handles them.

## Key Concepts

**Why step-up needs its own short-lived token, not a session flag**
- Encoding "recently verified" as its own stateless token (rather than
  mutating some session store) is consistent with how access tokens
  already work — no new server-side session state needed. 5-minute
  expiry because its only job is proving "the password was just
  re-entered."

**Why the `type: 'step-up'` claim matters as much as the signature**
- An access token and a step-up token share the same signing secret, so
  a stolen access token could be replayed as a step-up token if all
  `StepUpGuard` checked was signature validity. The `type` claim (never
  present on an access token) is what actually distinguishes them.

**The concrete high-risk action: revealing a full BVN**
- `Profile.bvn`/`nin` are Cowrie's most sensitive data. `StepUpGuard` is
  built generically and applied here first — the same guard is meant to
  protect Transfers (Ch. 28) and anything else genuinely high-risk
  later, per the note from Ch. 17.

**Rate limit the endpoints attackers actually target**
- Login, register, and step-up are all password-verification points —
  tightened to 5 requests/minute, below the global default of 10/minute
  for the rest of the API.

**CORS, CSRF, SQL injection — addressed on their own terms**
- CORS: not configured yet, deliberately — no frontend exists to
  restrict origins for.
- CSRF: doesn't apply to a bearer-token API the way it does to
  cookie-session apps — a malicious site can't make the browser attach
  an `Authorization` header on your behalf, unlike a cookie.
- SQL injection: audited, not assumed — every raw query (Ch. 16's `FOR
  UPDATE`, Ch. 20's transaction) uses Prisma's parameterized tagged
  templates, never string concatenation.

## File Changes

```
src/identity/
  application/
    ports/
      token-issuer.port.ts (add issueStepUpToken)
    use-cases/
      step-up.use-case.ts
      reveal-bvn.use-case.ts
  infrastructure/
    auth/
      jwt-token-issuer.ts (implement issueStepUpToken)
  interface/
    dto/
      step-up.dto.ts
    guards/
      step-up.guard.ts
    identity.controller.ts (add POST /identity/step-up)
    profile.controller.ts (add GET /identity/profile/bvn/reveal)
src/main.ts (helmet)
src/app.module.ts (ThrottlerModule, APP_GUARD)
```

## Setup

```bash
npm install @nestjs/throttler helmet
```

`src/app.module.ts`:
```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    LedgerModule,
    PrismaModule,
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

`src/main.ts`:
```ts
import helmet from 'helmet';
// ...
app.use(helmet());
```

## Step-Up Authentication

`src/identity/application/ports/token-issuer.port.ts`:
```ts
export abstract class TokenIssuer {
  abstract issueAccessToken(payload: { sub: string }): Promise<string>;
  abstract issueStepUpToken(payload: { sub: string }): Promise<string>;
}
```

`src/identity/infrastructure/auth/jwt-token-issuer.ts` — add:
```ts
  issueStepUpToken(payload: { sub: string }): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, type: 'step-up' },
      { expiresIn: '5m' },
    );
  }
```

`src/identity/interface/guards/step-up.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-step-up-token'];

    if (!token) {
      throw new ForbiddenDomainException('This action requires step-up verification');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload.type !== 'step-up' || payload.sub !== request.user?.id) {
        throw new Error('mismatch');
      }
      return true;
    } catch {
      throw new ForbiddenDomainException(
        'Step-up verification expired or invalid — please re-authenticate',
      );
    }
  }
}
```

`src/identity/interface/dto/step-up.dto.ts`:
```ts
import { IsString } from 'class-validator';

export class StepUpDto {
  @IsString()
  password!: string;
}
```

`src/identity/application/use-cases/step-up.use-case.ts`:
```ts
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

  async execute(userId: string, password: string): Promise<{ stepUpToken: string }> {
    const user = await this.userRepository.findById(userId);
    const invalid = () => new ForbiddenDomainException('Incorrect password');
    if (!user) throw invalid();

    const valid = await this.passwordHasher.verify(password, user.hashedPassword);
    if (!valid) throw invalid();

    const stepUpToken = await this.tokenIssuer.issueStepUpToken({ sub: userId });
    return { stepUpToken };
  }
}
```

`src/identity/application/use-cases/reveal-bvn.use-case.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { NotFoundDomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class RevealBvnUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(userId: string): Promise<{ bvn: string }> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundDomainException('Profile not found');
    }
    return { bvn: profile.bvn.value };
  }
}
```

`identity.controller.ts` — add:
```ts
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('step-up')
  stepUp(@Body() dto: StepUpDto, @CurrentUser() user: { id: string }) {
    return this.stepUpUseCase.execute(user.id, dto.password);
  }
```
(add the same `@Throttle(...)` to `login` and `register`)

`profile.controller.ts` — add:
```ts
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @Get('bvn/reveal')
  revealBvn(@CurrentUser() user: { id: string }) {
    return this.revealBvn.execute(user.id);
  }
```

Register `StepUpUseCase`, `RevealBvnUseCase`, `StepUpGuard` in `identity.module.ts`.

## APIs Implemented

- `POST /identity/step-up` — `{ password }` → `{ stepUpToken }` (5-minute
  expiry). Rate-limited to 5/minute.
- `GET /identity/profile/bvn/reveal` — requires both a valid access
  token and a valid `X-Step-Up-Token` header → returns the full,
  unmasked BVN.

## Business Rules

- Revealing a full BVN requires a step-up token issued within the last
  5 minutes, in addition to normal authentication.
- A step-up token must carry `type: 'step-up'` and match the currently
  authenticated user's id — signature validity alone is not sufficient.
- Login, register, and step-up are rate-limited more tightly (5/minute)
  than the rest of the API (10/minute default).

## Definition of Done

- [ ] `StepUpGuard` + step-up token issuance implemented and tagged.
- [ ] `GET /identity/profile/bvn/reveal` requires both tokens.
- [ ] Login/register/step-up rate-limited tighter than the global default.
- [ ] Helmet active.
- [ ] Verified: reveal without step-up → 403; step-up with correct
      password → token issued; reveal with that token → full BVN;
      step-up with wrong password → 403, no token; 6 rapid bad logins →
      6th is rate-limited (429).

## Common Interview Questions

- What is step-up authentication, and why isn't a normal valid session
  enough for some actions?
- Why does a step-up token need its own `type` claim rather than
  relying on JWT signature validity alone?
- Why is CSRF not a meaningful concern for a bearer-token API, and when
  would it become one again?
- How does Prisma's `$queryRaw` protect against SQL injection,
  concretely?

## Further Reading (optional)

- OWASP: Cross-Site Request Forgery, SQL Injection Prevention Cheat Sheets.
- NestJS documentation: Rate Limiting (`@nestjs/throttler`), Helmet.
