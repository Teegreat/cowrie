# Chapter 17 — Authentication

## Learning Objectives

- Build a new bounded context (Identity) with the same ports/adapters
  discipline used for Ledger.
- Understand why password hashing algorithms are deliberately slow
  (Argon2 over a fast general-purpose hash).
- Understand why login must return an identical error regardless of
  whether the email or the password was wrong.
- Protect a route with a JWT-based NestJS Guard and prove it end to end.

## Key Concepts

**Why password hashing is deliberately slow**
- A fast hash (e.g. raw `SHA-256(password)`) lets an attacker who steals
  the database try billions of guesses per second. Argon2 (OWASP's
  current recommendation) is deliberately slow and memory-hard, and
  generates/embeds its own salt automatically.

**Why login errors must be generic**
- Returning different messages for "email not found" vs "wrong
  password" lets an attacker enumerate registered emails through the
  login endpoint. Both cases return the identical
  `Invalid email or password`.

**Same ports/adapters pattern as Ledger**
- `PasswordHasher` (port) → `Argon2PasswordHasher` (adapter).
- `TokenIssuer` (port) → `JwtTokenIssuer` (adapter, wraps `@nestjs/jwt`'s
  `JwtService` — the library handles signing mechanics, the port just
  keeps the application layer from depending on which library does that).
- `UserRepository` (port) → `PrismaUserRepository` (adapter).

**Race condition on duplicate email (callback to Ch. 16)**
- The use case's `findByEmail` pre-check is fast and friendly but not
  the real guarantee — two concurrent registrations with the same email
  could both pass it before either commits. The database's `@unique`
  constraint on `User.email` is the actual guarantee;
  `PrismaUserRepository.create` catches the resulting Prisma `P2002`
  error and translates it into a clean `DomainException`, the same
  "translate a raw DB error" move from Ch. 13/15.

**Guards register globally**
- Passport strategies (like `JwtStrategy`) register globally with the
  `passport` library, not per-NestJS-module — so `JwtAuthGuard` will be
  directly importable by other modules later (e.g. Ledger) without
  special export wiring.

**Never leak credentials**
- Register/login responses never include the password or its hash —
  Ch. 11's "don't leak internal representation," applied to credentials.
- Centralized via `User.toPublicProfile()` — the one sanctioned way to
  expose a `User` outward, used by every use case and the JWT strategy,
  so a future careless `return user` can't leak the hash by accident.

**Refresh tokens: short-lived access token + revocable session**
- A JWT can't be revoked before it expires — it's stateless. Access
  token lifetime shortened to `15m` (from an initial `1h`) specifically
  because it's the only lever available for bounding a worst-case
  exposure window.
- A **refresh token** (a random opaque 256-bit value, not a JWT) is
  issued alongside it, stored **hashed** (SHA-256) in a new
  `RefreshToken` table, with a 7-day expiry — this is what makes a
  session actually revocable (logout, or a forced revoke, just deletes
  the row).
- SHA-256 is fine for the refresh token (unlike passwords) because it's
  high-entropy random data, not a guessable secret — the hash only
  avoids storing the raw value, not slowing brute force.
- **Rotation**: every refresh atomically consumes (deletes) the token
  just used and issues a new one — `DELETE ... RETURNING` in one
  statement, which is itself the concurrency-safety mechanism (see
  below). A stolen refresh token is only usable once.
- **Single-active-session policy** (confirmed via Kuda's own published
  behavior — see chat): logging in anywhere revokes all previous
  sessions for that user first, atomically, so at most one refresh
  token is ever valid per user.
- **Two deliberate concurrency-safety techniques, not one**:
  - `replaceAllForUser` (used by login) locks the `User` row with
    `SELECT ... FOR UPDATE` inside a transaction — the Ch. 16 technique
    — because it's a multi-step check-then-act sequence (delete all,
    then insert one).
  - `consumeValidToken` (used by refresh) needs no lock at all: a single
    atomic `DELETE ... FROM "RefreshToken" ... RETURNING` statement is
    the check — only one concurrent caller can ever successfully delete
    a given row, so "did I get a row back" is itself race-free. Two
    different tools for two different shapes of concurrency problem.
- Deliberately **not** implemented yet, each with a named future home:
  sliding-session/inactivity timeout (Ch. 34, Redis — needs a cheap
  per-request touch, not a Postgres write), step-up authentication and
  device-fingerprint binding (Ch. 21, Security — needs a real high-risk
  action to protect first), mobile secure token storage (out of scope —
  client-side mobile work, not backend).

## Folder/File Additions

```
src/identity/
  domain/
    user.ts
  application/
    ports/
      password-hasher.port.ts
      user-repository.port.ts
      token-issuer.port.ts
      refresh-token-repository.port.ts
    use-cases/
      register-user.use-case.ts
      login-user.use-case.ts
      refresh-access-token.use-case.ts
      logout.use-case.ts
    token-hash.util.ts
    refresh-token.constants.ts
  infrastructure/
    hashing/
      argon2-password-hasher.ts
    persistence/
      prisma-user.repository.ts
      prisma-refresh-token.repository.ts
    auth/
      jwt-token-issuer.ts
      jwt.strategy.ts
  interface/
    dto/
      register.dto.ts
      login.dto.ts
      refresh-token.dto.ts
    guards/
      jwt-auth.guard.ts
    decorators/
      current-user.decorator.ts
    identity.controller.ts
  identity.module.ts
```

## Setup

```bash
npm install argon2 @nestjs/jwt @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt
```

`.env` addition (generate a real value, e.g. `openssl rand -hex 32`):
```
JWT_SECRET="replace-with-a-long-random-string"
```

`prisma/schema.prisma` addition:
```prisma
model User {
  id             String         @id @default(uuid())
  email          String         @unique
  hashedPassword String
  createdAt      DateTime       @default(now())
  refreshTokens  RefreshToken[]
}

model RefreshToken {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  hashedToken String   @unique
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([userId])
}
```
```bash
npx prisma migrate dev --name add_user
npx prisma migrate dev --name add_refresh_token
```

## Database Changes

`User` (id, email — unique, hashedPassword, createdAt, refreshTokens
relation). `RefreshToken` (id, userId, hashedToken — unique, expiresAt,
createdAt).

## APIs Implemented

- `POST /identity/register` — `{ email, password }` → `{ id, email }`.
  Rejects a duplicate email with `Email already registered`.
- `POST /identity/login` — `{ email, password }` → `{ accessToken,
  refreshToken }`. Wrong email or wrong password both return the
  identical `Invalid email or password`. Revokes all previous sessions
  for the user first (single-active-session policy).
- `POST /identity/refresh` — `{ refreshToken }` → new
  `{ accessToken, refreshToken }`. Rotates: the token used is
  atomically consumed and cannot be reused. Rejects an invalid/expired/
  already-used token with `Invalid or expired refresh token`.
- `POST /identity/logout` — `{ refreshToken }` → `{ success: true }`.
  Revokes that one refresh token; no access token required, since
  possession of the refresh token is itself sufficient authorization.
- `GET /identity/me` — JWT-protected via `JwtAuthGuard`; `JwtStrategy`
  looks the user up fresh from the database on every request (not
  trusted from the token) and returns `user.toPublicProfile()`
  (`{ id, email }`). Returns 401 with no/invalid token.

## Business Rules

- Passwords are hashed with Argon2 before storage; the plaintext
  password is never persisted or logged.
- Login returns an identical error message regardless of whether the
  email or the password was invalid.
- Email is normalized (trimmed, lowercased) before every lookup or
  write, and enforced unique at the database level.
- No API response ever includes a password or its hash — only
  `User.toPublicProfile()` may cross an API boundary.
- Refresh tokens are stored hashed, never in raw form.
- A refresh token is single-use: refreshing always rotates it; reusing
  a previously-rotated or revoked token is always rejected.
- A successful login revokes every other existing session for that
  user before issuing a new one (single-active-session policy).

## Definition of Done

- [ ] `User`/password hashing/token issuance/refresh-token persistence
      implemented behind ports, matching the Ledger module's pattern.
- [ ] Register, login, refresh, logout, and `/me` all working:
      register hides the password in its response; a duplicate email is
      rejected; login with a wrong password and login with a
      nonexistent email both return the identical error; login returns
      both tokens; refresh rotates and rejects reuse of the old token;
      logout revokes the token it's given; a second login invalidates
      the first login's refresh token; `/me` returns 401 with no token
      and the fresh user profile with a valid one.

## Common Interview Questions

- Why are Argon2/bcrypt preferred over `SHA-256` for password storage?
- Why must a login endpoint return the same error for "user not found"
  and "wrong password"?
- Walk through what happens, end to end, when a valid JWT is sent to a
  guarded route.
- Why does the database need a `UNIQUE` constraint on email if the
  application already checks for duplicates?
- Why can't a JWT be revoked before it expires, and what does a refresh
  token add that a JWT alone can't provide?
- Why is `SHA-256` acceptable for hashing a refresh token but not a
  password?
- Two race conditions were closed in this chapter (concurrent logins,
  concurrent refreshes) using two different techniques — what were they,
  and why did each fit its specific case?

## Further Reading (optional)

- OWASP Password Storage Cheat Sheet.
- NestJS documentation: Authentication (Passport/JWT).
