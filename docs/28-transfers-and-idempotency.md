# Chapter 28 — Transfers & Idempotency

## Learning Objectives

- Implement the third and final movement type from Ch. 3 — the on-us
  transfer — as a single atomic ledger transaction, no saga needed.
- Resolve a transfer recipient by phone number without creating a
  circular dependency between the Wallet and Identity modules.
- Recognize the common shape shared by every idempotency mechanism
  built so far (Deposit's `externalReference`, Withdrawal's client key)
  and apply the same pattern to Transfers.
- Apply step-up verification to every transfer, unconditionally — the
  decision made back in Ch. 21, finally exercised.

## Key Concepts

**On-us needs no saga**
- Unlike a withdrawal, a transfer never leaves Cowrie's own database —
  there's no external call, so there's no success/failure/unknown
  ambiguity to model. One `TransactionManager.run()`, one ledger
  transaction, done.

**Phone number resolution without a circular module dependency**
- `Identity` already depends on `Wallet` (since Ch. 25, for
  wallet-on-profile-creation). If `Wallet` needed to depend on `Identity`
  too (to look up a phone number on `Profile`), that would be a cycle
  NestJS's DI container doesn't support cleanly. The fix: denormalize
  `phoneNumber` onto `Wallet` itself, set once at creation time by
  whichever caller already has it in scope (`CreateProfileUseCase`,
  `ResolveComplianceCaseUseCase` — both already fetch the `Profile`).
  `Wallet` becomes self-sufficient for resolving its own recipients.

**Idempotency is one pattern, not three**
- Every idempotency mechanism built across Ch. 26-28 has the identical
  shape: a unique key, checked first, returning the original result
  instead of re-executing on a match. What differs is only *who supplies
  the key* and *why* — an external system's own reference (Deposit) vs.
  a client-supplied key protecting against the client's own retry
  (Withdrawal, Transfer). That's why no shared "idempotency framework"
  was built — three bespoke unique columns are more honest than one
  abstraction covering meaningfully different failure modes.

**Step-up, unconditionally**
- Confirmed back in Ch. 21 against real reference-app behavior: Kuda,
  Moniepoint, and OPay all require transaction PIN entry on every
  transfer, with no amount threshold. `StepUpGuard` — generic since
  Ch. 21, built once, reused here without modification — is applied to
  `POST /wallets/transfers` with no exception.

## Folder/File Changes

```
src/wallet/domain/transfer.ts                            (new)
src/wallet/application/ports/transfer-repository.port.ts (new)
src/wallet/application/use-cases/initiate-transfer.use-case.ts (new)
src/wallet/infrastructure/persistence/prisma-transfer.repository.ts (new)
src/wallet/interface/dto/initiate-transfer.dto.ts         (new)
src/wallet/domain/wallet.ts                               (updated — phoneNumber)
src/wallet/application/ports/wallet-repository.port.ts    (updated — findByPhoneNumber)
src/wallet/infrastructure/persistence/prisma-wallet.repository.ts (updated)
src/wallet/application/use-cases/create-wallet.use-case.ts (updated signature)
src/identity/application/use-cases/create-profile.use-case.ts (updated call site)
src/identity/application/use-cases/resolve-complaince-case.use-case.ts (updated call site)
src/wallet/interface/wallet.controller.ts                 (updated — new endpoint)
src/wallet/wallet.module.ts                               (updated wiring)
```

## Database Changes

`Wallet` gains a required, unique `phoneNumber`. New `Transfer` model,
with two named relations back to `Wallet` (sender/recipient).
`AuditAction` gains `TRANSFER_SENT` — all three places (Prisma enum,
domain TS union, query DTO list).

```prisma
model Wallet {
  // ...existing fields
  phoneNumber       String     @unique
  sentTransfers     Transfer[] @relation("TransferSender")
  receivedTransfers Transfer[] @relation("TransferRecipient")
}

model Transfer {
  id                  String   @id @default(uuid())
  senderWalletId      String
  senderWallet        Wallet   @relation("TransferSender", fields: [senderWalletId], references: [id])
  recipientWalletId   String
  recipientWallet     Wallet   @relation("TransferRecipient", fields: [recipientWalletId], references: [id])
  amountMinorUnits    BigInt
  currency            String
  idempotencyKey      String   @unique
  ledgerTransactionId String
  narration           String?
  createdAt           DateTime @default(now())

  @@index([senderWalletId])
  @@index([recipientWalletId])
}
```
Existing `Wallet` rows have no `phoneNumber` value — cleared as
disposable dev data before migrating (same approach as Ch. 22/24):
```bash
psql -d cowrie_dev -c 'DELETE FROM "VirtualAccount"; DELETE FROM "Deposit"; DELETE FROM "Withdrawal"; DELETE FROM "Wallet";'
npx prisma migrate dev --name add_transfers_and_wallet_phone
```

## APIs Implemented

- `POST /wallets/transfers` — `{ recipientPhoneNumber, amountMinorUnits, currency, narration?, idempotencyKey }`. Requires `Authorization` (JWT) and `X-Step-Up-Token`. Settles instantly.

## Business Rules

- A transfer is a single atomic ledger transaction — no saga, no
  external call, no `PROCESSING` state.
- Recipients are resolved by phone number against `Wallet.phoneNumber`
  — a denormalized copy, not a live cross-module lookup.
- A wallet cannot transfer to itself.
- Every transfer requires step-up verification, unconditionally.
- A retried request with the same idempotency key returns the original
  transfer, never re-executes.

## Deferred (named, not built here)

- Idempotency key expiry (production systems typically expire these
  after ~24h) — needs a scheduled cleanup job, Ch. 34/35.
- Transaction history/statements listing a wallet's transfers — Ch. 31.
- Transfer limits (daily/per-transaction caps) — Ch. 31.

## Definition of Done

- [ ] Schema migrated (`Wallet.phoneNumber`, `Transfer` model,
      `AuditAction` extended in all three places).
- [ ] `Wallet`/`Transfer` domain, both repositories,
      `InitiateTransferUseCase` implemented.
- [ ] `CreateWalletUseCase` and both its callers updated for the new
      `phoneNumber` parameter.
- [ ] `POST /wallets/transfers` guarded by step-up, unconditionally.
- [ ] Verified: on-us posting correctness, step-up enforcement,
      self-transfer rejection, idempotent retry, insufficient-balance
      guard still fires.

## Common Interview Questions

- Why does an on-us transfer need no saga, unlike a withdrawal?
- Why is the recipient's phone number denormalized onto `Wallet`
  instead of looked up live from Identity on every transfer?
- Why does every transfer require step-up, with no amount threshold?
- What's the common shape shared by Deposit's, Withdrawal's, and
  Transfer's idempotency mechanisms — and why doesn't Cowrie need a
  generic idempotency framework to implement all three?

## Further Reading (optional)

- Stripe idempotency key documentation — expiry window and scoping.
