# Chapter 14 — Database Performance

## Learning Objectives

- Read `EXPLAIN ANALYZE` output and determine whether a query used an
  index scan or a sequential scan.
- Understand that Postgres does not automatically index foreign key
  columns, and add the missing indexes on `Posting`.
- Understand why balance-style aggregation belongs in a SQL query, not
  a loop over fetched rows in application code.
- Recognize the N+1 query pattern and fix it with Prisma's `include`.
- Understand connection pooling at a conceptual level.
- Enable permanent Prisma query logging (SQL + duration) for use in
  every future chapter.

## Key Concepts

**The gap was real, not hypothetical**
- Inspecting Ch. 13's generated migration SQL showed zero `CREATE INDEX`
  statements — `Posting.accountId` and `Posting.transactionId` had no
  indexes at all, meaning any query filtering by account was a full
  table scan.

**Indexes**
- Added `@@index([accountId])` and `@@index([transactionId])` to the
  `Posting` model, migrated via `prisma migrate dev`.
- Verification requires real data volume *and* real selectivity: a
  first attempt at this exercise put all 200,000 synthetic rows under
  one account, so a query for that account matched ~100% of the table —
  and the planner correctly chose a sequential scan anyway, since an
  index can't help when there's nothing to skip. The fix: spread rows
  across many distinct accounts (1000 accounts, ~200 rows each) so a
  query for one account is genuinely selective (0.1% of the table).
  With the index: `Bitmap Heap Scan`/`Bitmap Index Scan`, ~1.3ms.
  Without it: `Parallel Seq Scan` (even parallelized across workers),
  ~30ms — roughly 23x slower. `Bitmap Index Scan` still means the index
  was used; Postgres picks that variant over a plain `Index Scan` when
  a query matches enough rows that reading heap pages via a bitmap beats
  row-by-row index lookups.

**Aggregation belongs in the database**
- Fetching all rows for an account into Node.js and summing them in a
  loop drags unnecessary data over the network.
- `SELECT direction, SUM("minorUnits") ... GROUP BY direction` computes
  the result inside Postgres, returning only the aggregate. This is the
  technique later wrapped in a real repository method once balance
  reading is actually built (Ch. 25–26) — not implemented as an
  application feature this chapter.

**N+1 queries**
- A query hidden inside a loop: fetching a list, then querying again
  per item. Ten accounts fetched this way means eleven round trips.
- Fixed with Prisma's `include`/`select`, which fetches related rows in
  the same query instead of one-per-item.

**Connection pooling**
- `PrismaService` is one shared, `@Global()` instance; `@prisma/adapter-pg`
  pools connections underneath via `pg`'s connection pool rather than
  opening one connection per request. Unbounded per-request connections
  can exceed Postgres's connection limit and crash it under load.
  Precise pool-size tuning deferred to later deployment chapters.

**Query logging (permanent addition)**
- `PrismaService` now logs every SQL query and its duration via
  Prisma's event-based logging (`log: [{ level: 'query', emit: 'event' }]`)
  — the tool that made every verification in this chapter possible, kept
  on going forward.

## File Changes

`prisma/schema.prisma` — added two `@@index` declarations to `Posting`.

`src/infrastructure/prisma/prisma.service.ts` — added query event
logging via a `Logger` and `this.$on('query', ...)`.

### `src/infrastructure/prisma/prisma.service.ts`

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({
      adapter,
      // Event-based logging (vs the simpler array-of-strings form)
      // gives duration per query, not just the SQL text — duration is
      // what actually tells you whether an index helped.
      log: [{ level: 'query', emit: 'event' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.$on('query' as never, (event: { query: string; duration: number }) => {
      this.logger.debug(`${event.duration}ms  ${event.query}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

If TypeScript complains about `$on`'s exact typed signature, check
`cowrie/.agents/skills/prisma-client-api/references/constructor.md`
directly — the same locally-bundled reference that caught the v6/v7
mismatch in Ch. 13.

## Business Rules

- Every foreign key column used in a `WHERE` filter must have an
  explicit index — never assume Postgres or Prisma added one.
- Balance-style aggregation queries are written as SQL aggregates
  (`SUM`/`GROUP BY`), never as fetch-all-then-sum-in-JS.
- Any list endpoint fetching related data must use `include`/`select`,
  never a per-item query in a loop.

## Definition of Done

- [ ] Confirmed, by inspecting Ch. 13's migration SQL, that no indexes
      existed on `Posting`'s foreign keys.
- [ ] Added `@@index([accountId])` and `@@index([transactionId])`,
      migrated.
- [ ] Generated 200k+ synthetic rows spread across many distinct
      accounts (not one), proved a selective query uses
      `Bitmap Index Scan`/`Index Scan` with the index and falls back to
      `Seq Scan` without it, then cleaned the data up.
- [ ] Can write a `GROUP BY`/`SUM` query computing a balance in SQL
      directly.
- [ ] Can identify an N+1 pattern in a code sample and fix it with
      `include`.
- [ ] Query logging enabled in `PrismaService`, verified showing real
      SQL + duration.

## Common Interview Questions

- Why doesn't Postgres automatically index foreign key columns?
- How do you read an `EXPLAIN ANALYZE` plan to determine whether an
  index was used?
- Why might a query planner choose a sequential scan over an index scan
  on a small table, and is that a problem?
- What is an N+1 query, and how do you fix one in Prisma?
- Why does an application typically use one pooled database connection
  rather than one per request?

## Further Reading (optional)

- PostgreSQL documentation: `EXPLAIN`, indexes, `generate_series`.
- Prisma documentation: logging, `include`/`select`, `groupBy`.
