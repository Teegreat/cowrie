# Chapter 23 — Audit Logs

## Learning Objectives

- Build an immutable, queryable audit trail for every sensitive
  state-changing action in the Identity module.
- Introduce a proper Unit of Work (`TransactionManager`) abstraction —
  the concrete reason to build it now is that a third repository (the
  audit log) needs to join transactions that previously only involved
  two.
- Understand why immutability here is enforced by *shape* (no
  update/delete method exists anywhere in the port, repository, or
  controller) rather than by a runtime check.

## Key Concepts

**Why Ch. 20's transaction technique doesn't scale to this chapter**
- `resolveAndUpdateProfile` (Ch. 20) opened its own internal
  `$transaction` to update `ComplianceCase` and `Profile` together, all
  inside one repository method. That works for two writes owned by one
  repository call, but breaks down the moment a *third* repository
  (`AuditLogRepository`) needs to write inside the same commit — no
  single repository method can honestly own another repository's table.
- Fix: move transaction ownership up to the use case via a
  `TransactionManager`, and have repository methods become "transaction
  participants" that accept an opaque `TransactionContext` instead of
  opening their own transactions.

**Opaque transaction context, not a leaked Prisma type**
- `TransactionContext = unknown` is passed through application-layer
  code untouched. Only the Prisma-specific repository implementations
  cast it back to `Prisma.TransactionClient`, in exactly one place per
  repository (a small `private client(ctx)` helper). This keeps the
  Dependency Rule intact — the application layer never imports from
  `generated/prisma/client`.

**Audit events are business-meaningful, not HTTP-generic**
- A generic request-logging interceptor would record
  `"PATCH /identity/compliance-cases/abc123"` — technically true, useless
  to an auditor. This chapter's `AuditLog` instead records
  `COMPLIANCE_CASE_RESOLVED` with `{ disposition: 'CLEARED' }` in its
  metadata. Generic HTTP/request observability (who hit which endpoint,
  latency, etc.) is a different concern, deferred to Ch. 45 (Monitoring)
  — don't conflate the two.

**Atomicity between an action and its audit entry**
- Every mutating use case wraps its primary write(s) *and* its audit
  write in one `TransactionManager.run()` call. If the audit insert
  fails, the whole action rolls back — an action that "happened" with
  no record of it happening is treated as a compliance failure, not an
  acceptable degraded mode.

**Immutability enforced by omission**
- There is no `update()`/`delete()` method on `AuditLogRepository`, and
  no `PATCH`/`PUT`/`DELETE` route on `AuditController`. The guarantee
  isn't "we checked a permission and denied it" — it's that no code path
  capable of mutating a row exists at all.

**Client-generated identity**
- `AuditLog.record()` assigns its own `id` via `randomUUID()` rather than
  relying on a Prisma `@default(uuid())`. The domain owns identity the
  moment an entry is recorded, before persistence — consistent with the
  entry being handed to a repository call inside a transaction that
  might still roll back.

**`onDelete: SetNull` on the actor relation**
- An audit trail must outlive the account it describes. If user
  deletion is ever built, it must never cascade-delete history, and it
  must not be blocked by existing audit rows either — `SetNull` is the
  only relation mode that satisfies both.

## Folder/File Additions

```
src/common/transaction/
  transaction-manager.port.ts
  prisma-transaction-manager.ts
  transaction.module.ts

src/audit/
  domain/
    audit-log.ts
  application/
    ports/
      audit-log-repository.port.ts
    use-cases/
      list-audit-logs.use-case.ts
  infrastructure/
    persistence/
      prisma-audit-log.repository.ts
  interface/
    dto/
      audit-log-query.dto.ts
    audit.controller.ts
  audit.module.ts
```

## Database Changes

New `AuditAction` enum and `AuditLog` model (`id` client-generated,
`actorUserId` nullable with `onDelete: SetNull`, `actorEmail`, `action`,
`targetType`/`targetId`, `metadata` JSON, `ipAddress`, `userAgent`,
`createdAt` only — no `updatedAt`). Indexes on `actorUserId`, `action`,
`createdAt` to support the listing endpoint's filters. `User` gains the
back-relation `auditLogs AuditLog[]`.

```prisma
enum AuditAction {
  USER_REGISTERED
  USER_LOGGED_IN
  USER_LOGIN_FAILED
  USER_LOGGED_OUT
  PROFILE_CREATED
  KYC_TIER_UPGRADED
  COMPLIANCE_CASE_RESOLVED
  BVN_REVEALED
}

model AuditLog {
  id          String      @id
  actorUserId String?
  actor       User?       @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  actorEmail  String?
  action      AuditAction
  targetType  String?
  targetId    String?
  metadata    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime    @default(now())

  @@index([actorUserId])
  @@index([action])
  @@index([createdAt])
}
```
```bash
npx prisma migrate dev --name add_audit_log
```

## Repository Changes (Unit of Work retrofit)

- `RefreshTokenRepository.replaceAllForUser` — `ctx` now **mandatory**;
  no longer opens its own `$transaction`, uses the passed-in client for
  its `FOR UPDATE` lock instead.
- `ComplianceCaseRepository.resolveAndUpdateProfile` — **removed**,
  replaced by a plain `updateCaseIfOpen(case, ctx)` (same atomic
  `updateMany({ where: { status: 'OPEN' } })` guard from Ch. 20, against
  `ctx`'s client).
- `ProfileRepository.update`, `ProfileRepository.create`,
  `UserRepository.create` — gain optional `ctx?: TransactionContext`
  (can run standalone or as a transaction participant).
- `AuditLogRepository.create` — optional `ctx?: TransactionContext` for
  the same reason.

## APIs Implemented

- `GET /audit/logs` — `ADMIN`-only, `@ApiTags('audit')`,
  `@ApiBearerAuth()`. Query params: `actorUserId`, `action`,
  `targetType`, `from`, `to`, `page` (default 1), `limit` (default 20,
  max 100). Returns `{ items, total }`.

Every mutating Identity use case now records an entry:

| Use case | Action | Metadata |
|---|---|---|
| Register | `USER_REGISTERED` | — |
| Login (success) | `USER_LOGGED_IN` | — |
| Login (failure) | `USER_LOGIN_FAILED` | attempted email captured as `actorEmail`; `actorUserId` only if the user existed |
| Logout | `USER_LOGGED_OUT` | — |
| Create profile | `PROFILE_CREATED` | — |
| Upgrade to Tier 2/3 | `KYC_TIER_UPGRADED` | `{ fromTier, toTier }` |
| Resolve compliance case | `COMPLIANCE_CASE_RESOLVED` | `{ disposition }` |
| Reveal BVN | `BVN_REVEALED` | `{ profileUserId }` — never the BVN itself |

IP address and user agent are extracted in the interface layer
(`req.ip`, `req.headers['user-agent']`) and passed into each use case as
plain strings, keeping the use cases framework-agnostic.

## Business Rules

- Every audit entry is written atomically with the action it describes;
  a failed audit write rolls back the whole action.
- Audit entries are never updated or deleted.
- `metadata` never contains raw secrets — no passwords, no revealed
  BVN/NIN values, no tokens.
- Reading audit logs requires the `ADMIN` role.
- A failed login is audited the same as a successful one.

## Deferred (named, not built here)

- Async/queued audit writes (Ch. 34/35, Redis/BullMQ) — once there's
  real async infrastructure, so a slow audit insert can't add latency to
  the hot path.
- DB-level immutability (`REVOKE UPDATE, DELETE` on the table from the
  app's DB role, WORM/cold storage) — a genuine production hardening
  step, deferred to the deployment chapters (Ch. 42+). This chapter's
  guarantee is application-level only.
- Generic HTTP request/response observability — a different concern
  from business-meaningful audit events, covered at Ch. 45 (Monitoring).

## Definition of Done

- [ ] `TransactionManager`/`PrismaTransactionManager` implemented;
      `TransactionModule` registered globally.
- [ ] `AuditLog` domain, `AuditLogRepository` port, `PrismaAuditLogRepository`,
      `ListAuditLogsUseCase`, `AuditController`, `AuditModule` implemented.
- [ ] Schema migration run.
- [ ] Every mutating Identity use case writes its audit entry atomically
      with its primary action (or, for `RevealBvnUseCase`, as a single
      standalone write).
- [ ] Verified: forcing an audit-write failure rolls back the whole
      action; non-ADMIN gets 403 on `GET /audit/logs`; no metadata field
      ever contains a raw BVN/NIN/password/token; no route exists that
      can modify or delete an audit row.

## Common Interview Questions

- Why can't Ch. 20's repository-internal `$transaction` approach scale
  once a third repository (audit) needs to join the same commit?
- What does an opaque transaction context buy you architecturally,
  versus passing `Prisma.TransactionClient` directly into your ports?
- Why must an audit write and its corresponding business action be
  atomic, rather than best-effort logging after the fact?
- Why is a generic HTTP-request logging interceptor not a substitute for
  business-meaningful audit events?
- Why is `onDelete: SetNull` the correct choice for the
  `AuditLog → User` relation instead of `Cascade` or `Restrict`?

## Further Reading (optional)

- Martin Fowler, "Unit of Work" pattern (PoEAA).
- Prisma documentation: Interactive Transactions.
