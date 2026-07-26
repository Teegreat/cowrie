# Chapter 1 — Introduction to Fintech

## Learning Objectives

- Explain why a fintech backend can't be treated as a standard CRUD backend.
- Define: ledger, settlement, clearing, KYC/AML, BaaS, idempotency, reconciliation.
- Understand how a wallet/neobank operates without its own banking license.
- Have a concrete product brief to build against for the rest of the course.

## Key Concepts

**Money is not like other data.**
- Financial history is append-only — mistakes are corrected with offsetting
  entries, never edits/deletes. Needed for audit and dispute resolution.
- Idempotency is a default requirement, not an edge case — retries and
  double-taps must never cause double-movement of money.
- Correctness under concurrency is non-negotiable — two simultaneous
  withdrawals must never both succeed if only one can be covered.
- A fintech backend answers to a licensing partner and, ultimately, a
  regulator (CBN, in our case) — not just to product decisions.

**How a wallet/neobank works without a banking license.**
1. Partner with a licensed bank via Banking-as-a-Service (BaaS).
2. Customer funds physically sit in one pooled ("omnibus") account at the
   partner bank.
3. The fintech's own database is the ledger of record for which customer
   owns how much of that pool. A wallet balance is a liability entry backed
   by a claim on the pooled account — not money in a box with the
   customer's name on it.

This is why the double-entry ledger (Ch. 4) precedes wallets (Ch. 25):
the wallet is a read-friendly view over ledger entries, not the source
of truth.

## Vocabulary

| Term | Meaning |
|---|---|
| Ledger | Authoritative debit/credit record of who owns what. |
| Settlement | When money actually moves between institutions. |
| Clearing | Verifying/netting transactions before they settle. |
| KYC / AML | Identity verification / anti-money-laundering monitoring. |
| BaaS | Banking-as-a-Service — bank-like products without a banking license. |
| Idempotency | Repeating an operation has the same effect as doing it once. |
| Reconciliation | Comparing internal ledger against an external source of truth. |

PSP/acquirer/issuer terminology deferred to Ch. 29 (Payment Rails).

## Product Brief — "Cowrie" (working codename)

A digital wallet / neobank backend for the Nigerian market (NGN), used as
the running project for this entire curriculum. US/multi-currency support
is a planned Phase 2 extension after the core NGN system is complete —
not part of the main chapter sequence yet.

Core features (mapped to later chapters):
- Tiered KYC-gated onboarding (Ch. 19–20)
- NGN wallet with double-entry ledger backing (Ch. 4, 25)
- Deposits via bank transfer/card, withdrawals to bank account (Ch. 27, 29)
- Instant transfers between Cowrie users (Ch. 28)
- Statements, limits, fees (Ch. 31)
- Fraud/risk checks (Ch. 40–41)

Backed conceptually by a partner bank via BaaS (simulated in this course
rather than integrated with a real bank in early chapters).

## Business Rules

- All customer funds are represented as ledger liabilities against a pooled
  partner-bank account — never as literal per-customer bank accounts.
- No financial record is ever hard-deleted or mutated in place; corrections
  are offsetting entries.
- Every money-moving operation must be designed to be idempotent by default.

## Definition of Done

- [x] Can explain, unprompted, why a wallet balance is a ledger claim and
      not literal money in an account.
- [x] Can define all seven vocabulary terms above without looking them up.
- [x] Comfortable with the Cowrie product brief as the target system for
      the rest of the course.

## Common Interview Questions

- Why can't payment operations use standard REST CRUD patterns safely?
- What is Banking-as-a-Service and why does it matter for a wallet product?
- What's the difference between settlement and clearing?
- Why is idempotency critical in payment APIs?
- How does a fintech move money without holding a banking license?

## Further Reading (optional)

- CBN tiered KYC framework (for NGN-market KYC tiers, relevant from Ch. 19).
