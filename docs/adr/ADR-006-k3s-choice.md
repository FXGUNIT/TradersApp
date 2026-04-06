# ADR-006: k3s for Container Orchestration

**ADR ID:** ADR-006
**Title:** k3s for Container Orchestration
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system requires container orchestration for:
- ML Engine (Python FastAPI)
- BFF (Node.js Express)
- Frontend (React/Vite served via nginx)
- Telegram Bridge (Node.js)
- Supporting services (Redis, PostgreSQL, Kafka, MLflow, MinIO)
- Observability stack (Prometheus, Grafana, Loki, Jaeger)

We need orchestration that supports:
- Zero-downtime deployments
- Horizontal pod autoscaling
- Service mesh with mTLS
- Network policies for zero-trust security
- Resource limits per service
- Persistent volumes for ML models and data

## Decision

We will use **k3s** (Lightweight Kubernetes) as the container orchestration platform.

### Cluster Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      k3s Cluster                           │
├─────────────────────────────────────────────────────────────┤
│  Control Plane (1 node)                                     │
│  ├── k3s server                                             │
│  ├── SQLite/etcd                                           │
│  └── Traefik ingress controller                            │
├─────────────────────────────────────────────────────────────┤
│  Worker Nodes (3 nodes minimum)                             │
│  ├── Node 1: ML Engine, MLflow, MinIO                       │
│  ├── Node 2: BFF, Telegram Bridge                          │
│  └── Node 3: Redis, Kafka, PostgreSQL                       │
├─────────────────────────────────────────────────────────────┤
│  Add-ons                                                    │
│  ├── KEDA (autoscaling)                                     │
│  ├── MetalLB (load balancing)                               │
│  ├── Traefik (ingress)                                      │
│  └── CoreDNS (service discovery)                           │
└─────────────────────────────────────────────────────────────┘
```

### Node Specifications

| Node Role | vCPU | RAM | Storage | Purpose |
|-----------|------|-----|---------|---------|
| Control Plane | 2 | 4GB | 50GB | k3s management |
| Worker (ML) | 4 | 16GB | 200GB SSD | ML workloads |
| Worker (App) | 2 | 8GB | 50GB | BFF, Telegram |
| Worker (Data) | 4 | 16GB | 500GB SSD | DB, Cache, Kafka |

### Deployment Strategy

1. **Development:** Single-node k3s on developer machine (Docker Desktop or k3d)
2. **Staging:** 3-node k3s cluster (1 control plane + 2 workers)
3. **Production:** 5-node k3s cluster (HA control plane + 3 workers)

### Helm Charts

All services are deployed via Helm charts:
- `k8s/helm/tradersapp/` — Main application chart
- Official charts for: Redis, PostgreSQL, Kafka (Strimzi), MLflow, MinIO

## Consequences

### Positive
- **Lightweight:** k3s binary is <100MB, uses 512MB RAM vs 2GB+ for standard k8s
- **Single binary:** No dependencies, easy air-gapped installation
- **Production-ready:** CNCF certified, compatible with standard Kubernetes
- **Built-in components:** Traefik, CoreDNS, Helm included
- **Edge-ready:** Can run on ARM devices for edge deployments
- **Easy upgrades:** k3s supports in-place upgrades with rollback
- **Kubernetes ecosystem:** Full access to K8s operators and tooling

### Negative
- **Limited extensibility:** Some K8s features removed (Cloud Controller, alpha APIs)
- **SQLite etcd:** Single control plane uses SQLite (upgrade to embedded etcd for HA)
- **Resource overhead:** Still more overhead than Docker Compose for dev environments
- **Learning curve:** Kubernetes concepts required for all developers
- **Debugging complexity:** More complex to debug than local Docker

### Neutral
- k3s truncates some Kubernetes API fields for simplicity
- Some K8s operators may not work with embedded etcd
- Migration to full Kubernetes possible if needed

## Alternatives Considered

### Docker Compose + Swarm
- Pros: Simple for development, no extra binaries, familiar syntax
- Cons: Limited scaling, no native autoscaling, limited service mesh support
- **Rejected** because we need production-grade features like HPA, network policies

### Amazon EKS / Google GKE
- Pros: Managed control plane, enterprise support, global CDN integration
- Cons: Vendor lock-in, cost (~$70/month per cluster), latency to self-hosted ML
- **Rejected** because we need self-hosted ML with GPU access and cost control

### Full Kubernetes (kubeadm)
- Pros: Maximum compatibility, all K8s features
- Cons: Complex setup, high resource requirements, difficult upgrades
- **Rejected** because k3s provides 95% of features at 10% of overhead

### Nomad by HashiCorp
- Pros: Simple configuration, excellent for microservices
- Cons: Smaller ecosystem, limited K8s compatibility, less community support
- **Rejected** because Kubernetes ecosystem (operators, Helm, tooling) is critical

## References

- [k3s Documentation](https://docs.k3s.io/)
- [k3s Architecture](https://docs.k3s.io/architecture)
- [k3d for local development](https://k3d.io/)
- Related ADRs: [ADR-005 Kafka](ADR-005-kafka-choice.md) (deploys via Strimzi on k3s)
