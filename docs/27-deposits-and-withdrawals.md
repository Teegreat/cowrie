# Chapter 27 — Deposits & Withdrawals

## Learning Objectives

- Implement Ch. 3's off-us deposit/withdrawal classification and Ch. 4's
  debit/credit postings for real, for the first time.
- Implement Ch. 10's saga example (Cowrie's off-us withdrawal) as actual
  code: reserve, attempt, resolve.
- Handle all three possible outcomes of an external transfer attempt —
  success, failure, and genuinely unknown — without ever inferring one
  from the others.

## Key Concepts

**Deposits are idempotent notifications, not attempts**
- Money has already arrived by the time a deposit is processed — there
  is no pending/attempt phase the way there is for a withdrawal. The
  only real risk is a redelivered notification double-crediting the
  wallet, guarded by `externalReference @unique` plus a pre-check.

**Withdrawals are a saga, not a transaction**
- Reserve funds locally (commits independently) → attempt the external
  transfer (can succeed, fail, or time out) → resolve based on the real
  outcome. This is Ch. 10's saga pattern, applied concretely for the
  first time: each step commits on its own; there's no single rollback
  spanning the external call.

**Two accounts Cowrie itself owns, not a customer**
- A pooled **ASSET** account (real cash at the BaaS partner) and a
  pending-withdrawals **LIABILITY** account (money committed to leaving,
  not yet gone). Both are singletons, bootstrapped lazily and
  race-safely on first use — no seed script infrastructure exists yet,
  so self-healing creation is the simplest correct option.

**Settlement is a second, independent ledger transaction — not an edit**
- On success, the reservation isn't deleted or updated — a *second*
  transaction moves the amount from pending-withdrawals to the pooled
  asset account. On failure, a *reversing* transaction (Ch. 4) moves it
  back to the customer's wallet. Postings stay immutable throughout.

**`UNKNOWN` is a real, separate state**
- Never inferred as success or failure. A withdrawal that times out
  stays `PROCESSING`, funds stay reserved, and it's left visibly
  unresolved rather than guessed at. Automatic resolution needs a real
  background job — deferred to Ch. 34/35.

**Two different idempotency mechanisms, solving two different problems**
- A client-supplied `idempotencyKey` on withdrawal *requests* prevents
  the client's own retry from creating a second withdrawal.
  `externalReference` uniqueness on *deposits* prevents a redelivered
  notification from double-crediting. They protect against different
  failure modes and aren't interchangeable.

## Folder/File Additions

```
src/ledger/application/pooled-account.service.ts        (new)
src/wallet/domain/deposit.ts                             (new)
src/wallet/domain/withdrawal.ts                          (new)
src/wallet/application/ports/deposit-repository.port.ts  (new)
src/wallet/application/ports/withdrawal-repository.port.ts (new)
src/wallet/application/use-cases/process-deposit.use-case.ts (new)
src/wallet/application/use-cases/initiate-withdrawal.use-case.ts (new)
src/wallet/application/use-cases/attempt-external-transfer.use-case.ts (new)
src/wallet/application/use-cases/settle-withdrawal.use-case.ts (new)
src/wallet/application/use-cases/release-withdrawal.use-case.ts (new)
src/wallet/infrastructure/persistence/prisma-deposit.repository.ts (new)
src/wallet/infrastructure/persistence/prisma-withdrawal.repository.ts (new)
```

## Database Changes

`Account` gains `@@unique([name, currency])` (backs the pooled-account
lookup). New `Deposit` and `Withdrawal` models, plus a `WithdrawalStatus`
enum. `AuditAction` gains `DEPOSIT_RECEIVED`, `WITHDRAWAL_INITIATED`,
`WITHDRAWAL_SUCCEEDED`, `WITHDRAWAL_FAILED` — remember all three places
(Prisma enum, `audit-log.ts`'s TS union, `AuditLogQueryDto`'s list).

```prisma
enum WithdrawalStatus {
  PENDING
  PROCESSING
  SUCCESSFUL
  FAILED
}

model Deposit {
  id                  String   @id @default(uuid())
  walletId            String
  wallet              Wallet   @relation(fields: [walletId], references: [id])
  amountMinorUnits    BigInt
  currency            String
  externalReference   String   @unique
  ledgerTransactionId String
  createdAt           DateTime @default(now())

  @@index([walletId])
}

model Withdrawal {
  id                        String           @id @default(uuid())
  walletId                  String
  wallet                    Wallet           @relation(fields: [walletId], references: [id])
  amountMinorUnits          BigInt
  currency                  String
  destinationAccountNumber  String
  destinationBankCode       String
  status                    WithdrawalStatus @default(PENDING)
  idempotencyKey            String           @unique
  externalReference         String?
  reservationTransactionId  String?
  resolutionTransactionId   String?
  failureReason             String?
  createdAt                 DateTime         @default(now())
  resolvedAt                DateTime?

  @@index([walletId])
}
```

## Repository/Port Changes

- `LedgerRepository.saveTransaction` gains optional `ctx` — its first
  time needing to join an externally-opened transaction, since a
  deposit's ledger posting and its idempotency record must commit
  together.
- `LedgerRepository.findAccountByName(name, currency)` — new, backs the
  pooled-account bootstrap.
- `WalletRepository.findById(walletId)` — new.
- `VirtualAccountRepository.findByAccountNumber(accountNumber)` — new.

## APIs Implemented

- `POST /wallets/deposits/simulate` — stand-in for a real BaaS webhook
  (Ch. 37 builds proper signature verification/replay protection). Gated
  by a shared-secret header for now, not left fully open.
- `POST /wallets/withdrawals` — `{ amountMinorUnits, currency, destinationAccountNumber, destinationBankCode, idempotencyKey }`. Reserves funds, attempts the external transfer, returns the `Withdrawal` (status reflects whatever resolved synchronously; `PROCESSING` if unknown).

## Business Rules

- A deposit notification is idempotent by `externalReference`.
- A withdrawal reserves funds before calling the external gateway —
  never the reverse.
- `SUCCESSFUL` settles; `FAILED` reverses; `UNKNOWN` stays `PROCESSING`,
  never guessed at.
- Every withdrawal request requires a client-supplied idempotency key.
- The pooled asset and pending-withdrawals accounts are singletons,
  bootstrapped lazily and race-safely.

## Deferred (named, not built here)

- Real webhook security for deposit notifications — Ch. 37.
- Automatic requery/resolution of `UNKNOWN` withdrawals — needs real
  background job infrastructure (Ch. 34/35).
- Real BaaS integration — Ch. 29.

## Definition of Done

- [ ] `PooledAccountService` and the two singleton accounts implemented.
- [ ] `BaaSGateway.initiateExternalTransfer` + mock with deterministic
      SUCCESS/FAILED/UNKNOWN triggers (destination account number
      suffix).
- [ ] `Deposit`/`Withdrawal` domain, repositories, and all five use
      cases implemented.
- [ ] Schema migrated; `AuditAction` extended in all three places.
- [ ] Verified: idempotent deposits, reserve-before-send sequencing,
      correct resolution on all three withdrawal outcomes, idempotent
      withdrawal initiation, insufficient-balance guard still fires
      before any external call.

## Common Interview Questions

- Walk through the full lifecycle of a withdrawal, including all three
  possible outcomes of the external call.
- Why must funds be reserved before the external transfer is attempted?
- Why is `UNKNOWN` treated as its own state rather than defaulted to
  success or failure?
- What's the difference between the withdrawal idempotency key and the
  deposit's `externalReference` uniqueness — why are two different
  mechanisms needed?
- Why does settling a withdrawal require a second, separate ledger
  transaction rather than editing the reservation?

## Further Reading (optional)

- Stripe's idempotency key documentation.
- NIBSS NIP transaction status/requery mechanics.
