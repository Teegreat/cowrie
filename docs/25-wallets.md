# Chapter 25 — Wallets

## Learning Objectives

- Build a `Wallet` module connecting `User` (Identity) to `Account`
  (Ledger) — the customer-facing balance, backed by a real double-entry
  account underneath.
- Wire wallet creation as an atomic side effect of KYC profile creation,
  extending Ch. 23's `TransactionManager` across two bounded modules for
  the first time.
- Understand why this specific cross-module side effect doesn't need
  the Outbox pattern from Ch. 10.

## Key Concepts

**Why not the Outbox pattern**
- Outbox solves the *dual-write problem*: reliably notifying a
  genuinely separate system after a local commit. Identity and Wallet
  aren't separate systems — Cowrie is a modular monolith (Ch. 8) with
  one shared Postgres database, so `CreateProfileUseCase` and
  `CreateWalletUseCase` can simply commit inside the same database
  transaction via the same `TransactionManager` from Ch. 23. Outbox
  becomes necessary once Ledger/Wallet is split into an actually
  separate service (Ch. 9) or needs to notify something truly external
  (Ch. 37) — not before.

**Wallet creation is a system side effect, never a user action**
- Matches the real-world pattern (Kuda, Moniepoint, OPay): a Naira
  wallet is provisioned automatically the instant BVN-based Tier 1 KYC
  completes. There is deliberately no `POST /wallets` endpoint — adding
  one would create a second, inconsistent path to the same state.

**A wallet's ledger account is a LIABILITY account**
- A customer's wallet balance is money the platform *owes* them — the
  exact account type Ch. 16/24's insufficient-balance guard was already
  built to protect, now finally exercised for its intended purpose.

**A confirmed sanctions hit withholds wallet creation**
- `CLEARED` and `FLAGGED` (pending manual review) profiles both still
  get a wallet; `BLOCKED` (a direct watchlist hit, Ch. 20) does not.
  Handing a spendable balance to a confirmed sanctions hit before
  compliance has reviewed it would be a real gap, not a theoretical one.

**`TransactionContext` crossing a module boundary for the first time**
- Ch. 23 designed `TransactionContext` as opaque specifically so
  repositories from different modules could join the same transaction
  without either module depending on Prisma types. This chapter is the
  first time that actually happens: `CreateProfileUseCase` (Identity)
  opens the transaction, and `CreateWalletUseCase` (Wallet) — which
  itself calls into `LedgerRepository` (Ledger) — joins it, because all
  three ultimately share the same underlying `PrismaService` singleton.

**Balance stays derived, never stored**
- `GET /wallets/me` computes the balance the same way it's always been
  computed since Ch. 4 — summing postings — via a new, reusable
  `LedgerRepository.getBalance()`, extracted from the insufficient-
  balance check that used to have this logic inlined.

## Folder/File Additions

```
src/wallet/
  domain/
    wallet.ts
  application/
    ports/
      wallet-repository.port.ts
    use-cases/
      create-wallet.use-case.ts
      get-wallet.use-case.ts
  infrastructure/
    persistence/
      prisma-wallet.repository.ts
  interface/
    wallet.controller.ts
  wallet.module.ts
```

## Database Changes

New `Wallet` model (`userId`/`accountId` both unique — one wallet per
user, one account per wallet), with back-relations added to `User` and
`Account`. `AuditAction` enum gains `WALLET_CREATED`.

```prisma
model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  accountId String   @unique
  account   Account  @relation(fields: [accountId], references: [id])
  currency  String
  createdAt DateTime @default(now())
}
```
Purely additive — unlike Ch. 22/24, no dev-data wipe needed:
```bash
npx prisma migrate dev --name add_wallets
```

## Repository Changes

- `LedgerRepository.createAccount` gains an optional `ctx` param, so it
  can join a transaction opened outside the Ledger module.
- `LedgerRepository.getBalance(accountId, ctx?)` — new method,
  extracted from the logic that used to be inlined in `saveTransaction`'s
  insufficient-balance check. That check now calls it instead of
  duplicating the `groupBy` query.
- `LedgerModule` now exports `LedgerRepository` (previously exported
  nothing) so `WalletModule` can inject it.

## APIs Implemented

- `GET /wallets/me` — JWT-protected. Returns
  `{ walletId, currency, minorUnits, balance }`, where `minorUnits` is a
  digit string and `balance` is the `Money.toString()`-formatted value
  — never a raw `bigint` in the response (Ch. 24).

No `POST /wallets` — wallet creation is a side effect of
`POST /identity/profile` succeeding, not a standalone action.

## Business Rules

- At most one wallet per user, enforced at the application layer
  (pre-check) and the database (`Wallet.userId @unique`).
- Wallet creation happens automatically inside the same transaction as
  profile creation — if either fails, both roll back.
- A `BLOCKED` screening result withholds wallet creation; `CLEARED` and
  `FLAGGED` both still get one.
- Wallet currency is fixed at NGN — no multi-currency wallets yet
  (consistent with Ch. 24's deferral).
- Balance is always derived from ledger postings, never stored on the
  `Wallet` row.

## Deferred (named, not built here)

- Retroactively creating a wallet if a `BLOCKED` profile is later
  `CLEARED` via compliance resolution — would need wiring into
  `ResolveComplianceCaseUseCase`, out of this chapter's scope.
- Wallet lifecycle/status (`ACTIVE`/`FROZEN`) — no action exists yet to
  consume it; belongs to whichever chapter first needs to gate on it
  (likely Ch. 28, Transfers).
- Multi-currency wallets — no product requirement yet.

## Definition of Done

- [ ] `Wallet` domain, `WalletRepository` port + Prisma implementation,
      `CreateWalletUseCase`, `GetWalletUseCase`, `WalletController`,
      `WalletModule` implemented.
- [ ] `LedgerRepository.createAccount` accepts optional `ctx`;
      `getBalance` added; `saveTransaction`'s inline check refactored to
      use it.
- [ ] `CreateProfileUseCase` creates a wallet atomically, skipping only
      `BLOCKED` profiles; `WALLET_CREATED` audited.
- [ ] Schema migrated; `LedgerModule` exports `LedgerRepository`;
      `IdentityModule` imports `WalletModule`.
- [ ] Verified: CLEARED/FLAGGED profiles get a wallet, BLOCKED doesn't;
      balance reflects real ledger postings; a forced wallet-creation
      failure rolls back the whole profile-creation transaction.

## Common Interview Questions

- Why doesn't wallet creation as a side effect of profile creation need
  the Outbox pattern from Ch. 10?
- Why is a customer's wallet modeled as a `LIABILITY` account rather
  than an `ASSET`?
- Why does a confirmed sanctions hit (`BLOCKED`) withhold wallet
  creation while a `FLAGGED` result doesn't?
- Why does `TransactionContext` work cleanly across two different
  bounded modules (Identity and Ledger) here?
- Why is there no `POST /wallets` endpoint?

## Further Reading (optional)

- Kuda, Moniepoint, OPay onboarding flows — wallet/account-number
  provisioning relative to BVN verification.
