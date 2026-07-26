# Chapter 5 — Domain Modeling

## Learning Objectives

- Distinguish entities from value objects, with fintech examples.
- Understand aggregates and aggregate roots as consistency boundaries
  that enforce invariants structurally, not by convention.
- See how Ch. 4's "debits = credits" rule becomes unbreakable once
  Transaction is modeled as the aggregate root for Postings.
- Understand why Account and Transaction are separate aggregates, and
  why Account does not store its own balance.

## Key Concepts

**Entities vs value objects**
- Entity — identity persists over time independent of attribute changes
  (Customer, Account).
- Value object — no identity, fully defined by attributes, immutable
  (Money: amount + currency bundled together). Prevents mixing
  currencies and centralizes rounding/precision logic (full handling in
  Ch. 24).

**Aggregates and aggregate roots**
- An aggregate is a cluster of entities/value objects treated as one
  consistency unit; all changes go through the aggregate root.
- Transaction is the aggregate root for Postings — there is no path to
  create a lone Posting outside a Transaction, which is what makes
  "debits = credits" structurally unbreakable rather than a remembered
  rule.
- Account is a separate aggregate (identity + rules like frozen/closed
  status) and does NOT store balance as its own data — balance is a
  derived read model computed from the Transaction/Posting aggregate.

**Ubiquitous language**
- Precise, consistent vocabulary (wallet vs account, posting vs
  transaction, on-us vs off-us) used identically in code, docs, and
  conversation prevents conflating distinct concepts — a common source
  of domain bugs.

## Business Rules

- Postings may only be created as part of a Transaction aggregate, which
  enforces total debits = total credits before allowing the transaction
  to exist.
- Account balance is never stored directly on the Account aggregate; it
  is derived from Transaction/Posting data.
- Money is represented as a value object (amount + currency), never a
  bare numeric type.

## Definition of Done

- [ ] Can classify Customer, Account, Transaction, Posting, and Money as
      entity or value object, with justification, unprompted.
- [ ] Can explain why Transaction is the aggregate root for postings.
- [ ] Can explain why Account and Transaction are separate aggregates.

## Common Interview Questions

- What's the difference between an entity and a value object? Give a
  fintech example of each.
- Why should Money be modeled as a value object instead of a plain
  number?
- What is an aggregate root, and how does it enforce an invariant
  "structurally"?
- Why doesn't the Account aggregate store its own balance?

## Open Question (carried forward)

Which aggregate should be responsible for stopping a withdrawal that
would overdraw the account — Account or Transaction? To be resolved
properly in Ch. 16 (Concurrency & Locking) and Ch. 25 (Wallets).

## Further Reading (optional)

- Domain-Driven Design fundamentals: entities, value objects, aggregates,
  aggregate roots.
