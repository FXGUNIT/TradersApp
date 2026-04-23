# TradersApp - OCI Deployment Runbook

Archived reference only.

The active production path is `Contabo VPS + Docker Compose`. Use
[docs/P26_Contabo_Deployment_Plan.md](/e:/TradersApp/docs/P26_Contabo_Deployment_Plan.md:1)
for live production work.

## Archive Status

- Archive date: `2026-04-23`
- Active replacement: `P26 - Contabo VPS Docker Compose Production Path`
- Why OCI was archived:
  - the OCI `E2.1.Micro` node only has `1 GB RAM`
  - the repo's own archived checkpoint concluded that `k3s + etcd + kubelet +
    containerd + the TradersApp core-4 pods` was too heavy for that node as a
    durable production target
  - Contabo proved at least one clean redeploy cycle and public fallback-host
    readiness, so OCI moved to rollback-only status

## Evidence That Allowed Archiving

- Clean Contabo redeploy evidence exists in
  `.artifacts/gh-run-24723298075/`:
  - `bootstrap-and-deploy.log` shows the deploy completed successfully
  - `compose-ps.txt` shows `redis`, `ml-engine`, `analysis-service`, `bff`,
    `frontend`, and the Caddy edge healthy on the VPS
- Latest public fallback-host readiness evidence exists in:
  - `.artifacts/contabo/public-readiness-live-now.json`
  - `.artifacts/gh-run-24829111561/verification-24829111561.json`
- The only remaining active P26 blocker is branded-domain approval and DNS
  propagation for the `is-a.dev` host family, not Contabo stack bring-up

## Final Known OCI Facts

- Provider: Oracle Cloud Infrastructure, `ap-mumbai-1`
- Shape: `VM.Standard.E2.1.Micro`
- Public IP: `144.24.112.249`
- Hostname / node: `tradersapp-oci`
- OS: `Oracle Linux 8.10 aarch64`
- SSH user: `opc`
- k3s install style: manual binary install with swap enabled
- Swap: `2 GB`
- kubeconfig externalization: replace `127.0.0.1` with `144.24.112.249`
- Security requirement: OCI security-list ingress alone was not enough;
  `firewalld` also had to allow `6443/tcp`

## OCI Details Still Worth Keeping

These details remain useful only if OCI is ever revived as a rollback lab.

- k3s startup required `--tls-san=144.24.112.249`
- The k3s server process must not be started with `KUBECONFIG` set in the
  process environment
- `KUBECONFIG_B64` had to be refreshed after cold restarts because regenerated
  kubeconfigs changed contents and tokens
- The direct-apply minimal profile was the only realistic way to approach OCI
  on this node class
- OCI ingress / DNS / TLS phases `P11` to `P16` remain archived in
  [docs/TODO_MASTER_LIST.md](/e:/TradersApp/docs/TODO_MASTER_LIST.md:351)

## Why This Is Not The Live Path

- The node could not be treated as a stable home for the control plane plus the
  app runtime
- OCI phases `P09`, `P11` to `P16`, and `P25` are preserved as historical
  evidence and rollback context only
- Current live deployment, verification, and recovery flow is centered on
  Contabo

## If OCI Ever Has To Be Reopened

Only reopen OCI if Contabo is abandoned or an explicit rollback lab is needed.

Use this order:

1. Re-read the archived OCI checkpoints in
   [docs/TODO_MASTER_LIST.md](/e:/TradersApp/docs/TODO_MASTER_LIST.md:203).
2. Re-validate basic host health on `144.24.112.249`.
3. Reconfirm swap, `firewalld`, and TLS SAN settings before touching CI.
4. Recreate and re-upload `KUBECONFIG_B64`.
5. Treat `P09-C` as the source of truth for any renewed OCI debugging work.

## Source Of Truth

- Active production runbook:
  [docs/P26_Contabo_Deployment_Plan.md](/e:/TradersApp/docs/P26_Contabo_Deployment_Plan.md:1)
- Active master backlog:
  [docs/TODO_MASTER_LIST.md](/e:/TradersApp/docs/TODO_MASTER_LIST.md:1)
