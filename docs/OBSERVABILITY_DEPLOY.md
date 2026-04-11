# Observability Deploy Runbook

**Status:** Stub — needs implementation

## Overview

Deploy and configure the full observability stack for TradersApp: Prometheus, Grafana, Loki, and Jaeger.

## Components

| Component | Purpose | Port |
|-----------|---------|------|
| Prometheus | Metrics collection and alerting | 9090 |
| Grafana | Metrics visualization | 3000 |
| Loki | Log aggregation | 3100 |
| Jaeger | Distributed tracing | 16686 |
| Alertmanager | Alert routing | 9093 |

## Deployment

```bash
# Deploy monitoring stack via Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values k8s/helm/observability/values.yaml

# Deploy Loki for logs
helm upgrade --install loki grafana/loki \
  --namespace monitoring \
  --values k8s/helm/observability/loki-values.yaml

# Deploy Jaeger for traces
helm upgrade --install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --values k8s/helm/observability/jaeger-values.yaml
```

## Scrape Config for TradersApp

Add to Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'tradersapp-bff'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__meta_kubernetes_pod_name]
        action: keep
        regex: 'bff-.+'
```

## Dashboards

- Import Grafana dashboards from `k8s/dashboards/`
- Key dashboards: ML Engine Consensus Latency, BFF Error Rate, Redis Cache Hit Rate

## Alerting

- `k8s/alerts/` contains Prometheus alert rules
- Alertmanager routes to Slack/PagerDuty via `alertmanager/config.yaml`

## See Also

- `docs/DEPLOYMENT.md`
- `k8s/helm/observability/`
- `docker-compose.mlflow.yml` — MLflow monitoring
