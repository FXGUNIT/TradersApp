# ADR-011: DDD Bounded Contexts with gRPC Inter-Service Contracts

**Status:** Accepted  
**Date:** 2026-04-04

## Context

The platform has grown across frontend orchestration, ML inference, training, drift handling, and data ingestion.  
Without explicit bounded contexts, cross-module coupling becomes hard to evolve and risky for low-latency paths.

## Decision

Adopt Domain-Driven Design boundaries in a monorepo with gRPC-first service contracts.

- Contexts: Ingestion, Analysis, Learning, BFF Orchestration
- Contracts: `proto/ddd/v1/*.proto`
- Boundary manifest: `architecture/ddd/bounded-contexts.json`
- BFF prediction path supports `grpc` transport with HTTP fallback

## Consequences

### Positive

- Explicit ownership of business capability per service/context.
- Lower latency path available with gRPC where needed.
- Safer incremental migration from existing HTTP flows.
- CI boundary checks prevent accidental architecture drift.

### Tradeoffs

- Additional operational complexity (contract/version management).
- During migration, transport mode must be managed per environment.

