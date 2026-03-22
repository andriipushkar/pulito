# ADR 003: Typesense Search

## Status: Accepted

## Context
Need full-text search for products with Ukrainian language support, typo tolerance, and faceted filtering.

## Decision
Typesense over Meilisearch and Elasticsearch.

## Consequences
+ Sub-millisecond search latency out of the box
+ Simple setup — single binary, no JVM dependency
+ Low RAM usage compared to Elasticsearch
+ Built-in typo tolerance and Ukrainian stemming
+ Easy geo-search for store locator
- Smaller ecosystem than Elasticsearch
- No complex aggregation pipelines (sufficient for e-commerce)
