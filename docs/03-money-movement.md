# Chapter 3 — Money Movement

## Learning Objectives

- Classify money movement into on-us transfers, off-us deposits, and
  off-us withdrawals.
- Understand why off-us transfers can end in a genuine "unknown" outcome,
  and why that must never be inferred as success or failure.
- Understand why withdrawals must reserve funds before attempting the
  external transfer, not after.
- Understand why transactions need an explicit state machine, not a
  boolean success flag.

## Key Concepts

**Three types of money movement**
1. On-us transfer — wallet-to-wallet inside Cowrie's own ledger. Pure
   ledger operation, no external rail, genuinely instant.
2. Off-us inbound (deposit) — money arrives from an external bank via NIP
   into the pooled account; Cowrie credits the wallet after notification.
3. Off-us outbound (withdrawal) — Cowrie initiates a NIP transfer out of
   the pooled account to an external bank; the ledger must react before
   the money leaves.

**The ambiguous outcome problem**
- An off-us request can resolve as success, failure, or timeout/unknown.
- Unknown must be treated as its own state and resolved by querying
  actual status later — never inferred as success or failure. Idempotency
  keys and status-requery mechanics are covered in Ch. 24.

**Debit-first / reserve-before-send**
- Sequence for withdrawals: reserve funds in Cowrie's own ledger → attempt
  external transfer → resolve reservation based on the real outcome
  (success → convert to debit, failure → release, unknown → keep reserved
  and requery).
- Reversing this order (send first, debit after confirmation) opens a
  window for double-withdrawal on retry. Locking mechanics: Ch. 15.

**Transaction lifecycle**
- States: `PENDING → PROCESSING → SUCCESSFUL | FAILED`, plus `REVERSED`
  for something that succeeded and had to be unwound later.
- A boolean success flag can't represent "unknown" — this is a common
  source of lost or double-sent money in naive payment systems.

## Business Rules

- Every money movement must be classified as on-us, off-us inbound, or
  off-us outbound before processing logic is applied.
- A timeout/no-response outcome must be treated as unknown, never
  defaulted to success or failure.
- Withdrawals must reserve funds before attempting the external transfer.
- Transactions must be modeled as a state machine, not a boolean.

## Definition of Done

- [ ] Can classify a given scenario as on-us, off-us inbound, or off-us
      outbound, unprompted.
- [ ] Can explain why "unknown" must be handled as its own state.
- [ ] Can explain the reserve-before-send sequencing rule and what breaks
      without it.

## Common Interview Questions

- What's the difference between an on-us and an off-us transaction, and
  why does it matter operationally?
- How should a system handle a timeout from a payment rail when it
  doesn't know if the transfer succeeded?
- Why must funds be reserved before attempting an external transfer,
  rather than after?
- Why is a boolean "success" flag insufficient for modeling a financial
  transaction?

## Further Reading (optional)

- NIBSS NIP transaction status/requery mechanics (background for Ch. 24).
