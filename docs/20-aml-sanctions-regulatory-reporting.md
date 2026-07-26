# Chapter 20 — AML, Sanctions Screening & Regulatory Reporting

## Learning Objectives

- Understand sanctions/PEP screening as a real, CBN-mandated control,
  distinct from both KYC (Ch. 19) and transaction monitoring (Ch. 40).
- Implement the real, sourced 70/100 risk-score threshold and
  watchlist-hit rule as a domain invariant.
- Build an internal compliance-case mechanism reviewable by an admin —
  the seed of what a real Suspicious Transaction Report would be built
  from, while being honest about what's genuinely out of scope.

## Researched, Not Assumed

- CBN Circular 12/2022: real-time name-screening against UN, EU, UK,
  OFAC, and local NFIU/EFCC watchlists required at onboarding and on an
  ongoing basis. Screening and transaction monitoring are explicitly
  separate, documented controls — satisfying one does not satisfy the
  obligation for the other.
- CBN's 2024 PEP Screening Guidelines: minimum three independent data
  sources, minimum risk score of 70/100 before onboarding proceeds.
- NFIU (Nigerian Financial Intelligence Unit) is the mandatory filing
  destination for STRs (Suspicious Transaction Reports) and CTRs
  (Currency Transaction Reports), submitted via **goAML** — a
  government case-management platform, not a public REST API.
- CTR thresholds: ₦5,000,000 for individuals, ₦10,000,000 for
  corporates (noted for later — not enforced yet, since it needs real
  transactions).

## Key Concepts

**Screening vs. monitoring**
- Screening: checking identity against static watchlists, at onboarding
  and periodically after — what this chapter builds.
- Monitoring: watching transaction *behavior* over time for suspicious
  patterns — needs real transactions, deferred to Ch. 40 (Fraud & Risk
  Theory).

**The mock, consistent with every other external dependency**
- Real screening needs licensed access to UN/EU/UK/OFAC/NFIU/EFCC list
  data. `SanctionsScreeningGateway` (port) + `MockSanctionsScreeningGateway`
  (adapter) stand in for a real provider (Ch. 29), same pattern as
  Ch. 7's BaaS gateway and Ch. 19's BVN/NIN verification.

**The 70-point rule lives in the domain, not the gateway or use case**
- `Profile.resolveScreeningStatus()`: a watchlist hit → `BLOCKED`
  outright; otherwise a risk score below 70 → `FLAGGED` for manual
  review; else `CLEARED`. This is a business rule, so it's a domain
  invariant on `Profile.create()`, not logic scattered in the gateway or
  use case.

**Internal compliance case, not a real NFIU submission**
- A non-cleared profile creates a `ComplianceCase` — reviewable and
  resolvable by an admin (reusing Ch. 18's `RolesGuard`). This is
  deliberately just the internal record; actually filing with NFIU goes
  through goAML, which isn't something a fintech calls as an API —
  genuinely out of scope for this project, not merely deferred.

**Resolution is disposition-driven and actually changes the account**
- Resolving a case requires stating a disposition — `CLEARED` (false
  positive) or `CONFIRMED_BLOCK` (real match) — and both symmetrically
  drive the linked `Profile`'s `screeningStatus` (`Profile.clearScreening()`
  / `Profile.confirmBlock()`). An earlier version only acted on `CLEARED`,
  leaving a `CONFIRMED_BLOCK` on a merely-`FLAGGED` profile with no
  effect — fixed so both dispositions actually change account state.
- `riskScore` is never rewritten by a resolution — it's the historical
  record of what the original automated screening found; only
  `screeningStatus` reflects the current, possibly human-overridden,
  determination.
- Case + profile update happen in **one Prisma transaction**
  (`resolveAndUpdateProfile`), guarded by a conditional
  `updateMany({ where: { status: 'OPEN' } })` — the same
  "conditional-write count check" idea as elsewhere, giving a race-free
  way to detect that a case was already resolved by another admin
  without needing a `FOR UPDATE` lock.
- Every resolution records `resolvedByUserId` — an open case with no
  reviewer on record is an accountability gap in a real compliance
  system.
- `ComplianceCaseSummary` is enriched with the subject's `userEmail`/
  `userFullName` (joined via `User`→`Profile`) — a raw `userId` alone
  isn't enough for a human reviewer to know who they're looking at.

## Schema

```prisma
enum ScreeningStatus {
  CLEARED
  FLAGGED
  BLOCKED
}

enum ComplianceCaseStatus {
  OPEN
  RESOLVED
}

model Profile {
  userId          String          @id
  user            User            @relation(fields: [userId], references: [id])
  firstName       String
  middleName      String?
  lastName        String
  phoneNumber     String          @unique
  dateOfBirth     DateTime
  kycTier         KycTier         @default(TIER_1)
  bvn             String          @unique
  nin             String?         @unique
  address         String?
  riskScore       Int
  screeningStatus ScreeningStatus @default(CLEARED)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model ComplianceCase {
  id               String               @id @default(uuid())
  userId           String
  user             User                 @relation("ComplianceCaseSubject", fields: [userId], references: [id])
  riskScore        Int
  watchlistHits    String[]
  status           ComplianceCaseStatus @default(OPEN)
  resolutionNotes  String?
  resolvedByUserId String?
  resolvedBy       User?                @relation("ComplianceCaseResolver", fields: [resolvedByUserId], references: [id])
  createdAt        DateTime             @default(now())
  resolvedAt       DateTime?

  @@index([userId])
}
```
(`User` gains two named relations: `complianceCases ComplianceCase[] @relation("ComplianceCaseSubject")`
and `resolvedComplianceCases ComplianceCase[] @relation("ComplianceCaseResolver")` —
named because there are two different relations to the same model.)
```bash
npx prisma migrate dev --name add_compliance_screening
npx prisma migrate dev --name add_compliance_case_resolver
```

## File Changes

```
src/identity/
  domain/
    profile.ts (riskScore, screeningStatus, resolveScreeningStatus,
                 clearScreening, confirmBlock added)
  application/
    ports/
      sanctions-screening-gateway.port.ts
      compliance-case-repository.port.ts
    use-cases/
      create-profile.use-case.ts (updated: screens before creating)
      list-compliance-case.use-case.ts
      resolve-complaince-case.use-case.ts
  infrastructure/
    mock-sanctions-screening.gateway.ts
    persistence/
      prisma-compliance-case.repository.ts
      prisma-profile.repository.ts (updated: persists riskScore/screeningStatus)
  interface/
    dto/
      resolve-compliance-case.dto.ts
    compliance.controller.ts
```

Also added in this chapter: `@nestjs/swagger` across every controller
(`/api-docs`), with `@ApiTags()` on each and `@ApiBearerAuth()` on any
route (or whole controller) requiring a JWT — now a standing practice
for every future controller, not a one-off.

## APIs Implemented

- `POST /identity/profile` (updated) — screens the submitted name/DOB
  before creating the profile; response includes `riskScore` and
  `screeningStatus`. A non-`CLEARED` result creates an internal
  `ComplianceCase`.
- `GET /identity/compliance-cases` — admin-only; lists all `OPEN` cases,
  enriched with `userEmail`/`userFullName`.
- `PATCH /identity/compliance-cases/:id/resolve` — admin-only;
  `{ notes, disposition: 'CLEARED' | 'CONFIRMED_BLOCK' }` → atomically
  resolves the case and updates the linked profile's `screeningStatus`
  accordingly. Fails with `404`/`NotFoundDomainException` if the case
  doesn't exist or was already resolved.

## Business Rules

- Every profile creation is screened against a sanctions/PEP gateway
  before being persisted.
- A confirmed watchlist hit sets `screeningStatus: BLOCKED`, always,
  regardless of risk score.
- A risk score below 70 (with no direct hit) sets
  `screeningStatus: FLAGGED`.
- Any non-`CLEARED` profile creates an open `ComplianceCase` for admin
  review.
- Compliance-case endpoints are admin-only (`RolesGuard` + `@Roles('ADMIN')`).
- Resolving a case requires a disposition; `CLEARED` clears the profile,
  `CONFIRMED_BLOCK` blocks it — both actually mutate `screeningStatus`.
- A case can only be resolved once — a second attempt on an
  already-resolved case fails cleanly rather than silently overwriting
  the first admin's determination.
- Case resolution and the profile update happen atomically — never one
  without the other.
- Every resolved case records which admin resolved it.

## Definition of Done

- [ ] `SanctionsScreeningGateway` port + mock adapter implemented, with
      three deterministic triggers: `"Sanctioned"` (blocked, watchlist
      hit), `"Lowscore"` (flagged, score 50, no hit), anything else
      (cleared, score 95).
- [ ] `Profile.create()` resolves `screeningStatus` per the 70-point/
      watchlist-hit rule; `clearScreening()`/`confirmBlock()` exist for
      resolution-driven transitions.
- [ ] A non-`CLEARED` profile creates a `ComplianceCase`.
- [ ] `GET`/`PATCH` compliance-case endpoints work, are admin-only, and
      `PATCH` requires+applies a disposition atomically with the case
      resolution.
- [ ] Resolving an already-resolved case fails instead of double-processing.
- [ ] Verified: ordinary name clears at a high score; `"Sanctioned"`
      blocks and creates a case; `"Lowscore"` flags and creates a case;
      non-admin gets 403; admin can list, resolve with `CLEARED` (clears
      the profile) or `CONFIRMED_BLOCK` (blocks it), and a repeat resolve
      attempt fails.

## Common Interview Questions

- Why are sanctions screening and transaction monitoring treated as
  separate compliance controls under CBN regulation?
- Walk through what happens, end to end, when a new profile's name
  matches a watchlist.
- Why does the risk-score threshold rule live in the domain layer
  rather than the screening gateway or the use case?
- What is goAML, and why can't a fintech simply call an API to file an
  STR with NFIU?
- Why shouldn't resolving a compliance case ever rewrite the original
  `riskScore`?
- How does `resolveAndUpdateProfile` prevent two admins from both
  successfully resolving the same case, without using an explicit row
  lock?

## Further Reading (optional)

- [Banks, fintechs flag 82,143 transactions in one year — Punch](https://punchng.com/banks-fintechs-flag-82143-transactions-in-one-year-report/)
- [How to File a Currency Transaction Report (CTR) in Nigeria](https://www.regfyl.com/post/how-to-file-a-currency-transaction-report-ctr-in-nigeria)
- [CBN's 2026 Updated AML Rules — Dojah](https://dojah.io/blog/cbn-aml-updates-banks-fintechs-2026)
