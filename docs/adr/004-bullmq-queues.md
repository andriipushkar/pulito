# ADR 004: BullMQ Queues

## Status: Accepted

## Context
Need reliable background job processing for order sync, email sending, image processing, and marketplace integration.

## Decision
BullMQ over Agenda and custom cron implementations.

## Consequences
+ Redis-backed — reuses existing Redis infrastructure
+ Built-in retry with exponential backoff
+ Dead letter queue for failed jobs
+ Job priorities, rate limiting, and concurrency control
+ Dashboard via Bull Board for monitoring
- Requires Redis (already in stack for caching/rate limiting)
- Jobs are not persisted beyond Redis (acceptable with AOF/RDB)
