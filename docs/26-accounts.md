# Chapter 26 — Accounts

## Learning Objectives

- Extend `BaaSGateway` (idle since Ch. 7) with its first real
  capability: provisioning a virtual bank account number (NUBAN) per
  wallet.
- Apply Ch. 10's saga theory concretely for the first time: an external
  call kept deliberately outside the database transaction that creates
  the profile and wallet.
- Understand why Cowrie itself never computes a "real" NUBAN in
  production — that's the BaaS partner's responsibility.

## Key Concepts

**Why the BaaS call happens outside the transaction**
- `CreateProfileUseCase`'s transaction (profile + wallet + audit,
  Ch. 25) is entirely local writes to Cowrie's own database — correct
  to keep atomic. `BaaSGateway.createVirtualAccount()` is a call to a
  system Cowrie doesn't control, that can be slow or fail independently,
  and can't be undone by a Postgres `ROLLBACK`. Holding a DB transaction
  open across a network call is a well-known anti-pattern. This is
  exactly Ch. 10's saga shape: independent, retryable steps, not one
  all-or-nothing rollback.

**Idempotency, applied concretely**
- `CreateVirtualAccountUseCase` checks for an existing `VirtualAccount`
  before calling the gateway, and the mock gateway derives a
  deterministic account number from the wallet's `reference` — calling
  it twice for the same wallet always returns the same number. This
  mirrors how a real BaaS partner would treat retries: same reference,
  same account, never a duplicate.

**A provisioning failure doesn't fail profile creation**
- The wallet is still fully usable for in-app operations without a
  virtual account — only inbound *external* bank transfers need one. So
  a failure here is caught, logged, and left retryable, not surfaced as
  an error on the profile-creation response.

**No proper retry queue yet — a manual endpoint stands in for it**
- `POST /wallets/me/virtual-account` exists specifically because there's
  no async retry infrastructure (BullMQ, Ch. 35) yet. It's an honest,
  minimal stand-in — named as temporary in the business rules, not
  presented as the real solution.

**Cowrie doesn't mint real NUBANs**
- The mock's checksum logic mirrors the published NIBSS NUBAN format
  (weighted mod-10 over a 3-digit bank code + 9-digit serial) purely for
  local realism. In production, the actual BaaS partner (Anchor, Ch. 29)
  generates and owns the real account number — Cowrie only stores and
  displays what comes back.

## Folder/File Additions

```
src/ledger/application/ports/baas-gateway.port.ts       (extended)
src/ledger/infrastructure/baas/mock-baas.gateway.ts      (extended)
src/wallet/domain/virtual-account.ts                     (new)
src/wallet/application/ports/virtual-account-repository.port.ts (new)
src/wallet/application/use-cases/create-virtual-account.use-case.ts (new)
src/wallet/application/use-cases/retry-virtual-account-provisioning.use-case.ts (new)
src/wallet/infrastructure/persistence/prisma-virtual-account.repository.ts (new)
src/wallet/interface/dto/create-virtual-account.dto.ts   (new)
```

## Database Changes

New `VirtualAccount` model (`walletId` unique — one per wallet,
`accountNumber` unique), back-relation added to `Wallet`. `AuditAction`
gains `VIRTUAL_ACCOUNT_CREATED` — remember to add it in all three
places: the Prisma enum, the domain `AuditAction` TS union, and
`AuditLogQueryDto`'s validation list.

```prisma
model VirtualAccount {
  id            String   @id @default(uuid())
  walletId      String   @unique
  wallet        Wallet   @relation(fields: [walletId], references: [id])
  accountNumber String   @unique
  bankName      String
  bankCode      String
  createdAt     DateTime @default(now())
}
```
Purely additive:
```bash
npx prisma migrate dev --name add_virtual_accounts
```

## APIs Implemented

- `GET /wallets/me` — now also returns `virtualAccount: { accountNumber, bankName } | null`.
- `POST /wallets/me/virtual-account` — `{ accountName }` → the virtual
  account, creating it if provisioning previously failed. Idempotent;
  no-op if one already exists. Throttled (5/min).

## Business Rules

- Every wallet gets a virtual account provisioned automatically, as a
  separate step after — never inside — the profile/wallet transaction.
- Virtual account creation is idempotent.
- A provisioning failure never fails profile/wallet creation; it's
  logged and left retryable via the manual endpoint.
- Cowrie never computes a "real" NUBAN in production — this mock's
  checksum exists purely for local realism.

## Deferred (named, not built here)

- Real BaaS integration (Anchor) replacing `MockBaaSGateway` — Ch. 29.
- Proper async retry-with-backoff, replacing the manual retry endpoint
  — Ch. 35 (BullMQ).
- Handling inbound transfers actually arriving at a virtual account
  (webhooks, reconciliation) — Ch. 29/30/37.

## Definition of Done

- [ ] `BaaSGateway.createVirtualAccount` + `MockBaaSGateway`
      implementation.
- [ ] `VirtualAccount` domain, repository, `CreateVirtualAccountUseCase`,
      `RetryVirtualAccountProvisioningUseCase`, controller endpoint.
- [ ] `CreateProfileUseCase` provisions a virtual account after its
      transaction, non-fatally on failure.
- [ ] `GetWalletUseCase` surfaces `virtualAccount`.
- [ ] Schema migrated; `LedgerModule` exports `BaaSGateway` alongside
      `LedgerRepository`.
- [ ] Verified: idempotent creation, non-fatal failure handling, manual
      retry works.

## Common Interview Questions

- Why is the virtual-account provisioning call kept outside the
  database transaction that creates the profile and wallet?
- Why does `createVirtualAccount` need to be idempotent, and how does
  this mock achieve that?
- In production, whose responsibility is computing the NUBAN checksum —
  Cowrie's, or the BaaS partner's?
- What's the difference between this chapter's manual retry endpoint
  and a proper solution, and why isn't the proper solution built yet?

## Further Reading (optional)

- NIBSS NUBAN specification — checksum algorithm and account number
  format.
- Chris Richardson, "Microservices Patterns" — Saga pattern (revisit
  from Ch. 10 with a concrete example now in hand).
