# Chapter 2 — Banking Fundamentals

## Learning Objectives

- Understand Nigerian account identifiers: NUBAN and BVN.
- Understand what a Core Banking System (CBS) is and where Cowrie's own
  ledger sits relative to one.
- Understand how an instant transfer actually clears via NIBSS/NIP, and
  why "instant" and "settled" are two different timelines.
- Understand the CBN licensing landscape at a high level.
- Internalize the accounting fact that deposits are liabilities, not
  assets, from the holding institution's side — this sets the sign
  convention for Chapter 4's double-entry ledger.

## Key Concepts

**Account identifiers**
- NUBAN — standardized 10-digit Nigerian account number with a checksum,
  enabling reliable cross-bank routing.
- BVN — a single biometric-linked identifier shared across every Nigerian
  bank/fintech a person uses. Central to KYC (Ch. 19–20).

**Core Banking System (CBS) vs Cowrie's sub-ledger**
- The partner bank's CBS is the legally authoritative ledger of account
  balances.
- Cowrie runs a sub-ledger ("shadow ledger") tracking each customer's
  claim on the pooled account — derivative of, and reconciled against
  (Ch. 30), the partner bank's CBS.
- If the two disagree, the CBS wins by definition; reconciliation is how
  drift gets caught and corrected.

**NIBSS / NIP — how an instant transfer clears**
1. Partner bank submits the transfer to NIBSS via NIP.
2. NIBSS routes it to the recipient bank's CBS, which credits the
   recipient — this part is genuinely fast.
3. Net settlement between the banks (actual reserve movement at the CBN
   level) happens later, in batches.
- The customer-visible transfer and the interbank settlement are two
  different events on two different timelines — the same pattern Cowrie's
  own internal transfers will follow in Ch. 3.

**Licensing landscape (high level only)**
- CBN issues different license categories (commercial bank, microfinance
  bank, mobile money operator, PSB, switching/processing licenses, etc.).
- Cowrie needs a partner holding one of these via BaaS. Deeper detail
  deferred to Ch. 31 (transaction limits).

**Deposits are liabilities, not assets**
- From the bank's own books: a customer deposit increases the bank's cash
  asset but also creates a liability (money owed to the customer).
- A customer's balance is therefore a *credit balance* from the bank's
  perspective — "increasing a wallet" will be modeled as a credit in
  Ch. 4's double-entry system, not a debit.

## Business Rules

- Cowrie's ledger is a sub-ledger, not a system of record equivalent to a
  CBS — it must reconcile against the partner bank's actual balance.
- Any transfer has two timelines: a customer-visible "instant" result and
  a slower underlying settlement — these must never be conflated in
  design.

## Definition of Done

- [ ] Can state, unprompted, why deposits are liabilities on the holding
      institution's books.
- [ ] Can explain the instant-transfer/settlement split in your own words.
- [ ] Can explain why Cowrie's ledger needs reconciliation against the
      partner bank's CBS.

## Common Interview Questions

- What's the difference between a Core Banking System and an in-house
  fintech ledger?
- How does NIP achieve "instant" transfers when interbank settlement
  isn't actually instant?
- Why is BVN significant for KYC in the Nigerian market?
- Why is a customer's account balance a liability, not an asset, on the
  bank's balance sheet?

## Further Reading (optional)

- NIBSS instant payment (NIP) overview.
- CBN licensing categories for payments/banking.
