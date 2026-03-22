# ADR 002: Prisma ORM

## Status: Accepted

## Context
Need a type-safe database layer with reliable migrations for PostgreSQL.

## Decision
Prisma over Drizzle and TypeORM.

## Consequences
+ Full type safety — generated client matches schema exactly
+ Declarative migrations with `prisma migrate`
+ Large ecosystem: Prisma Studio, Pulse, Accelerate
+ Excellent docs and community support
- Prisma Client adds a generated layer (bundle size)
- Raw SQL escape hatch less ergonomic than Drizzle
- Schema-first approach requires regeneration on changes
