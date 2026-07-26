# Chapter 18 — Authorization

## Learning Objectives

- Distinguish authentication (who) from authorization (what you're
  allowed to do) precisely.
- Implement role-based access control (RBAC) via a reusable
  `RolesGuard` + `@Roles()` decorator.
- Implement ownership-based authorization ("only your own resource, or
  an admin") in a use case, and understand why a generic guard doesn't
  fit that kind of conditional rule.
- Extend `DomainException` with typed subclasses so the exception filter
  can map to 403/404, not just 400, without leaking HTTP concerns into
  the application layer.

## Key Concepts

**Authentication vs. authorization**
- Authentication: who are you (Ch. 17, a valid JWT).
- Authorization: what are you allowed to do — asked only after
  authentication succeeds, and a user can be authenticated yet still
  forbidden from a specific action.

**Never let role be client-settable**
- `RegisterDto` never declares a `role` field, so Ch. 11's
  `forbidNonWhitelisted` rejects any attempt to sneak `role: "ADMIN"`
  into a registration payload. Role always defaults to `CUSTOMER`;
  elevation is a separate, protected operation (manual DB update, for
  now — no self-service promotion endpoint exists).

**RBAC vs. ownership — different mechanisms for different rules**
- Fixed-role gate ("must be ADMIN"): `RolesGuard`, a reusable,
  declarative guard.
- Conditional rule ("only your own resource, or an admin"): lives in
  `GetUserByIdUseCase`, not a generic guard, because the logic depends
  on the specific resource being accessed, not just a static role.

**Extending `DomainException` for real HTTP semantics**
- `ForbiddenDomainException` and `NotFoundDomainException` extend
  `DomainException`, staying framework-agnostic (plain `Error`
  subclasses, no NestJS import). `DomainExceptionFilter` now resolves
  403/404/400 by exception type — the only place allowed to know about
  HTTP status codes.
- Known inconsistency, not fixed this chapter: Ledger's existing
  "Account(s) not found" errors (Ch. 15–16) still map to 400; arguably
  should be `NotFoundDomainException` → 404. Optional retrofit, not
  required.

**Fresh-lookup payoff from Ch. 17**
- Because `JwtStrategy.validate()` looks the user up fresh from the
  database on every request instead of trusting the JWT's baked-in
  claims, a role change (e.g. promoting a user to ADMIN) takes effect
  on the very next request — no re-login required. Directly validates
  that design decision from Chapter 17.

## Schema

```prisma
enum UserRole {
  CUSTOMER
  ADMIN
}

model User {
  id             String         @id @default(uuid())
  email          String         @unique
  hashedPassword String
  role           UserRole       @default(CUSTOMER)
  createdAt      DateTime       @default(now())
  refreshTokens  RefreshToken[]
}
```
```bash
npx prisma migrate dev --name add_user_role
```

## File Changes

- `src/shared-kernel/domain-exception.ts` — add `ForbiddenDomainException`,
  `NotFoundDomainException`.
- `src/common/filters/domain-exception.filter.ts` — resolve status code
  by exception type (403/404/400) instead of always 400.
- `src/identity/domain/user.ts` — add `role: UserRole`, threaded through
  `register`/`existing`/`toPublicProfile`.
- `src/identity/application/ports/user-repository.port.ts` — add
  `findAll`.
- `src/identity/infrastructure/persistence/prisma-user.repository.ts` —
  thread `role` through every `User.existing(...)` call; implement
  `findAll`.
- `src/identity/interface/decorators/roles.decorator.ts` (new) — `@Roles()`.
- `src/identity/interface/guards/roles.guard.ts` (new) — `RolesGuard`.
- `src/identity/application/use-cases/list-users.use-case.ts` (new).
- `src/identity/application/use-cases/get-user-by-id.use-case.ts` (new).
- `src/identity/interface/identity.controller.ts` — add `GET /identity/users`
  (admin-only) and `GET /identity/users/:id` (self-or-admin); extend
  `/me`'s type to include `role`.
- `src/identity/identity.module.ts` — register `ListUsersUseCase`,
  `GetUserByIdUseCase`, `RolesGuard`.

## APIs Implemented

- `GET /identity/users` — admin-only (`RolesGuard` + `@Roles('ADMIN')`),
  returns all users' public profiles.
- `GET /identity/users/:id` — a customer may only fetch their own
  profile (`403` otherwise); an admin may fetch any profile; a
  nonexistent id returns `404`.

## Business Rules

- `role` is never accepted as client input at registration; it always
  defaults to `CUSTOMER`.
- A fixed-role authorization rule is enforced by a guard; any rule that
  depends on the specific resource being accessed (ownership) is
  enforced in the use case, never bolted onto a generic guard.
- Every `DomainException` subclass maps to exactly one HTTP status,
  decided only in `DomainExceptionFilter` — application/domain code
  never imports NestJS's HTTP exception classes.

## Definition of Done

- [ ] `User.role` added, defaulting to `CUSTOMER`, rejected as
      registration input by `forbidNonWhitelisted`.
- [ ] `ForbiddenDomainException`/`NotFoundDomainException` added; filter
      maps them to 403/404 respectively.
- [ ] `RolesGuard`/`@Roles()` enforce `GET /identity/users` as
      admin-only.
- [ ] `GetUserByIdUseCase` enforces self-or-admin on
      `GET /identity/users/:id`, including a 404 for a nonexistent id.
- [ ] Verified: a role promotion takes effect on the very next request
      with the same still-valid access token — no re-login needed.

## Common Interview Questions

- What's the difference between authentication and authorization?
- Why isn't ownership-based authorization a good fit for a generic role
  guard?
- Why do `ForbiddenDomainException`/`NotFoundDomainException` extend
  `DomainException` rather than NestJS's own HTTP exceptions?
- Why does a role change take effect without requiring re-login here,
  and what specifically makes that possible?

## Further Reading (optional)

- NestJS documentation: Guards, `Reflector`, custom metadata
  (`SetMetadata`).
- OWASP: Insecure Direct Object Reference (IDOR) / Broken Access Control.
