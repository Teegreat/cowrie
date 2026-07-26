# Chapter 12 — PostgreSQL

## Learning Objectives

- Understand why PostgreSQL specifically suits a ledger system: real
  ACID transactions, a rich constraint system, exact-precision numeric
  types, mature isolation levels.
- Understand database constraints as a third, independent line of
  defense beneath the domain layer (Ch. 5) and DTO validation (Ch. 11).
- See Ch. 4's balancing invariant made physical via a demonstrated
  `ROLLBACK`.
- Set up a local Postgres instance and a `DATABASE_URL` for Ch. 13,
  without leaking it into git.

## Key Concepts

**Why Postgres**
- Real ACID transactions, required non-negotiably for a ledger.
- Constraint system (`CHECK`, `NOT NULL`, `UNIQUE`, `FOREIGN KEY`)
  enforces basic invariants at the database itself, independent of
  whatever application code (or bug, or manual script) produced the row.
- Exact-precision `NUMERIC`/`DECIMAL` types — never silently rounds,
  unlike float types. Full usage covered in Ch. 24.
- Mature isolation levels (`READ COMMITTED` default, `SERIALIZABLE`
  available) — depth deferred to Ch. 15.

**Defense in depth, three layers**
1. Domain layer (`Money.of()`, etc.) — business rules, regardless of
   caller.
2. DTO validation — request shape, at the API boundary.
3. Database constraints — structural/referential integrity, regardless
   of which application code wrote the row.

**Transactions made physical**
- `BEGIN` / `COMMIT` / `ROLLBACK` demonstrated directly via `psql`: a
  transaction with one valid and one constraint-violating insert,
  rolled back, leaves zero rows — the tangible version of Ch. 4's
  balancing rule and Ch. 9's "local transaction" guarantee.

**Credentials**
- `DATABASE_URL` lives in `.env`, confirmed present in `.gitignore` —
  a small, timely preview of Ch. 22 (Secrets & Key Management), done
  correctly from the moment a credential first exists.

## Practice Schema (throwaway — not the real schema)

```sql
CREATE TABLE ledger_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY'))
);

CREATE TABLE ledger_postings (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
  minor_units BIGINT NOT NULL CHECK (minor_units > 0),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  transaction_id INTEGER NOT NULL
);
```

Dropped at the end of the chapter — Ch. 13 starts the real schema fresh
via Prisma migrations.

## Business Rules

- Every table backing a money-related concept must declare constraints
  (`CHECK`, `NOT NULL`, `FOREIGN KEY`) reflecting its domain invariants,
  not rely on application code alone.
- Database credentials are never committed to source control; they live
  in `.env`, which is git-ignored from the moment it's created.

## Definition of Done

- [ ] Postgres installed and running locally.
- [ ] `cowrie_dev` database created, connected to via `psql`.
- [ ] CHECK and FOREIGN KEY constraints both demonstrated rejecting bad
      data.
- [ ] Transaction rollback demonstrated leaving zero rows behind.
- [ ] `.env` created with `DATABASE_URL`, confirmed present in
      `.gitignore`.

## Common Interview Questions

- Why choose PostgreSQL over a NoSQL store for a ledger system?
- What's the difference between validating in application code and
  enforcing a constraint at the database level? Why have both?
- What does `ROLLBACK` actually guarantee, concretely?
- Why should money never be stored using a floating-point column type?

## Further Reading (optional)

- PostgreSQL documentation: constraints, transactions, and numeric types.
