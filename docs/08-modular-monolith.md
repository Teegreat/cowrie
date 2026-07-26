# Chapter 8 — Modular Monolith

## Learning Objectives

- Define a modular monolith and distinguish it from both a "big ball of
  mud" monolith and microservices.
- Understand why fintech systems often deliberately start as a modular
  monolith (cheap ACID transactions vs. distributed-transaction risk).
- Resolve Ch. 7's open folder-structure question: feature-first at the
  top level, layer-first inside each module.
- Understand shared kernel as the one deliberate exception to module
  privacy, and why it must stay small.
- Restructure the Ledger vertical slice into a self-contained module
  with an explicit public interface.

## Key Concepts

**Modular monolith, defined**
- Single deployable unit (monolith) internally organized into strictly
  bounded modules (modular) that only interact through explicit exported
  interfaces, never by reaching into each other's internals.
- Middle ground: gets microservices' organizational discipline without
  inheriting network failures, distributed transactions, or operational
  overhead before they're actually needed.

**Why now, for Cowrie**
- Ch. 4's debit=credit invariant is cheap to enforce with one ACID
  transaction inside one process/database. True microservices would
  turn that into a distributed-transaction problem (sagas, Ch. 10) —
  unnecessary complexity at this stage.
- Keeping module boundaries clean now is what makes it possible to
  extract a module into a real microservice later (Ch. 9) without a
  rewrite.

**Deciding boundaries**
- Modules map to business capabilities/bounded contexts (Ledger,
  Wallets, Identity/KYC, Notifications), not individual entities.
  `Posting` is Ledger's private implementation detail, not its own
  module.

**Shared kernel**
- A small, deliberate set of code multiple modules agree to depend on —
  `Money` qualifies (used by Ledger now, Wallets/Accounts/Statements
  later). Kept intentionally small; business logic never belongs here.

**Folder structure resolution**
- Feature-first at the top level (`src/<module>/`), layer-first inside
  each module (`domain/`, `application/`, `infrastructure/`,
  `interface/`).
- A module's NestJS `exports` array is its literal public interface —
  everything not exported is private to the module.

## Folder Structure

```
src/
  shared-kernel/
    money.value-object.ts
    money.value-object.spec.ts
  ledger/
    application/
      ports/
        baas-gateway.port.ts
      use-cases/
        check-baas-connection.use-case.ts
    infrastructure/
      baas/
        mock-baas.gateway.ts
    interface/
      ledger.controller.ts
    ledger.module.ts
```

## Business Rules

- No module may import another module's `domain/`, `application/`, or
  `infrastructure/` internals directly — only what that module exports.
- Shared kernel additions must be genuinely universal, low-risk-of-
  divergence concepts (like Money), never business logic.
- A module boundary must correspond to a business capability, not an
  individual entity.

## Definition of Done

- [ ] `Money` moved to `shared-kernel/`.
- [ ] Ledger slice restructured under `src/ledger/` with its own
      domain/application/infrastructure/interface subfolders.
- [ ] `ledger.module.ts` has an explicit `exports` array.
- [ ] Lint, tests, and the live `GET /ledger/baas-check` endpoint all
      still pass after the restructure.

## Common Interview Questions

- What's the difference between a modular monolith and a "big ball of
  mud" monolith?
- Why might a fintech startup deliberately choose a modular monolith
  over microservices at first?
- What is a shared kernel, and why should it stay small?
- How do you decide where one module's boundary ends and another's
  begins?

## Open Question (carried forward)

When Wallets (Ch. 25) needs Ledger's current balance for an account,
should it call Ledger's exported service in-process, or share a database
table directly? Which preserves modular-monolith discipline, and which
quietly reverts to a ball of mud? To be resolved when Wallets is built.

## Further Reading (optional)

- Simon Brown, "Modular Monoliths" — the term's origin and rationale.
- Domain-Driven Design: shared kernel and bounded contexts.
