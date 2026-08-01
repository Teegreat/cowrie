# Chapter 24 — Money Precision & Multi-Currency Handling

## Learning Objectives

- Close a precision gap that's existed since Ch. 7: `Money` has stored
  its value as a plain JS `number` while the Postgres column backing it
  has always been `BigInt` — switch `Money` to `bigint` end to end.
- Understand that precision loss can happen at the JSON wire format
  itself, before any server-side validation runs — and design the DTO
  layer around that.
- Give every `Account` an explicit, enforced currency, closing a real
  gap where nothing previously stopped one account from accumulating
  postings in more than one currency.

## Key Concepts

**The precision gap was already flagged in the code**
- `prisma-ledger.repository.ts` carried a comment since Ch. 7:
  *"minorUnits is BigInt in Postgres/Prisma but a plain number inside
  Money (Ch. 7) — safe below Number.MAX_SAFE_INTEGER, a simplification
  Ch. 24 (Money Precision) will revisit."* `Money.of()` moves from
  `number` to `bigint`, and the `Number.isInteger()` validation it used
  to need disappears entirely — a `bigint` simply has no fractional
  representation, so the invariant is enforced by the type itself, not
  a runtime check.

**Precision loss can happen before your code even runs**
- A JSON numeric literal above `Number.MAX_SAFE_INTEGER` is already
  lossy the moment a JSON parser reads it — before `ValidationPipe`,
  before `Money.of()`. That's why every DTO's `minorUnits` field changes
  from a JSON number to a **digit string**, validated with a regex and
  converted via `BigInt(value)` only once it's safely on the server as
  text.

**Display formatting is allowed to touch `Number`; arithmetic never is**
- `Money.toString()` still does `Number(this.minorUnits) / 100` for
  human-readable output. That's fine — it's a one-way conversion for
  display, not a value that flows back into further calculation. Every
  actual computation (`add`, `subtract`, the balance check) stays in
  `bigint` from end to end.

**Accounts were never actually single-currency**
- `Account` had no `currency` field at all — only `Posting` rows carried
  one. `LedgerTransaction.balanced()` only ever checked that postings
  *within one transaction* share a currency; nothing checked postings
  *across different transactions on the same account*. The balance/
  insufficient-funds check summed `minorUnits` per account regardless of
  currency, so a mixed-currency account would have silently added NGN
  kobo to USD cents as if they were fungible.

**Currency mismatch is checked for every posting, not just the risky one**
- The insufficient-balance check only runs for `LIABILITY`/`DEBIT`
  postings, but a currency mismatch is invalid regardless of account
  type or direction — so that check runs for every posting, independent
  of the balance check.

**Defense-in-depth, same as Ch. 12**
- Even with the account-currency-match check in place, the balance
  `groupBy` query is *also* filtered by currency. If that invariant were
  ever violated some other way, the balance calculation still couldn't
  silently sum across currencies.

**No default currency on `Account`**
- Deliberately no `@default(...)` — a currency should be a decision
  made explicitly at account-creation time. A convenient default is
  exactly how a USD account gets created as NGN by accident.

## Folder/File Changes

```
src/shared-kernel/money.value-object.ts          (bigint-native)
src/ledger/domain/ledger-transaction.ts          (bigint arithmetic)
src/ledger/domain/ledger-transaction.spec.ts     (updated + new precision test)
src/ledger/application/ports/ledger-repository.port.ts  (currency added)
src/ledger/application/use-cases/create-account.use-case.ts (currency validated)
src/ledger/infrastructure/persistence/prisma-ledger.repository.ts (currency match + filter)
src/ledger/interface/dto/create-account.dto.ts   (currency added)
src/ledger/interface/dto/check-money.dto.ts       (minorUnits → string)
src/ledger/interface/dto/post-transaction.dto.ts  (minorUnits → string)
src/ledger/interface/ledger.controller.ts         (BigInt(...) conversion)
```

## Database Changes

`Account` gains a required `currency String` column (no default).
`Posting` gains a composite index `@@index([accountId, currency])`
supporting the now currency-filtered balance query.

```prisma
model Account {
  id          String      @id @default(uuid())
  name        String
  accountType AccountType
  currency    String
  postings    Posting[]
  createdAt   DateTime    @default(now())
}

model Posting {
  // ...unchanged fields
  @@index([accountId])
  @@index([accountId, currency])
  @@index([transactionId])
}
```

Existing test accounts/postings are disposable dev data (same approach
as Ch. 22):
```bash
psql -d cowrie_dev -c 'DELETE FROM "Posting"; DELETE FROM "LedgerTransaction"; DELETE FROM "Account";'
npx prisma migrate dev --name add_account_currency
```

## APIs Changed

- `POST /ledger/accounts` — now requires `currency` (3-letter ISO code)
  in the body.
- `POST /ledger/money-check`, `POST /ledger/transactions` — `minorUnits`
  is now a digit **string**, not a JSON number, converted to `bigint`
  via `BigInt(...)` at the controller boundary.
- `POST /ledger/transactions` — a posting whose currency doesn't match
  its target account's stored currency is now rejected with
  `Posting currency X does not match account Y's currency Z`,
  regardless of account type or direction.

## Business Rules

- Every monetary amount is `bigint` minor units internally, end to end
  — no float ever participates in a money calculation.
- The wire format for any amount is a digit string, never a JSON
  number.
- Every `Account` has exactly one currency, set explicitly at creation.
- A posting's currency must match its account's currency, checked for
  every posting.
- Balance calculations are filtered by currency even though the
  match-check above should make violation impossible — defense in
  depth.

## Deferred (named, not built here)

- Actual currency conversion / FX rates between accounts of different
  currencies — no product requirement exists yet for it in Cowrie's
  NGN-focused design. This chapter makes multiple currencies safely
  *isolated*, not *convertible*.

## Definition of Done

- [ ] `Money` is bigint-native; `LedgerTransaction.balanced()` uses
      bigint arithmetic throughout.
- [ ] `Account.currency` added to schema (no default); migration run.
- [ ] Posting-vs-account currency mismatch rejected for every posting;
      balance query filtered by currency.
- [ ] DTOs accept `minorUnits` as a digit string; controller converts
      via `BigInt(...)`.
- [ ] Existing unit tests updated to bigint literals; new precision
      test (value past `Number.MAX_SAFE_INTEGER`) passes.
- [ ] Manual verification: cross-currency mismatch rejected,
      insufficient-balance check still works, a value past
      `Number.MAX_SAFE_INTEGER` round-trips exactly.

## Common Mistakes

- Sending `minorUnits` as a JSON number for large values — already
  lossy before the server runs, regardless of internal `bigint` usage.
- Returning a raw Prisma `bigint` field directly in an HTTP JSON
  response — `JSON.stringify` throws on `bigint`; always go through
  `Money.toString()` or an explicit conversion.
- Giving `Account.currency` a convenient default to avoid updating
  callers.
- Checking posting-vs-account currency only for the liability/debit
  branch instead of every posting.

## Common Interview Questions

- Why is `bigint` the correct internal representation for money, and
  why doesn't `Number.isInteger()` validation on a `number` actually fix
  the underlying problem?
- Where can precision loss occur before server-side validation even
  runs, and how does the DTO shape prevent it?
- Why does `JSON.stringify` throw on `bigint`, and where's the correct
  place in the architecture to convert money for an API response?
- Why check a posting's currency against its account's currency at
  write time, rather than relying only on `LedgerTransaction.balanced()`'s
  single-currency-per-transaction check?
- Why filter the balance query by currency even after the
  account-currency-match check exists elsewhere?

## Further Reading (optional)

- MDN: `BigInt` — precision and limitations.
- Martin Fowler, "Money" pattern (PoEAA).
