# Cowrie

A production-grade digital wallet / neobank backend for the Nigerian market (NGN), built as a portfolio project following a chapter-by-chapter fintech backend engineering curriculum. Modeled conceptually on Nigerian neobanks like Kuda, Moniepoint, and OPay — several design decisions in this codebase (KYC tier structure, sanctions screening thresholds, session policy) are based on researched, sourced real-world behavior from those apps rather than assumptions.

## Tech Stack

- **Runtime**: Node.js, TypeScript
- **Framework**: NestJS 11
- **Database**: PostgreSQL
- **ORM**: Prisma 7 (driver adapters, `prisma-client` generator)
- **Auth**: Passport + JWT (access + revocable refresh tokens), Argon2 password hashing
- **Validation**: class-validator / class-transformer
- **API docs**: `@nestjs/swagger` (OpenAPI)
- **Rate limiting**: `@nestjs/throttler`
- **Testing**: Jest

## Architecture

Cowrie follows Clean Architecture inside a modular monolith. Each business module (`ledger`, `identity`) is structured in four layers:

```
src/<module>/
  domain/            # Entities, value objects, business invariants — no framework imports
  application/        
    ports/           # Abstract classes defining what the module needs (interfaces)
    use-cases/       # One class per business operation, orchestrates domain + ports
  infrastructure/    # Concrete adapters (Prisma repositories, external gateways) implementing ports
  interface/         # Controllers, DTOs, guards — translates HTTP <-> use cases
```

The Dependency Rule holds throughout: `domain/` never imports from `application/`, `infrastructure/`, or any framework; `application/` depends only on `ports/` abstractions, never concrete infrastructure. External dependencies not yet integrated for real (BaaS, sanctions screening, BVN/NIN verification) are implemented as mocked adapters behind the same ports a real integration would use later, so swapping one in is a config change, not a rewrite.

Shared code lives in three deliberately distinct places, for three different reasons:
- `shared-kernel/` — shared **domain** concepts, framework-agnostic (e.g. `Money`, `DomainException`)
- `common/` — shared **NestJS framework plumbing** (e.g. the global exception filter)
- `infrastructure/` (top-level) — shared **infrastructure clients** used by multiple modules (e.g. `PrismaService`)

### Definition of Terms

- **Domain** — the business logic itself: entities (things with an identity, like an `Account`), value objects (things defined only by their value, like `Money`), and the rules they enforce. Contains no framework code and no I/O — it doesn't know NestJS, Prisma, or HTTP exist. This is what makes it fast and trivial to unit test.
- **Application** — orchestrates the domain to carry out one specific business operation. Talks to the outside world only through **ports** (see below), never a concrete library directly.
  - **Use case** — one class per business operation (e.g. `RegisterUserUseCase`), not per resource. Deliberately narrower than a typical catch-all "service" class, so its name tells you exactly what it does.
  - **Port** — an abstract class declaring *what* the application needs from the outside world (e.g. "a way to hash passwords"), without saying *how*. Defined in the application layer; implemented in infrastructure.
- **Infrastructure** — concrete implementations of ports: a `PrismaUserRepository` implementing a `UserRepository` port, a `MockSanctionsScreeningGateway` implementing a `SanctionsScreeningGateway` port. This is the only layer allowed to import a specific database client, HTTP library, or third-party SDK.
  - **Adapter** — the implementation itself (e.g. `Argon2PasswordHasher`), so named because it *adapts* a concrete library to the shape a port expects. Swapping an adapter (mock → real, one library → another) never requires touching the use case that depends on the port.
- **Interface** — translates the outside world (HTTP) into calls on the application layer, and back. Contains controllers, DTOs (data shape + validation for a request/response), and guards (access-control checks run before a request reaches a controller method).
- **Dependency Rule** — the reason this all holds together: dependencies only ever point inward (interface → application → domain), never outward. A domain class is never allowed to import anything from application, infrastructure, or interface.

## Getting Started

### Prerequisites

- Node.js 20.19+
- PostgreSQL (running locally or reachable)

### Setup

```bash
npm install
```

Create a `.env` file:
```
DATABASE_URL="postgresql://<user>@localhost:5432/cowrie_dev"
JWT_SECRET="<a long random string>"
```

Run migrations and generate the Prisma client:
```bash
npx prisma generate
npx prisma migrate dev
```

### Running

```bash
npm run start:dev    # watch mode
npm run start        # single run
npm run start:prod   # production (after npm run build)
```

Once running, API documentation is available at `http://localhost:3000/api-docs`.

### Testing

```bash
npm test          # unit tests
npm run test:e2e  # end-to-end tests
npm run test:cov  # coverage
npm run lint      # eslint --fix
```

## Modules

- **`ledger/`** — double-entry accounting core: accounts, balanced transactions, postings. Enforces the debit=credit invariant, row-level locking against concurrent overdrafts, and reconciliation-ready structure.
- **`identity/`** — authentication (JWT access + revocable refresh tokens, Argon2 hashing), role-based and ownership-based authorization, KYC profiles with tiered verification (matching Kuda's real-world model), sanctions/PEP screening with an internal compliance-case workflow, and step-up authentication for high-risk actions.

Both modules are built as a **modular monolith** on purpose: strict boundaries (no module reaches into another's database rows or internal classes; only exported use cases/DTOs cross a module boundary), specifically so that a module — most likely the future fraud service below — can be extracted into a real, separately-deployed microservice later without a rewrite.

## Design Principles

A few decisions repeat throughout this codebase deliberately, not by accident:

- **External dependencies are mocked behind a port before they're integrated for real.** The banking rail (BaaS), sanctions/PEP screening, and BVN/NIN verification all exist today as mock adapters implementing the same port a real provider integration will implement later — swapping one in is a config change (one line in a module's `providers` array), never a rewrite of business logic.
- **Defense in depth, everywhere money or identity is involved.** The same fact is often checked at multiple layers for different reasons: a DTO validates shape (fast, cheap rejection), a domain object validates business rules (correct regardless of caller), and a database constraint enforces the same invariant as a last resort (correct regardless of *which code* wrote the row).
- **Business rules are researched, not assumed.** KYC tier requirements, sanctions-screening thresholds, session policy, and CTR/STR reporting thresholds are all sourced from real CBN guidance or the actual published behavior of Kuda/Moniepoint/OPay, cited in the relevant chapter notes — not invented for convenience.
- **Concurrency correctness is proven, not hoped for.** Race conditions (double-spend on concurrent withdrawals, two admins resolving the same compliance case, two simultaneous logins) are closed with the specific mechanism that fits the shape of the problem — a row lock (`FOR UPDATE`) when a multi-step check-then-act sequence needs it, an atomic conditional write (`UPDATE ... WHERE status = 'OPEN'`) when a single statement can serve as its own check.

## Roadmap

Built incrementally, one curriculum chapter at a time (see below). Not yet implemented, but planned:

- **Wallets, deposits/withdrawals, transfers, statements & limits** — tying a real customer (`identity`) to a ledger account, with tier-based transaction limits actually enforced.
- **Async infrastructure** — Redis (caching, rate-limit backing, sliding sessions), BullMQ (background jobs), RabbitMQ/Kafka (event-driven communication between modules/services).
- **A Go-based fraud detection service** — a genuinely separate microservice (not TypeScript), communicating with the NestJS monolith over the network — the concrete reason the modules above are kept extraction-ready from day one.
- **Real external integrations** — a real banking-as-a-service provider (likely Anchor), a real sanctions/KYC verification provider (Youverify, Smile Identity, or similar), replacing today's mocks behind their existing ports.
- **Deployment** — Docker, CI/CD, monitoring, and a capstone production deployment.

## Curriculum

This project is built chapter by chapter against a 47-chapter curriculum. Chapter notes — covering the reasoning behind each design decision, not just the "what" — live in [`docs/`](./docs).

## License

Private, unpublished. Not licensed for reuse.
