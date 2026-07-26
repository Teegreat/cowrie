# Chapter 7 — NestJS Architecture

## Learning Objectives

- Map NestJS primitives (Module, Controller, Provider, DI) onto Clean
  Architecture's four layers.
- Understand abstract classes as NestJS's idiomatic way to define a port,
  and provider registration as the adapter-binding mechanism.
- Scaffold the real project with a layer-first folder structure.
- Implement a real domain value object (Money) and prove one working
  vertical slice through all four layers.

## Key Concepts

**Layer ↔ NestJS primitive mapping**
- Domain (Entities) → plain TypeScript classes, no `@Injectable()`, no
  framework imports.
- Application (Use Cases) → `@Injectable()` classes depending on
  interfaces (ports), not concrete classes.
- Interface Adapters → `@Controller()` classes; translate HTTP ↔ use
  case, nothing more.
- Infrastructure → `@Injectable()` classes implementing a port, bound to
  it in a module's `providers` array.

**Ports as abstract classes**
- TypeScript interfaces don't exist at runtime, so NestJS convention
  defines a port as an abstract class, then binds a concrete
  implementation via `{ provide: Port, useClass: ConcreteAdapter }`.
- This binding line is the entire mechanism for swapping an adapter
  (e.g. `MockBaaSGateway` → `AnchorBaaSGateway` in Ch. 29) without
  touching the use case or controller.

**Folder structure decision**
- Layer-first (top-level = layer, domain nests inside) chosen for this
  single vertical slice:

  ```
  src/
    domain/
      ledger/
        money.value-object.ts
    application/
      ports/
        baas-gateway.port.ts
      ledger/
        use-cases/
          check-baas-connection.use-case.ts
    infrastructure/
      baas/
        mock-baas.gateway.ts
    interface/
      ledger/
        ledger.controller.ts
        ledger.module.ts
  ```

- Feature-first (top-level = business module) will be reconsidered in
  Ch. 8 once multiple business domains exist — not introduced
  prematurely.

**Money as integer minor units**
- `Money` value object (Ch. 5) implemented for real: stores amount as
  integer minor units (never floats), validates 3-letter currency code,
  enforces same-currency arithmetic. Full multi-currency/precision
  handling deferred to Ch. 24.

## Vertical Slice Built This Chapter

The call chain: `LedgerController` → `CheckBaasConnectionUseCase` →
`BaaSGateway` (port, abstract class) → `MockBaaSGateway` (adapter, bound
in `LedgerModule`). `GET /ledger/baas-check` proves the wiring end to
end. The controller and use case never reference `MockBaaSGateway`
directly — only `LedgerModule`'s `providers` array does. Below is each
file, in dependency order (innermost/domain first), with why it's
shaped the way it is.

### `src/domain/ledger/money.value-object.ts`

Pure domain layer — no imports from NestJS or anything else. It's a
value object (Ch. 5): immutable, no identity, equal if attributes are
equal. Amount is stored as an integer in minor units (kobo) rather than
a float, because floating-point arithmetic on money silently loses
precision — this is the habit Ch. 24 will build on, not replace.

```ts
export class Money {
  // Constructor is private: the only way to get a Money is through
  // Money.of(), which runs validation. This makes an invalid Money
  // unrepresentable rather than something you have to remember to check.
  private constructor(
    private readonly minorUnits: number,
    private readonly currency: string,
  ) {}

  static of(minorUnits: number, currency: string): Money {
    if (!Number.isInteger(minorUnits)) {
      // Floats lose precision on arithmetic (0.1 + 0.2 !== 0.3 in JS).
      // Integer minor units sidestep that entirely.
      throw new Error('Money must be expressed in integer minor units');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Currency must be a 3-letter ISO code');
    }
    return new Money(minorUnits, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits - other.minorUnits, this.currency);
  }

  equals(other: Money): boolean {
    // Value objects are equal by value, not by reference — this is what
    // makes it a value object rather than an entity (Ch. 5).
    return this.minorUnits === other.minorUnits && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    // Without this guard, NGN and USD amounts could be added together
    // as if they were the same unit — a silent, catastrophic bug.
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate on different currencies: ${this.currency} vs ${other.currency}`);
    }
  }

  toString(): string {
    return `${(this.minorUnits / 100).toFixed(2)} ${this.currency}`;
  }
}
```

### `src/application/ports/baas-gateway.port.ts`

This is the port. It lives in the application layer because the
application layer is what *decides it needs* an external banking
connection — the port is a statement of that need, not of any particular
provider's API shape. An abstract class is used instead of a TypeScript
`interface` because interfaces don't exist at runtime and can't be used
as a NestJS DI token by themselves.

```ts
export abstract class BaaSGateway {
  abstract ping(): Promise<string>;
}
```

### `src/infrastructure/baas/mock-baas.gateway.ts`

The adapter. It `extends BaaSGateway` (satisfying the port) and is the
only file in the whole slice that knows it's "the mock" — nothing that
depends on it needs to know that.

```ts
import { Injectable } from '@nestjs/common';
import { BaaSGateway } from '../../application/ports/baas-gateway.port';

@Injectable()
export class MockBaaSGateway extends BaaSGateway {
  async ping(): Promise<string> {
    // Stands in for a real network call to a BaaS sandbox (Ch. 29).
    // Shaped as async now so swapping in a real HTTP call later doesn't
    // change this method's signature or any of its callers.
    return 'pong from mock BaaS';
  }
}
```

### `src/application/ledger/use-cases/check-baas-connection.use-case.ts`

The use case. It depends on `BaaSGateway` — the abstraction — not
`MockBaaSGateway`. This is the line that makes the whole pattern work:
if this constructor imported the mock directly, swapping providers later
would mean editing business logic, not just config.

```ts
import { Injectable } from '@nestjs/common';
import { BaaSGateway } from '../../ports/baas-gateway.port';

@Injectable()
export class CheckBaasConnectionUseCase {
  constructor(private readonly baas: BaaSGateway) {}

  async execute(): Promise<string> {
    return this.baas.ping();
  }
}
```

### `src/interface/ledger/ledger.controller.ts`

The interface adapter. Its only job is translating an HTTP request into
a use-case call and shaping the response — no business logic belongs
here, even something as small as an `if` statement about ping results.

```ts
import { Controller, Get } from '@nestjs/common';
import { CheckBaasConnectionUseCase } from '../../application/ledger/use-cases/check-baas-connection.use-case';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly checkBaasConnection: CheckBaasConnectionUseCase) {}

  @Get('baas-check')
  async baasCheck() {
    return { status: await this.checkBaasConnection.execute() };
  }
}
```

### `src/interface/ledger/ledger.module.ts`

The wiring. This is the **only** file in the entire slice that mentions
`MockBaaSGateway` by name — it's the single seam where an adapter gets
bound to its port. Swap this one line in Ch. 29 and nothing above it
needs to change.

```ts
import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { CheckBaasConnectionUseCase } from '../../application/ledger/use-cases/check-baas-connection.use-case';
import { BaaSGateway } from '../../application/ports/baas-gateway.port';
import { MockBaaSGateway } from '../../infrastructure/baas/mock-baas.gateway';

@Module({
  controllers: [LedgerController],
  providers: [
    CheckBaasConnectionUseCase,
    // This binding is the entire ports-and-adapters mechanism: anything
    // that injects BaaSGateway receives a MockBaaSGateway instance,
    // without knowing that's what it's getting.
    { provide: BaaSGateway, useClass: MockBaaSGateway },
  ],
})
export class LedgerModule {}
```

Register `LedgerModule` in `src/app.module.ts`'s `imports` array to wire
it into the running app.

## Business Rules

- Domain-layer files must contain zero framework imports.
- Use cases and controllers must depend only on port abstractions, never
  concrete infrastructure classes, for anything crossing an external
  boundary.
- Money must always be represented as integer minor units, never a float.

## Definition of Done

- [ ] Project scaffolded with the four-layer folder structure.
- [ ] `Money` value object implemented and unit-tested (valid
      construction, non-integer rejection, mismatched-currency
      rejection, equality).
- [ ] `GET /ledger/baas-check` returns the mock adapter's response
      end-to-end.
- [ ] Can identify the exact line where the adapter is bound and explain
      what changes to swap it.

## Common Interview Questions

- How do you implement ports-and-adapters concretely in NestJS?
- Why is a controller the wrong place for business logic?
- What's the risk of representing money as a raw `number` in TypeScript?
- What would need to change to swap a mock external integration for a
  real one, in a properly layered NestJS app?

## Further Reading (optional)

- NestJS custom providers documentation (`useClass`, `useValue`,
  injection tokens).
