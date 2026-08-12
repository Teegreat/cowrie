# Chapter 29 — Payment Rails & External Processor Integrations

Written against Anchor's real, published API documentation
(docs.getanchor.co) rather than assumption — consistent with this
course's standing "no assumptions" rule. Endpoints/shapes marked
"confirmed" were directly fetched from Anchor's docs; a couple of
smaller pieces are marked "inferred by REST convention" where the
specific page wasn't available, and are named explicitly rather than
presented with false confidence.

## Learning Objectives

- Replace `MockBaaSGateway` with a real adapter (`AnchorBaaSGateway`)
  implementing the same `BaaSGateway` port unchanged since Ch. 7.
- Understand why a real BaaS transfer API resolves asynchronously by
  design, and why that makes Ch. 27's `UNKNOWN` state the *normal* path
  for a real withdrawal, not an edge case.
- Implement real webhook signature verification, matching a specific
  provider's documented cryptographic construction exactly.

## Key Concepts

**The payoff of six chapters of "swap this one line"**
- `ledger.module.ts` has carried a comment since Ch. 7 promising this
  exact moment: `{ provide: BaaSGateway, useClass: MockBaaSGateway }`
  becomes `useClass: AnchorBaaSGateway`. Nothing else in the
  application layer changes — `InitiateWithdrawalUseCase`,
  `SettleWithdrawalUseCase`, `ReleaseWithdrawalUseCase` are all reused
  completely unmodified. That's the actual test of whether the
  ports/adapters investment since Ch. 7 was done correctly.

**The mock was hiding a real interface gap**
- `BaaSGateway.createVirtualAccount` took one combined `accountName`
  string. Anchor's real reserved-account API needs `firstName`,
  `lastName`, `email`, and `bvn` as separate fields. The mock never
  needed the split, so it never surfaced the gap — this is the concrete
  value of doing a real integration: it exposes what a simplified mock
  quietly let you get away with.

**Real transfers are asynchronous by design**
- Anchor's transfer-creation response is confirmed to always return
  `status: "PENDING"` — never a terminal state — because NIP settlement
  takes real time. The actual outcome (`nip.transfer.successful`,
  `nip.transfer.failed`, `nip.transfer.reversed`) arrives later, via
  webhook. `AttemptExternalTransferUseCase` calling
  `AnchorBaaSGateway.initiateExternalTransfer` will therefore return
  `UNKNOWN` for essentially every real withdrawal — confirming Ch. 27's
  state machine was built for exactly this reality, not a hypothetical.

**Account name verification before sending money**
- Anchor's account-verification endpoint resolves an account number to
  its real registered name *before* a counterparty is created —
  catching a mistyped destination account before any transfer is
  attempted, not after.

**Webhook signature verification, exactly as documented**
- Header: `x-anchor-signature`. Construction: `Base64(HMAC-SHA1(rawBody))`
  — computed as a hex digest string first, then that hex *text* is what
  gets base64-encoded (not the raw digest bytes). This specific,
  slightly unusual double-encoding is confirmed directly from Anchor's
  own Python code sample and matched exactly, not approximated.

## Folder/File Changes

```
src/ledger/application/ports/baas-gateway.port.ts        (updated signature)
src/ledger/infrastructure/baas/mock-baas.gateway.ts       (updated to match)
src/ledger/infrastructure/baas/anchor-baas.gateway.ts     (new)
src/wallet/application/use-cases/create-virtual-account.use-case.ts (updated)
src/identity/application/use-cases/create-profile.use-case.ts (updated — +email)
src/identity/application/use-cases/resolve-complaince-case.use-case.ts (updated)
src/identity/interface/profile.controller.ts              (updated)
src/wallet/interface/anchor-webhook.controller.ts          (new)
src/ledger/ledger.module.ts                                (one-line swap)
src/wallet/wallet.module.ts                                (register new controller)
```

No schema changes — `VirtualAccount.bankCode` and `Withdrawal.externalReference`
already exist from Ch. 26/27; they're just populated with real Anchor
values instead of mock ones now.

## Real Anchor API Reference (confirmed)

| Purpose | Method + Path |
|---|---|
| Create reserved (virtual) account | `POST /pay/reserved-account` |
| Verify a destination account name | `GET /api/v1/payments/verify-account/{bankIdOrBankCode}/{accountNumber}` |
| Create a counterparty | `POST /api/v1/counterparties` |
| Create a NIP transfer | `POST /api/v1/transfers` |
| Check a transfer by your own reference | `GET /api/v1/transfers/by-reference/:customer-reference` |

Auth: `x-anchor-key` header on every request. Base URLs:
`https://api.sandbox.getanchor.co` (sandbox), `https://api.getanchor.co`
(production).

Webhook event types confirmed relevant here: `payin.received` /
`payment.received` (deposits), `nip.transfer.successful` /
`nip.transfer.failed` / `nip.transfer.reversed` (withdrawal resolution).

## Business Rules

- Cowrie never mints its own NUBAN or bank code — both always come from
  the BaaS partner's response.
- A transfer's real outcome is only ever trusted from a webhook (or
  explicit requery via `by-reference`), never inferred from the
  synchronous creation response.
- Destination account names are verified before a counterparty is
  created.
- Webhook signatures are verified on every request before any business
  logic runs.

## Deferred / Needs Your Own Sandbox to Finish

- The exact path for fetching a `PayIn` resource by id (inferred by
  REST convention, not directly confirmed) — verify against your own
  sandbox once you have access.
- The full webhook payload shape for `nip.transfer.*` events (only the
  `payin.received` example was directly available in the docs fetched)
  — confirm once you can trigger one.
- Retry/backoff on transient Anchor API failures — Ch. 34/35.
- Reconciliation between Cowrie's ledger and Anchor's own records — Ch. 30.

## Definition of Done

- [ ] `BaaSGateway` port updated; `MockBaaSGateway` updated to match,
      still usable for offline dev with a one-line swap back.
- [ ] `AnchorBaaSGateway` implemented against the confirmed endpoints
      above.
- [ ] Ripple through `CreateVirtualAccountUseCase`/`CreateProfileUseCase`/
      `profile.controller.ts` complete; `tsc` clean.
- [ ] `AnchorWebhookController` implemented; signature verification
      matches Anchor's documented HMAC-SHA1/Base64 construction exactly.
- [ ] One-line swap in `ledger.module.ts` confirmed working locally.
- [ ] *(Needs sandbox access)* A real reserved account created, a real
      deposit credited, a real withdrawal resolved via webhook.

## Common Interview Questions

- Why does a real BaaS transfer API almost always resolve
  asynchronously, and what does that force your system's design to do?
- Why is destination account name verification done before creating a
  counterparty rather than skipped?
- What's the actual cryptographic construction Anchor uses for webhook
  signatures, and why does the exact byte sequence hashed matter?
- Why did swapping `MockBaaSGateway` for `AnchorBaaSGateway` require
  zero changes to `InitiateWithdrawalUseCase`, `SettleWithdrawalUseCase`,
  or `ReleaseWithdrawalUseCase`?

## Further Reading (optional)

- [Anchor Developer Onboarding](https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api)
- [Anchor Reserved Accounts](https://docs.getanchor.co/docs/reserved-accounts)
- [Anchor Bank (NIP) Transfer](https://docs.getanchor.co/docs/bank-transfer)
- [Anchor Webhook Verification](https://docs.getanchor.co/docs/verify-webhooks)
- [Anchor Webhook Event Types](https://docs.getanchor.co/docs/event-types-1)
- [Anchor Verify Transfer](https://docs.getanchor.co/docs/verify-transfer-1)
