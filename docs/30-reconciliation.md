# Chapter 30 — Reconciliation

## Learning Objectives

- Implement systematic detection of drift between Cowrie's own ledger
  and reality at the BaaS partner.
- Finally wire up the "resolved by querying actual status later"
  mechanism Ch. 3/27 promised but never had a caller for.
- Reuse Ch. 27's `SettleWithdrawalUseCase`/`ReleaseWithdrawalUseCase`
  from a third entry point, proving they were built generically enough
  to not care whether they're invoked synchronously, from a webhook, or
  from a reconciliation job.

## Key Concepts

**Why reconciliation exists at all**
- Every system in the chain — Cowrie's app, the network, the BaaS
  partner's own systems — can fail independently. A webhook can get
  lost; a process can crash mid-flow. None of Ch. 27-29's atomicity
  guarantees protect against "the notification that was supposed to
  tell us never arrived." Reconciliation is the systematic check that
  catches exactly that failure class — not trusting the happy path, but
  periodically asking "does reality actually match what I think
  happened?"

**An honest scope cut, stated up front**
- Full deposit-completeness reconciliation ("did every real deposit get
  credited") needs a bulk transaction-listing capability never
  confirmed against Anchor's real docs in Ch. 29 — only individual
  lookups were verified. Rather than fabricate an unconfirmed bulk
  endpoint, this chapter builds the two checks that *are* grounded in
  confirmed capability (stuck-withdrawal requery, balance comparison)
  and names deposit reconciliation as deferred until that endpoint is
  actually confirmed.

**Reconciliation resolves, it doesn't invent new resolution logic**
- `ReconcileStuckWithdrawalsUseCase` calls the exact same
  `SettleWithdrawalUseCase`/`ReleaseWithdrawalUseCase` from Ch. 27,
  unchanged. This is the same validation point as Ch. 29's webhook
  handler reusing them — those use cases were built generically enough
  from the start to not need modification for a third caller.

**A requery result of `UNKNOWN` is not a discrepancy**
- If a stuck withdrawal is requeried and still comes back `PENDING`
  (mapped to `UNKNOWN`), that's not something reconciliation flags — the
  transfer is genuinely, legitimately still in flight. Only a
  *resolved* requery (`SUCCESSFUL`/`FAILED`) that the system didn't
  already know about counts as a discrepancy worth recording.

## Folder/File Additions

```
src/reconciliation/domain/reconciliation-run.ts
src/reconciliation/application/ports/reconciliation-repository.port.ts
src/reconciliation/application/use-cases/reconcile-stuck-withdrawals.use-case.ts
src/reconciliation/application/use-cases/reconcile-balance.use-case.ts
src/reconciliation/application/use-cases/run-reconciliation.use-case.ts
src/reconciliation/infrastructure/persistence/prisma-reconciliation.repository.ts
src/reconciliation/interface/reconciliation.controller.ts
src/reconciliation/reconciliation.module.ts
```

## Database Changes

New `ReconciliationRun`/`ReconciliationDiscrepancy` models and a
`ReconciliationDiscrepancyType` enum. `AuditAction` gains
`RECONCILIATION_RUN_COMPLETED` — all three places (Prisma enum,
`audit-log.ts`'s TS union, `AuditLogQueryDto`'s list).

```prisma
enum ReconciliationDiscrepancyType {
  STUCK_WITHDRAWAL_RESOLVED
  BALANCE_MISMATCH
}

model ReconciliationRun {
  id               String   @id @default(uuid())
  startedAt        DateTime @default(now())
  completedAt      DateTime?
  discrepancyCount Int      @default(0)
  discrepancies    ReconciliationDiscrepancy[]
}

model ReconciliationDiscrepancy {
  id          String                         @id @default(uuid())
  runId       String
  run         ReconciliationRun              @relation(fields: [runId], references: [id])
  type        ReconciliationDiscrepancyType
  description String
  metadata    Json?
  createdAt   DateTime                       @default(now())

  @@index([runId])
}
```
```bash
npx prisma migrate dev --name add_reconciliation
```

## Port Changes

`BaaSGateway` gains `checkTransferStatus(reference)` and
`getAccountBalance()`. `checkTransferStatus` is implemented for real in
`AnchorBaaSGateway` (built on the confirmed `by-reference` endpoint from
Ch. 29); `getAccountBalance` is left as an honest stub there (endpoint
not independently confirmed). Both are fully implemented in
`MockBaaSGateway`, designed to be testable in both the "discrepancy
found" and "clean" directions via `MOCK_BAAS_ACCOUNT_BALANCE_MINOR_UNITS`.

`WithdrawalRepository` gains `findAllProcessing()`.

## APIs Implemented

- `POST /admin/reconciliation/run` — `ADMIN`-only. Requeries every
  `PROCESSING` withdrawal and checks the pooled asset account balance
  against the BaaS partner; returns the completed `ReconciliationRun`.

## Business Rules

- Reconciliation never edits a withdrawal directly — it calls the same
  `SettleWithdrawalUseCase`/`ReleaseWithdrawalUseCase` every other entry
  point uses.
- A withdrawal still `UNKNOWN` on requery is left exactly where it is.
- Every reconciliation run is recorded and audited, whether or not it
  found anything.
- Reconciliation is manually triggered — no automatic scheduling exists
  yet.

## Deferred (named, not built here)

- Deposit-completeness reconciliation — needs a bulk transaction-listing
  endpoint not yet confirmed against Anchor's real API.
- Automatic/scheduled reconciliation runs — Ch. 34/35.
- `AnchorBaaSGateway.getAccountBalance()`'s real endpoint — confirm
  against your own sandbox once you have access.

## Definition of Done

- [ ] `BaaSGateway` extended; both new methods implemented in
      `MockBaaSGateway`; `checkTransferStatus` implemented for real in
      `AnchorBaaSGateway`.
- [ ] `ReconciliationRun`/`ReconciliationDiscrepancy` schema, repository,
      and all three use cases implemented.
- [ ] `POST /admin/reconciliation/run` guarded to `ADMIN` only.
- [ ] `WalletModule` exports `SettleWithdrawalUseCase`/
      `ReleaseWithdrawalUseCase` for `ReconciliationModule` to use.
- [ ] Verified: stuck withdrawal resolution, balance-mismatch detection
      (both flagged and clean paths), audit trail, RBAC guard.

## Common Interview Questions

- Why does reconciliation call the exact same settlement/release use
  cases as the synchronous and webhook paths, rather than its own
  resolution logic?
- Why is deposit-completeness reconciliation deferred here instead of
  built against an assumed bulk-listing endpoint?
- What's the difference between a withdrawal still `UNKNOWN` after a
  reconciliation requery versus a genuine discrepancy?
- Why is reconciliation manually triggered in this chapter rather than
  scheduled?

## Further Reading (optional)

- [Anchor Verify Transfer](https://docs.getanchor.co/docs/verify-transfer-1) — the `by-reference` endpoint this chapter's real requery is built on.
