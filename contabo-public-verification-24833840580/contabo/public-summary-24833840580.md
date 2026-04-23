## Contabo verification summary

- Generated at: `2026-04-23T11:57:13+00:00`
- Frontend: `https://173.249.18.14.sslip.io`
- BFF: `https://bff.173.249.18.14.sslip.io`
- API: `https://api.173.249.18.14.sslip.io`
- Overall status: `success`
- Failed or blocked checks: `none`

| Check | Status |
|---|---|
| `contabo_bff_ready` | `PASS` |
| `contabo_deep_route_ready` | `PASS` |
| `contabo_dns_complete` | `PASS` |
| `contabo_frontend_ready` | `PASS` |
| `contabo_ml_ready` | `PASS` |
| `contabo_public_chain_ready` | `PASS` |
| `contabo_public_load_envelope_recorded` | `PASS` |
| `contabo_tls_integrity` | `PASS` |

### Load envelope

- Result: `k6 public-edge run completed`
- Envelope recorded: `true`
- Thresholds: `pass`
- HTTP duration p95/p99: `167.7563648` / `191.2171555` ms
- HTTP fail rate: `0.0`%

| Metric | Summary |
|---|---|
| `bff_health_fail_rate` | rate `0.0`% |
| `bff_health_latency_ms` | p95 `159.023932` ms · p99 `170.41488415000006` ms |
| `bff_ml_health_expected_degraded_rate` | rate `0.0`% |
| `bff_ml_health_expected_rate_limited_rate` | rate `0.0`% |
| `bff_ml_health_fail_rate` | rate `0.0`% |
| `bff_ml_health_latency_ms` | p95 `172.76531899999995` ms · p99 `187.39927814000004` ms |
| `edge_health_fail_rate` | rate `0.0`% |
| `edge_health_latency_ms` | p95 `150.03632785000002` ms · p99 `158.2328649` ms |
| `ml_predict_fail_rate` | rate `0.0`% |
| `ml_predict_latency_ms` | p95 `173.77315439999998` ms · p99 `209.60547271999997` ms |
