# Chapter 13 — Prisma

## Learning Objectives

- Wire Prisma into Clean Architecture as infrastructure, behind a
  `LedgerRepository` port — never called directly from a use case or
  controller.
- Implement Chapter 5's `LedgerTransaction` aggregate as real code,
  enforcing the debit=credit invariant before persistence ever runs.
- Create the real Prisma schema via a reviewable migration, hand-editing
  it to add a CHECK constraint per Chapter 12's discipline.
- Prove the full vertical slice end to end: DTO → domain validation →
  use case → repository → real Postgres rows.

## A note on Prisma versions

This project uses Prisma `7.9.0`, which changed enough from earlier
versions that Prisma now ships upgrade-guidance skills directly inside
the installed package
(`cowrie/.agents/skills/prisma-upgrade-v7/`). Worth checking there
directly for the *installed* version's actual conventions rather than
assuming — this is a fast-moving tool. The differences that matter here:
generator provider is `prisma-client` (not the older `prisma-client-js`)
with a required `output` path; the connection URL lives in a
`prisma.config.ts` at the project root instead of inside
`schema.prisma`; and a SQL provider requires an explicit driver adapter
(`@prisma/adapter-pg`) rather than connecting directly.

## Key Concepts

**Prisma as infrastructure**
- Same category as `MockBaaSGateway` (Ch. 7): sits behind a port
  (`LedgerRepository`); only `PrismaLedgerRepository` imports the
  generated Prisma client directly.

**A third "shared" folder, for a third reason**
- `shared-kernel/` — shared domain concepts, framework-agnostic
  (`Money`).
- `common/` — shared NestJS framework plumbing (`DomainExceptionFilter`).
- `infrastructure/` (new, top-level) — shared infrastructure clients
  multiple modules' adapters depend on (`PrismaService`).

**`LedgerTransaction`, finally real code**
- `LedgerTransaction.balanced()` is the only way to construct one —
  sums signed minor units across postings, rejects if non-zero, rejects
  mixed currencies, rejects fewer than two postings. Ch. 4's invariant,
  enforced structurally, not just documented.
- Required two small public getters on `Money` (`minorUnitsValue`,
  `currencyCode`) so the aggregate can inspect amounts.

**Migrations and constraints**
- `prisma migrate dev --create-only` generates SQL without applying it,
  so a CHECK constraint (`"minorUnits" > 0`) can be hand-added before
  running `prisma migrate dev` to apply — the real-schema version of
  Ch. 12's raw-SQL constraint practice.
- `migrate dev` (versioned, reviewable) is used from here on; `db push`
  is reserved for throwaway prototyping only, since it has no migration
  history.

**Layering discipline maintained**
- Controller (interface layer) converts raw DTO primitives into real
  domain types (`Money.of(...)`) before calling a use case.
- Use case enforces the balance invariant via `LedgerTransaction.balanced()`
  before the repository is ever called — persistence has no business
  logic of its own to violate.

## Folder/File Additions

```
prisma.config.ts
prisma/
  schema.prisma
  migrations/<timestamp>_init_ledger_schema/migration.sql
generated/
  prisma/            # generated client — gitignored, regenerated via `prisma generate`
src/
  infrastructure/
    prisma/
      prisma.service.ts
      prisma.module.ts
  ledger/
    domain/
      ledger-transaction.ts
      ledger-transaction.spec.ts
    application/
      ports/
        ledger-repository.port.ts
      use-cases/
        create-account.use-case.ts
        post-transaction.use-case.ts
    infrastructure/
      persistence/
        prisma-ledger.repository.ts
    interface/
      dto/
        create-account.dto.ts
        post-transaction.dto.ts
```

## Setup

```bash
npm install prisma --save-dev
npm install @prisma/client
npm install dotenv
npm install @prisma/adapter-pg pg
npm install -D @types/pg
npx prisma init
```

### `prisma/schema.prisma`

Models are the real translation of Ch. 4/5's account/posting/transaction
concepts. `LedgerTransaction` (not `Transaction`) avoids colliding with
Prisma's own `$transaction` API and stays unambiguous that this is a
business transaction, not a database one.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  // This project is CommonJS (no "type": "module" in package.json),
  // not Prisma v7's new ESM-first default.
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  // No url here in v7 — connection config lives in prisma.config.ts.
}

enum AccountType {
  ASSET
  LIABILITY
}

enum PostingDirection {
  DEBIT
  CREDIT
}

model Account {
  id          String   @id @default(uuid())
  name        String
  accountType AccountType
  postings    Posting[]
  createdAt   DateTime @default(now())
}

model LedgerTransaction {
  id        String    @id @default(uuid())
  postings  Posting[]
  createdAt DateTime  @default(now())
}

model Posting {
  id            String            @id @default(uuid())
  account       Account           @relation(fields: [accountId], references: [id])
  accountId     String
  transaction   LedgerTransaction @relation(fields: [transactionId], references: [id])
  transactionId String
  minorUnits    BigInt
  currency      String
  direction     PostingDirection
  createdAt     DateTime          @default(now())
}
```

### `prisma.config.ts` (new file, project root)

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### Migration, with the hand-added CHECK constraint

```bash
npx prisma migrate dev --create-only --name init_ledger_schema
```
Add to the generated `migration.sql`:
```sql
ALTER TABLE "Posting" ADD CONSTRAINT "posting_minor_units_positive" CHECK ("minorUnits" > 0);
```
Then apply it:
```bash
npx prisma migrate dev
```

### `.gitignore` addition

```
/generated/prisma
```
The client is generated code now, not a `node_modules` package — never commit it, always regenerate with `npx prisma generate`.

## The domain aggregate, finally as real code

`src/shared-kernel/money.value-object.ts` — add two getters (everything else about `Money` is unchanged):
```ts
  get minorUnitsValue(): number {
    return this.minorUnits;
  }

  get currencyCode(): string {
    return this.currency;
  }
```

`src/ledger/domain/ledger-transaction.ts` — pure domain, no NestJS or Prisma import:
```ts
import { Money } from '../../shared-kernel/money.value-object';
import { DomainException } from '../../shared-kernel/domain-exception';

export type PostingDirection = 'DEBIT' | 'CREDIT';

export interface PostingInput {
  accountId: string;
  money: Money;
  direction: PostingDirection;
}

export class LedgerTransaction {
  private constructor(readonly postings: PostingInput[]) {}

  // The only way to get a LedgerTransaction is through balanced(), which
  // enforces Ch. 4's invariant — there is no other path to construct
  // one, which is what makes the invariant structural rather than
  // remembered.
  static balanced(postings: PostingInput[]): LedgerTransaction {
    if (postings.length < 2) {
      throw new DomainException('A transaction requires at least two postings');
    }

    const currency = postings[0].money.currencyCode;
    const netMinorUnits = postings.reduce((sum, posting) => {
      if (posting.money.currencyCode !== currency) {
        throw new DomainException('All postings in a transaction must share one currency');
      }
      const signed = posting.direction === 'DEBIT' ? posting.money.minorUnitsValue : -posting.money.minorUnitsValue;
      return sum + signed;
    }, 0);

    if (netMinorUnits !== 0) {
      throw new DomainException(
        `Transaction does not balance: debits and credits differ by ${Math.abs(netMinorUnits)} minor units`,
      );
    }

    return new LedgerTransaction(postings);
  }
}
```

`src/ledger/domain/ledger-transaction.spec.ts` — pure domain logic, no database needed:
```ts
import { LedgerTransaction } from './ledger-transaction';
import { Money } from '../../shared-kernel/money.value-object';

describe('LedgerTransaction.balanced', () => {
  it('accepts a balanced pair of postings', () => {
    const transaction = LedgerTransaction.balanced([
      { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
      { accountId: 'b', money: Money.of(1000, 'NGN'), direction: 'CREDIT' },
    ]);
    expect(transaction.postings).toHaveLength(2);
  });

  it('rejects an unbalanced transaction', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(500, 'NGN'), direction: 'CREDIT' },
      ]),
    ).toThrow('Transaction does not balance');
  });

  it('rejects mixed currencies', () => {
    expect(() =>
      LedgerTransaction.balanced([
        { accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' },
        { accountId: 'b', money: Money.of(1000, 'USD'), direction: 'CREDIT' },
      ]),
    ).toThrow('must share one currency');
  });

  it('rejects fewer than two postings', () => {
    expect(() =>
      LedgerTransaction.balanced([{ accountId: 'a', money: Money.of(1000, 'NGN'), direction: 'DEBIT' }]),
    ).toThrow('at least two postings');
  });
});
```

## Prisma as infrastructure (v7: driver adapter required)

`src/infrastructure/prisma/prisma.service.ts`
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // v7 requires an explicit driver adapter for SQL providers — no more
    // connecting directly with just a URL.
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`src/infrastructure/prisma/prisma.module.ts`
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() so every module can inject PrismaService without each one
// re-importing PrismaModule — there's exactly one DB client for the
// whole app, so this is one of the rare cases global scope is correct.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Import `PrismaModule` once, in `src/app.module.ts`'s `imports` array.

## The repository port and adapter

`src/ledger/application/ports/ledger-repository.port.ts`
```ts
import { LedgerTransaction } from '../../domain/ledger-transaction';

export abstract class LedgerRepository {
  abstract createAccount(input: { name: string; accountType: 'ASSET' | 'LIABILITY' }): Promise<string>;
  abstract saveTransaction(transaction: LedgerTransaction): Promise<string>;
}
```

`src/ledger/infrastructure/persistence/prisma-ledger.repository.ts` — the only file that imports the generated Prisma client's types directly.
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LedgerRepository } from '../../application/ports/ledger-repository.port';
import { LedgerTransaction } from '../../domain/ledger-transaction';

@Injectable()
export class PrismaLedgerRepository extends LedgerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createAccount(input: { name: string; accountType: 'ASSET' | 'LIABILITY' }): Promise<string> {
    const account = await this.prisma.account.create({ data: input });
    return account.id;
  }

  async saveTransaction(transaction: LedgerTransaction): Promise<string> {
    const created = await this.prisma.ledgerTransaction.create({
      data: {
        postings: {
          create: transaction.postings.map((posting) => ({
            accountId: posting.accountId,
            minorUnits: posting.money.minorUnitsValue,
            currency: posting.money.currencyCode,
            direction: posting.direction,
          })),
        },
      },
    });
    return created.id;
  }
}
```

## Use cases

`src/ledger/application/use-cases/create-account.use-case.ts`
```ts
import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../ports/ledger-repository.port';

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  execute(input: { name: string; accountType: 'ASSET' | 'LIABILITY' }): Promise<string> {
    return this.ledgerRepository.createAccount(input);
  }
}
```

`src/ledger/application/use-cases/post-transaction.use-case.ts`
```ts
import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../ports/ledger-repository.port';
import { LedgerTransaction, PostingInput } from '../../domain/ledger-transaction';

@Injectable()
export class PostTransactionUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  execute(postings: PostingInput[]): Promise<string> {
    // The balance invariant is enforced here, before the repository ever
    // sees the data — persistence has no business logic of its own to
    // violate.
    const transaction = LedgerTransaction.balanced(postings);
    return this.ledgerRepository.saveTransaction(transaction);
  }
}
```

## DTOs and controller

`src/ledger/interface/dto/create-account.dto.ts`
```ts
import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['ASSET', 'LIABILITY'])
  accountType: 'ASSET' | 'LIABILITY';
}
```

`src/ledger/interface/dto/post-transaction.dto.ts`
```ts
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsString, Length, ValidateNested } from 'class-validator';

class PostingDto {
  @IsString()
  accountId: string;

  @IsInt()
  minorUnits: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsIn(['DEBIT', 'CREDIT'])
  direction: 'DEBIT' | 'CREDIT';
}

export class PostTransactionDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  postings: PostingDto[];
}
```

`src/ledger/interface/ledger.controller.ts` (full file, with the two new endpoints added):
```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CheckBaasConnectionUseCase } from '../application/use-cases/check-baas-connection.use-case';
import { CreateAccountUseCase } from '../application/use-cases/create-account.use-case';
import { PostTransactionUseCase } from '../application/use-cases/post-transaction.use-case';
import { CheckMoneyDto } from './dto/check-money.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { PostTransactionDto } from './dto/post-transaction.dto';
import { Money } from '../../shared-kernel/money.value-object';

@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly checkBaasConnection: CheckBaasConnectionUseCase,
    private readonly createAccount: CreateAccountUseCase,
    private readonly postTransaction: PostTransactionUseCase,
  ) {}

  @Get('baas-check')
  async baasCheck() {
    return { status: await this.checkBaasConnection.execute() };
  }

  @Post('money-check')
  moneyCheck(@Body() dto: CheckMoneyDto) {
    const money = Money.of(dto.minorUnits, dto.currency);
    return { formatted: money.toString() };
  }

  @Post('accounts')
  async createAccountEndpoint(@Body() dto: CreateAccountDto) {
    const id = await this.createAccount.execute(dto);
    return { id };
  }

  @Post('transactions')
  async postTransactionEndpoint(@Body() dto: PostTransactionDto) {
    // Controller's job: translate raw DTO primitives into real domain
    // types (Money) before the application layer ever sees them.
    const postings = dto.postings.map((posting) => ({
      accountId: posting.accountId,
      money: Money.of(posting.minorUnits, posting.currency),
      direction: posting.direction,
    }));
    const id = await this.postTransaction.execute(postings);
    return { id };
  }
}
```

`src/ledger/ledger.module.ts` (full file, with the new providers registered):
```ts
import { Module } from '@nestjs/common';
import { LedgerController } from './interface/ledger.controller';
import { CheckBaasConnectionUseCase } from './application/use-cases/check-baas-connection.use-case';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case';
import { PostTransactionUseCase } from './application/use-cases/post-transaction.use-case';
import { BaaSGateway } from './application/ports/baas-gateway.port';
import { MockBaaSGateway } from './infrastructure/baas/mock-baas.gateway';
import { LedgerRepository } from './application/ports/ledger-repository.port';
import { PrismaLedgerRepository } from './infrastructure/persistence/prisma-ledger.repository';

@Module({
  controllers: [LedgerController],
  providers: [
    CheckBaasConnectionUseCase,
    CreateAccountUseCase,
    PostTransactionUseCase,
    { provide: BaaSGateway, useClass: MockBaaSGateway },
    { provide: LedgerRepository, useClass: PrismaLedgerRepository },
  ],
  exports: [],
})
export class LedgerModule {}
```

## Verifying it end to end

```bash
npm test
npm run start:dev
```
Create two accounts (a pooled asset account, a customer wallet liability account) via `POST /ledger/accounts`, note the returned ids, then post a balanced transaction via `POST /ledger/transactions` referencing both — that's a deposit, expressed exactly as Ch. 4 taught: debit the pooled asset account, credit the customer's wallet liability account. Try an unbalanced pair too and confirm a `DomainException`-shaped 400, not a raw 500. Finally, run `npx prisma studio` and visually confirm the `Account`, `LedgerTransaction`, and `Posting` rows are really there, correctly linked.

## Database Changes

`Account` (id, name, accountType: ASSET|LIABILITY), `LedgerTransaction`
(id — named to avoid colliding with Prisma's own `$transaction` API),
`Posting` (accountId, transactionId, minorUnits BigInt, currency,
direction: DEBIT|CREDIT), plus a hand-added
`CHECK ("minorUnits" > 0)` constraint on `Posting`.

## APIs Implemented

- `POST /ledger/accounts` — `{ name, accountType }` → `{ id }`.
- `POST /ledger/transactions` — `{ postings: [{ accountId, minorUnits,
  currency, direction }, ...] }` → `{ id }`; rejects unbalanced or
  mixed-currency postings with a `DomainException`-shaped 400.

## Business Rules

- No file outside `PrismaLedgerRepository` may import the generated
  Prisma client directly.
- A `LedgerTransaction` can only be constructed via `.balanced()`, which
  must reject fewer than two postings, non-zero net minor units, or
  mixed currencies.
- Every migration is created via `prisma migrate dev`, never `db push`,
  beyond throwaway prototyping.
- The generated Prisma client folder is never committed; it's
  regenerated via `npx prisma generate`.

## Definition of Done

- [ ] Prisma v7 installed with dotenv and the `@prisma/adapter-pg` driver
      adapter; `prisma.config.ts` created.
- [ ] Schema written, migration created, hand-edited for the CHECK
      constraint, then applied.
- [ ] `LedgerTransaction.balanced()` implemented and unit-tested (valid,
      unbalanced, mixed-currency, too-few-postings cases).
- [ ] `PrismaService`/`PrismaModule` wired globally, using the driver
      adapter.
- [ ] `LedgerRepository` port + `PrismaLedgerRepository` adapter
      implemented.
- [ ] `POST /ledger/accounts` and `POST /ledger/transactions` both
      working end to end, verified visually in Prisma Studio.
- [ ] `generated/prisma` added to `.gitignore`.

## Common Interview Questions

- Why shouldn't a controller or use case import the Prisma client
  directly?
- Where should the "debits equal credits" check live, and why not
  inside the repository?
- What's the difference between `prisma migrate dev` and
  `prisma db push`, and when would you use each?
- How do you add a CHECK constraint Prisma's schema language doesn't
  support natively?
- Why does Prisma v7 require an explicit driver adapter for SQL
  providers?

## Further Reading (optional)

- Prisma documentation: migrations, schema reference, Prisma Studio,
  driver adapters.
- The installed package's own upgrade skill:
  `cowrie/.agents/skills/prisma-upgrade-v7/SKILL.md`.
