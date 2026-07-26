# Chapter 9 — Microservices Preparation

## Learning Objectives

- Identify the three couplings that defeat a module's extractability even
  when folder boundaries (Ch. 8) are clean: shared tables, shared
  transactions, leaked internal types.
- Resolve Ch. 8's open question: Wallets must read Ledger's balance
  through an exported service call, never a shared table.
- Understand how to design an exported interface so it could become a
  network call later without redesign.
- Understand why boundary-enforcement tooling is premature with only
  one real module.

## Key Concepts

**The three couplings**
1. Shared database tables — a module's tables must be as private as its
   code; no cross-module reads, not even read-only joins.
2. Shared database transactions — each module commits its own
   transaction independently; cross-module consistency needs are
   handled as eventual consistency (events, retries, reconciliation),
   formalized in Ch. 10 (Outbox/Saga).
3. Leaked internal types — exported methods return plain DTOs only,
   never domain entities or ORM models, so callers never couple to a
   module's internal representation.

**Designing for eventual network portability**
- Arguments/return values: plain serializable data, never class
  instances with behavior or ORM entities.
- Methods return `Promise`s even when nothing is async yet.
- Callers never assume success from a shared-transaction rollback
  safety net that a real network call wouldn't have.
- This is Ch. 6's ports-and-adapters pattern one level up: the exported
  interface is the port; in-process today, HTTP/event-based later are
  interchangeable adapters.

**What this chapter is not**
- Not splitting into real microservices now.
- Not introducing boundary-enforcement tooling (e.g.
  eslint-plugin-boundaries) — worth it once 3-4 real modules exist to
  tempt shortcuts between them, not with just Ledger + shared-kernel.

## Business Rules

- No module may read or write another module's database tables directly,
  including read-only queries.
- No database transaction may span writes belonging to two different
  modules.
- Exported module interfaces exchange DTOs only — never domain entities,
  aggregates, or ORM models.

## Definition of Done

- [ ] Can name the three couplings that defeat extractability, unprompted.
- [ ] Can explain why Wallets querying Ledger's tables directly would be
      wrong, even read-only.
- [ ] Can describe the shape of Ledger's first real exported method
      (e.g. `getAccountBalance(accountId): Promise<AccountBalanceDto>`)
      without writing it yet, since nothing needs it today.

## Common Interview Questions

- What makes a modular monolith module actually extractable into a
  microservice later, beyond folder structure?
- Why is sharing a database transaction across two modules a problem?
- Why should an exported service method return a DTO instead of a
  domain entity or ORM model?
- When would you introduce boundary-enforcement tooling, and why not
  before then?

## Further Reading (optional)

- Sam Newman, "Monolith to Microservices" — extraction patterns and
  preconditions.
