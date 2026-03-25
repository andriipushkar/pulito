# ADR 004: BullMQ Queues

## Status: Implemented

## Context

Need reliable background job processing for order sync, email sending, image processing, and marketplace integration.

## Decision

BullMQ over Agenda and custom cron implementations.

## Implementation

Queues and workers are in `src/lib/queue/`:

- **email** — 5 concurrent, 3 retries with exponential backoff
- **push** — 10 concurrent, 2 retries
- **pdf** — 2 concurrent (CPU-intensive), 2 retries
- **marketplace-sync** — 1 concurrent, 3 retries

Workers are started via `startWorkers()` from `src/lib/queue/workers.ts`.

## Consequences

- Redis-backed — reuses existing Redis infrastructure
- Built-in retry with exponential backoff
- Dead letter queue for failed jobs
- Job priorities, rate limiting, and concurrency control
- Dashboard via Bull Board for monitoring

* Requires Redis (already in stack for caching/rate limiting)
* Jobs are not persisted beyond Redis (acceptable with AOF/RDB)
