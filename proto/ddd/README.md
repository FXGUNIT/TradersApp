# DDD gRPC Contracts

Versioned proto contracts for bounded contexts live in `proto/ddd/v1/`.

Current contexts:

- `ingestion.proto`
- `analysis.proto`
- `learning.proto`
- shared types in `common.proto`

These contracts are used for low-latency inter-service calls and should be treated as public APIs between services.

