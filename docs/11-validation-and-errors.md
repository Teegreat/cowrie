# Chapter 11 — Validation & Errors

## Learning Objectives

- Distinguish DTO validation (structural, at the API boundary) from
  domain validation (business rules, regardless of caller).
- Understand why duplicating a business rule inside a DTO creates drift
  risk instead of extra safety.
- Configure NestJS's global `ValidationPipe` correctly for a fintech API
  (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Build a framework-agnostic domain exception and a NestJS exception
  filter that translates it to a consistent HTTP error shape.

## Key Concepts

**Where DTO validation ends and domain validation begins**
- DTO: checks shape/type (is `minorUnits` an integer, is `currency` a
  3-character string) — rejects obvious garbage fast, cheaply, at the
  boundary.
- Domain: checks business rules (is `currency` actually a valid
  uppercase ISO code) — must hold regardless of which caller reaches it
  (HTTP today, another module or a test tomorrow).
- Duplicating a business rule in the DTO risks the two definitions
  drifting apart as the rule evolves; the DTO's job is structural only.

**`ValidationPipe` options and why they matter for fintech**
- `whitelist: true` — strips properties not declared on the DTO.
- `forbidNonWhitelisted: true` — rejects the request instead of silently
  stripping extra fields; blocks a client sneaking in an unexpected
  property (mass-assignment-style attempt).
- `transform: true` — coerces the raw JSON body into a real DTO class
  instance so `@IsInt()` etc. run against actual typed values.

**Domain exceptions stay framework-agnostic**
- `DomainException` is a plain `Error` subclass with no NestJS import —
  consistent with Ch. 6's Dependency Rule: domain code doesn't know
  NestJS exists, even for its own error type.
- Translating a `DomainException` into an HTTP response is the job of a
  NestJS exception filter, which lives in a new `common/` folder for
  cross-cutting framework plumbing — distinct from `shared-kernel/`
  (shared *domain* concepts). Same word "shared," different reason.
- Genuinely unexpected errors (not `DomainException`) fall through to
  NestJS's own default handler, which already returns a safe, generic
  500 with no stack trace leak — no extra filter needed for that case.

## Folder/File Additions

```
src/
  shared-kernel/
    domain-exception.ts
  common/
    filters/
      domain-exception.filter.ts
  ledger/
    interface/
      dto/
        check-money.dto.ts
```

## APIs Implemented

- `POST /ledger/money-check` — accepts `{ minorUnits, currency }`.
  Structural violations (wrong type, missing field, extra field) are
  rejected by `ValidationPipe`; business-rule violations (e.g. lowercase
  currency) are rejected by `Money.of()` and surfaced via
  `DomainExceptionFilter`.

## Business Rules

- DTOs validate structure only; business rules live exclusively in the
  domain layer and are never re-implemented in a DTO.
- Every domain-thrown exception extends `DomainException`, never a bare
  `Error`, and never a NestJS `HttpException`.
- All money-moving/validating endpoints run behind the global
  `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and
  `transform` all enabled.

## Definition of Done

- [ ] `class-validator`/`class-transformer` installed.
- [ ] `DomainException` created; `Money` throws it instead of plain
      `Error`.
- [ ] `CheckMoneyDto` validates structure only, not the currency format
      rule.
- [ ] `DomainExceptionFilter` registered globally, returns a consistent
      400 shape.
- [ ] Verified: malformed request → ValidationPipe 400; well-formed but
      invalid currency → DomainExceptionFilter 400; valid request →
      success; extra field → rejected by `forbidNonWhitelisted`.

## Common Interview Questions

- What's the difference between validating a DTO and validating a
  domain invariant, and why shouldn't business rules be duplicated in
  both?
- What do `whitelist` and `forbidNonWhitelisted` protect against
  specifically?
- Why shouldn't a domain-layer exception extend NestJS's `HttpException`?
- Why is it dangerous to let an unexpected error's raw message reach the
  client?

## Further Reading (optional)

- NestJS Pipes and Exception Filters documentation.
- class-validator decorator reference.
