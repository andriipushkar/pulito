# ADR 001: Next.js App Router

## Status: Accepted

## Context
Needed a React framework with SSR/ISR for e-commerce SEO and performance.

## Decision
Next.js 16 with App Router over Pages Router, Remix, or Nuxt.

## Consequences
+ Built-in ISR for product/catalog pages
+ React Server Components reduce client JS
+ Streaming SSR with Suspense
- Learning curve for App Router patterns
- Some Next.js-specific APIs lock-in
