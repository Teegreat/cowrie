# Chapter 10 — Distributed Transactions: Outbox & Saga Patterns

## Learning Objectives

- Understand why two-phase commit (2PC) is avoided in modern distributed
  systems.
- Understand the outbox pattern and the dual-write problem it solves.
- Understand the saga pattern: independent committing steps plus
  explicit compensating actions, coordinated via choreography or
  orchestration.
- Recognize Ch. 4's reversing-transaction mechanic as a saga's
  compensating action, and Cowrie's off-us withdrawal (Ch. 3) as an
  already-existing saga.

## Key Concepts

**Why not two-phase commit**
- 2PC is a blocking protocol: if the coordinator crashes between
  "prepare" and "commit," participants hold locks indefinitely.
- Assumes all participants speak the same transaction protocol — breaks
  down when a "participant" is an external API (a partner bank), not
  your own database.

**Outbox pattern — solves the dual-write problem**
- Dual-write problem: updating your own data AND reliably notifying
  someone else are two operations; a crash between them causes silent
  inconsistency.
- Fix: write the event as a row in an outbox table, in the same local
  transaction as the business data change (ordinary local atomicity, no
  distributed coordination needed).
- A separate, asynchronous relay reads unpublished outbox rows and
  delivers them (to a broker, another module, wherever), retrying until
  confirmed, then marks them done.
- Concrete Cowrie example: Ledger posts a `TransactionPosted` event row
  in the same transaction as the ledger postings themselves.

**Saga pattern — coordinating multi-step operations**
- A business operation spanning several independently-committing steps;
  no single rollback — each step needing undone gets an explicit
  compensating action instead.
- Choreography: each step reacts to the previous step's event, no
  central coordinator. Simple for few steps, hard to trace at scale.
- Orchestration: a central orchestrator explicitly calls each step and
  triggers compensations on failure. Easier to reason about; the
  orchestrator becomes a serious component in its own right.

**Cowrie's off-us withdrawal as a saga**
1. Reserve funds in Ledger (local transaction, commits independently).
2. Call the BaaS gateway to send money externally (Ch. 3's
   success/failure/unknown outcome).
3. Resolve: confirmed success → convert reservation to final debit (no
   compensation needed); confirmed failure → compensate by releasing
   the reservation (Ch. 4's reversing transaction, exactly); unknown →
   requery until resolved, don't compensate yet.
- This flow already qualifies as a saga purely because Ch. 3 forced
  reserve-then-send instead of assuming synchronous success.

**Idempotency dependency**
- Both patterns rely on retries (relay retries undelivered rows, saga
  steps may be re-invoked after a crash before their "done" marker is
  recorded), so every step must be safe to run twice with the same
  effect as once. Formalized fully in Ch. 24.

## Business Rules

- Any event a module needs to reliably announce must be written to an
  outbox row in the same local transaction as the data change that
  triggered it — never published as a separate, unguarded step.
- Any multi-step business operation spanning independently-committing
  modules must define an explicit compensating action for every step
  that can fail after a prior step has already committed.
- Every saga step and outbox relay delivery must be idempotent.

## Definition of Done

- [ ] Can explain why 2PC blocks and what that costs in practice,
      unprompted.
- [ ] Can explain the dual-write problem and how the outbox pattern
      avoids it.
- [ ] Can walk through Cowrie's off-us withdrawal as a saga, naming each
      step's compensating action (or lack thereof).
- [ ] Can explain why every saga step and outbox relay must be
      idempotent.

## Common Interview Questions

- Why is two-phase commit generally avoided in modern distributed
  systems?
- What specific problem does the outbox pattern solve, and why can't
  you just publish an event right after committing?
- What's the difference between saga choreography and orchestration?
- Walk through a saga for a payment operation, including what happens
  when a step fails partway through.

## Further Reading (optional)

- Chris Richardson, "Microservices Patterns" — Saga and Transactional
  Outbox chapters.
