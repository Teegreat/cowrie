# Chapter 6 — Clean Architecture

## Learning Objectives

- Understand the Dependency Rule: dependencies point inward, inner
  layers never know about outer layers.
- Understand the four layers: Domain, Application (Use Cases), Interface
  Adapters, Infrastructure.
- Understand ports and adapters, and why they make infrastructure
  (mocked BaaS vs real Anchor, Postgres vs anything else) swappable
  without touching business logic.
- Understand where to draw the line between appropriate use of this
  discipline and overengineering.

## Key Concepts

**The Dependency Rule**
- Source code dependencies point inward only; outer layers depend on
  inner layers, never the reverse.
- Ch. 5's domain aggregates (Transaction, Account, Money) must never
  import Prisma, NestJS, or HTTP libraries — this is what makes them
  unit-testable with zero database or framework boot time.

**The four layers**
1. Domain (Entities) — Ch. 5's aggregates/value objects. Pure business
   rules, no framework, no I/O.
2. Application (Use Cases) — orchestrates domain objects for one
   business operation (e.g. ProcessDeposit, ProcessWithdrawal). Depends
   on interfaces (ports), not concrete implementations.
3. Interface Adapters — HTTP controllers, DTOs, request/response
   mapping. NestJS controllers live here starting Ch. 7.
4. Infrastructure (Frameworks & Drivers) — actual database (Ch. 12–13),
   actual BaaS integration (Ch. 29), actual message broker. Replaceable
   details.

**Ports and adapters**
- A port is an interface the application layer defines for what it
  needs (e.g. BaaSGateway.initiateTransfer).
- An adapter is a concrete implementation of that port (MockBaaSGateway
  now, AnchorBaaSGateway in Ch. 29).
- Because use cases depend only on the port, swapping adapters requires
  zero changes to business logic.

**Avoiding overengineering**
- Reserve explicit ports/use-case discipline for things that touch
  money, cross an external boundary, or need test-doubling.
- Don't build swappable abstractions for things that will never have a
  second implementation (e.g. a date formatter).

## Business Rules

- Domain layer code must never import infrastructure (ORM, HTTP,
  framework) code.
- Any use case that calls an external system does so through a port
  interface, never a concrete infrastructure class directly.

## Definition of Done

- [ ] Can name which of the four layers a given responsibility belongs
      in, unprompted.
- [ ] Can explain why the mock-BaaS-to-real-Anchor swap requires no
      change to use-case logic.
- [ ] Can identify at least one thing in Cowrie that does not need a
      port/adapter, and justify why.

## Common Interview Questions

- What is the Dependency Rule, and why does it matter for testability?
- What's the difference between a port and an adapter?
- Why shouldn't domain entities import ORM models directly?
- Where's the line between appropriate Clean Architecture and
  overengineering?

## Open Question (carried forward)

Why must the domain layer never import the Prisma client directly, even
though every domain object will eventually be persisted by Prisma? (Set
up for Ch. 7's NestJS Architecture, where this becomes concrete folder
structure.)

## Further Reading (optional)

- Robert C. Martin, "Clean Architecture" — the Dependency Rule and
  ports/adapters (a.k.a. hexagonal architecture).
