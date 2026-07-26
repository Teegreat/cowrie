# Chapter 19 — Profiles & KYC

## Learning Objectives

- Model real-world customer identity (`Profile`) as a separate entity
  from the authentication identity (`User`), and understand why.
- Implement Nigeria's tiered KYC model, aligned to real-world precedent
  researched directly from OPay, Moniepoint, and Kuda (not assumed).
- Model BVN/NIN as value objects: format validation plus masked display,
  never exposing the full value via the API.
- Deliberately defer three things to their proper future chapters, and
  understand why each deferral is correct, not an oversight.

## Tier Model — Researched Against Three Real Apps

All three real Nigerian fintechs implement tiered KYC differently — there
is no single universal model:

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **OPay** | Historically phone-only; a CBN directive effective March 2024 made BVN/NIN mandatory even here | + valid gov't ID + BVN + liveness selfie | + proof of address (manually reviewed, ≤48h) |
| **Moniepoint** | BVN + liveness + *self-declared* address + signature | + NIN + next-of-kin | + *document-verified* proof of address + indemnity |
| **Kuda** | BVN linked | + NIN linked | + verified address (manual review, ≤1 week) |

**Cowrie follows Kuda's model** — the cleanest and most linearly
additive: Tier 1 requires BVN at profile creation, Tier 2 adds NIN,
Tier 3 adds proof of address. This also reflects the current regulatory
reality more accurately than an earlier draft of this chapter did (which
had Tier 1 require no BVN at all — true historically, but superseded by
the March 2024 CBN directive OPay had to comply with).

**This chapter builds the tier data model and progression rules only**
— enforcing these limits against a real transaction is Ch. 31
(Statements, Limits & Fees).

## Key Concepts

**Why `Profile` is separate from `User`**
- `User` (Ch. 17) is authentication identity (can you log in).
  `Profile` is real-world identity (who are you, verified to what
  degree) — different lifecycle, far higher sensitivity (a BVN is a
  permanent national identifier; a password can just be reset).
  Separating them means Ch. 22 can encrypt `Profile`'s sensitive fields
  without touching `User` at all.

**Structured name fields, not one `fullName` string**
- `firstName`/`middleName` (optional)/`lastName` stored separately, with
  a computed `fullName` getter (`.filter(Boolean).join(' ')`, so a
  missing middle name doesn't leave a double space). Structured fields
  matter because real BVN/NIN verification providers (Ch. 29) match
  against first/middle/last name separately, not a concatenated string.

**BVN/NIN as value objects**
- `Bvn.of()`/`Nin.of()` enforce the 11-digit format invariant (same
  reasoning as `Money`, Ch. 5). A `.masked()` method
  (`•••••••1234`) is the only way either value is ever exposed via the
  API — `Profile.toPublicProfile()` never returns the full value.
  `bvn` is non-nullable (required from Tier 1 onward); `nin` stays
  nullable until Tier 2.

**Progressive tiers, not independent ones**
- Tier 3 requires already being Tier 2 (`upgradeToTier3` rejects
  anything not currently `TIER_2`) — Tier 3's requirements are a
  superset of Tier 2's, so skipping straight there isn't allowed.

**Database-level uniqueness as the real fraud guarantee**
- `phoneNumber`, `bvn`, and `nin` are all `@unique` at the database
  level (nullable-unique for `nin`: any number of `NULL`s allowed, but
  no duplicate non-null value) — the same "application check is a
  friendly pre-check, the constraint is the real guarantee" pattern
  from Ch. 16/17, applied to prevent one person linking the same
  BVN/NIN to multiple accounts.

**Three deliberate deferrals**
- Real BVN/NIN verification against NIMC/NIBSS — Ch. 29 (Payment
  Rails), mirroring how Ch. 7 mocked the BaaS gateway before its real
  chapter. Real providers doing this: Youverify, Smile Identity,
  Prembly, Dojah — automated, real-time lookups. Today, "verification"
  means format-valid and not already linked to another account, nothing
  more.
- **Proof of address is manual, not a third-party API check** —
  researched directly: OPay describes "manual document review, up to
  48 hours"; Kuda "up to a week." There's no national address registry
  an API can check against; a human reviews the uploaded document.
  Worth remembering for Ch. 29: real KYC needs an async status
  (`PENDING` → `VERIFIED`/`REJECTED`), not the immediate tier change
  this chapter implements.
- Field-level encryption at rest for `bvn`/`nin` — Ch. 22 (Secrets &
  Key Management). Stored as plain strings today; masked in every API
  response as an immediate, cheap mitigation in the meantime.

## Schema

```prisma
enum KycTier {
  TIER_1
  TIER_2
  TIER_3
}

model Profile {
  userId      String   @id
  user        User     @relation(fields: [userId], references: [id])
  firstName   String
  middleName  String?
  lastName    String
  phoneNumber String   @unique
  dateOfBirth DateTime
  kycTier     KycTier  @default(TIER_1)
  bvn         String   @unique
  nin         String?  @unique
  address     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
(`User` gains a `profile Profile?` relation field.)
```bash
npx prisma migrate dev --name add_profile
```

## File Changes

```
src/identity/
  domain/
    profile.ts
  application/
    ports/
      profile-repository.port.ts
    use-cases/
      create-profile.use-case.ts
      get-profile.use-case.ts
      upgrade-to-tier2.use-case.ts
      upgrade-to-tier3.use-case.ts
  infrastructure/
    persistence/
      prisma-profile.repository.ts
  interface/
    dto/
      create-profile.dto.ts
      upgrade-tier2.dto.ts
      upgrade-tier3.dto.ts
    profile.controller.ts
```

## APIs Implemented

- `POST /identity/profile` — `{ firstName, middleName?, lastName,
  phoneNumber, dateOfBirth, bvn }` → creates a `TIER_1` profile for the
  caller. Rejects under-18 DOB, a profile that already exists, a
  duplicate phone number, or a BVN already linked to another account.
- `GET /identity/profile` — the caller's own profile, BVN/NIN masked.
- `PATCH /identity/profile/tier2` — `{ nin }` → upgrades `TIER_1` →
  `TIER_2`. Rejects malformed NIN, rejects a NIN already linked to
  another account.
- `PATCH /identity/profile/tier3` — `{ address }` → upgrades `TIER_2` →
  `TIER_3`. Rejects if not currently `TIER_2`.

## Business Rules

- A user must be at least 18 years old to create a profile.
- A profile can only be created once per user.
- BVN is required at profile creation (Tier 1) — not deferred to a
  later tier.
- Tier upgrades are strictly progressive: Tier 3 requires already being
  Tier 2.
- `bvn` and `nin` are never returned in full via any API response —
  only `.masked()`.
- `phoneNumber`, `bvn`, and `nin` are each unique across all accounts.

## Definition of Done

- [ ] `Profile`, `Bvn`, `Nin` implemented with age-18 and format
      invariants; `bvn` non-nullable from creation onward.
- [ ] `phoneNumber`/`bvn`/`nin` are `@unique` at the database level.
- [ ] All four endpoints working, including progressive-tier
      enforcement (Tier 3 blocked without Tier 2 first).
- [ ] BVN/NIN masked in every API response.
- [ ] A duplicate BVN across two accounts is rejected at profile
      creation; a duplicate NIN is rejected at the tier2 upgrade — both
      via the database constraint, not just an application check.

## Common Interview Questions

- Why is KYC data modeled as a separate entity from the authentication
  `User`, rather than more columns on it?
- Walk through Nigeria's tiered KYC model as implemented by Kuda, and
  why real apps differ in their exact tier structure.
- Why does a BVN/NIN need a database-level uniqueness constraint, not
  just an application-level check?
- Why is BVN/NIN verification a third-party automated API call, while
  proof-of-address verification is typically manual?
- What's deliberately not implemented in this chapter, and why is each
  deferral justified rather than an oversight?

## Further Reading (optional)

- OPay's own published tier limits (via X/Twitter support reply):
  https://x.com/OPay_NG/status/1618288773493841920
- Moniepoint KYC level requirements — Moniepoint Knowledge Base:
  https://support.moniepoint.com/topics/what-are-the-requirements-for-each-kyc-level-on-moniepoint-113/
- Kuda account tiers, rules and limits — Kuda Help Center:
  https://help.kuda.com/en/articles/9424612-new-account-tiers-rules-and-limits
