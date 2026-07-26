# Chapter 4 — Double-entry Ledger

## Learning Objectives

- Understand the double-entry invariant: every transaction's debits must
  equal its credits.
- Understand the account/posting/transaction model and why balance must
  be derived from postings, not stored as a mutable column.
- Translate each of Ch. 3's movement types (on-us transfer, off-us
  deposit, off-us withdrawal) into correct debit/credit postings.
- Understand how mistakes are corrected via reversing transactions, never
  edits or deletes.

## Key Concepts

**Why not a `balance` column**
- Overwriting a balance destroys the history needed to answer "what was
  this balance on a given date" (Ch. 1 audit requirement).
- A single mutable number has no way to self-check; a double-entry ledger
  is self-checking because debits must always equal credits.

**The model**
- Account — a bucket the ledger tracks: customer wallet (liability, "we
  owe them"), pooled partner-bank account (asset, "real cash held"), and
  later, revenue-type accounts (Ch. 31).
- Posting — one immutable row: amount, direction (debit/credit), account.
  Never updated or deleted.
- Transaction — a group of 2+ postings for one economic event; total
  debits must equal total credits, or the transaction is invalid.
- Balance is derived (sum of credits minus debits for a liability
  account), never stored as a directly-mutated field. Caching a derived
  balance for read performance is a valid optimization, deferred to
  Ch. 14 (Database Performance).

**Sign convention (from Ch. 2)**
- Liability account (wallet): credit = increase, debit = decrease.
- Asset account (pooled account): debit = increase, credit = decrease.

**Movement types as postings**
- On-us transfer A→B: Debit A's wallet, Credit B's wallet. Only touches
  liability accounts — the pooled asset account is untouched because no
  real money left Cowrie.
- Off-us deposit: Debit pooled account (asset increases), Credit
  customer's wallet (liability increases).
- Off-us withdrawal: Debit customer's wallet (liability decreases),
  Credit pooled account (asset decreases).
- This confirms Ch. 3's on-us/off-us distinction at the ledger level:
  only off-us transactions touch the pooled asset account.

**Correcting mistakes**
- Never edit or delete a posted transaction's postings.
- Post a new transaction with the same accounts/amount but debit and
  credit swapped, referencing the original — the mistake stays visible,
  its effect is neutralized.

## Business Rules

- Every transaction must have total debits equal to total credits before
  it can be considered valid.
- Postings are immutable once created.
- Wallet balances are always computed from postings, never read from or
  written to a standalone mutable balance field.
- Corrections happen via reversing transactions only.

## Definition of Done

- [ ] Can write correct debit/credit postings for a deposit, a
      withdrawal, and an on-us transfer, unprompted.
- [ ] Can explain why balance must be derived, not stored.
- [ ] Can explain why on-us and off-us transactions touch different sets
      of accounts.

## Common Interview Questions

- Why shouldn't a wallet's balance be stored as a directly-updatable
  column?
- Walk through the debit/credit postings for a customer withdrawal.
- What invariant must hold true for every transaction in a double-entry
  ledger?
- How do you correct an incorrectly posted transaction without deleting
  data?

## Further Reading (optional)

- Standard double-entry bookkeeping references (assets/liabilities/equity
  and the accounting equation).
