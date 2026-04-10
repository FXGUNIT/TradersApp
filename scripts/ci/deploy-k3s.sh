#!/bin/sh
set -eu

: "${KUBECONFIG_B64:?KUBECONFIG_B64 is required}"
: "${K8S_NAMESPACE:?K8S_NAMESPACE is required}"
: "${K8S_REGISTRY_SECRET:?K8S_REGISTRY_SECRET is required}"
: "${REGISTRY_HOST:?REGISTRY_HOST is required}"
: "${REGISTRY_USERNAME:?REGISTRY_USERNAME is required}"
: "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD is required}"
: "${MLFLOW_POSTGRES_PASSWORD:?MLFLOW_POSTGRES_PASSWORD is required}"
: "${MLFLOW_MINIO_USER:?MLFLOW_MINIO_USER is required}"
: "${MLFLOW_MINIO_PASSWORD:?MLFLOW_MINIO_PASSWORD is required}"

chart_dir="k8s/helm/tradersapp"
release_name="${K8S_RELEASE_NAME:-tradersapp}"
values_file="${K8S_HELM_VALUES_FILE:-$chart_dir/values.prod.yaml}"
mlflow_secret_name="${MLFLOW_RUNTIME_SECRET:-mlflow-runtime-secret}"
mlflow_postgres_db="${MLFLOW_POSTGRES_DB:-mlflow}"
mlflow_postgres_user="${MLFLOW_POSTGRES_USER:-mlflow}"
dq_alert_webhook="${DQ_ALERT_WEBHOOK:-}"
dq_quarantine_dir="${DQ_QUARANTINE_DIR:-/data/dq_quarantine}"
work_dir="$(mktemp -d)"
kubeconfig_path="$work_dir/kubeconfig"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

printf '%s' "$KUBECONFIG_B64" | base64 -d > "$kubeconfig_path"
export KUBECONFIG="$kubeconfig_path"

frontend_repo="${REGISTRY_HOST}/${CI_REPO_OWNER}/frontend"
bff_repo="${REGISTRY_HOST}/${CI_REPO_OWNER}/bff"
ml_engine_repo="${REGISTRY_HOST}/${CI_REPO_OWNER}/ml-engine"
mlflow_repo="${REGISTRY_HOST}/${CI_REPO_OWNER}/mlflow"
image_tag="${CI_COMMIT_SHA}"

kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret docker-registry "$K8S_REGISTRY_SECRET" \
  --namespace "$K8S_NAMESPACE" \
  --docker-server="$REGISTRY_HOST" \
  --docker-username="$REGISTRY_USERNAME" \
  --docker-password="$REGISTRY_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic "$mlflow_secret_name" \
  --namespace "$K8S_NAMESPACE" \
  --from-literal=POSTGRES_DB="$mlflow_postgres_db" \
  --from-literal=POSTGRES_USER="$mlflow_postgres_user" \
  --from-literal=POSTGRES_PASSWORD="$MLFLOW_POSTGRES_PASSWORD" \
  --from-literal=MINIO_ROOT_USER="$MLFLOW_MINIO_USER" \
  --from-literal=MINIO_ROOT_PASSWORD="$MLFLOW_MINIO_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install "$release_name" "$chart_dir" \
  --namespace "$K8S_NAMESPACE" \
  --values "$chart_dir/values.yaml" \
  --values "$values_file" \
  --set-string imagePullSecrets[0].name="$K8S_REGISTRY_SECRET" \
  --set-string frontend.image.repository="$frontend_repo" \
  --set-string frontend.image.tag="$image_tag" \
  --set-string bff.image.repository="$bff_repo" \
  --set-string bff.image.tag="$image_tag" \
  --set-string mlEngine.image.repository="$ml_engine_repo" \
  --set-string mlEngine.image.tag="$image_tag" \
  --set-string mlEngine.dataQuality.alertWebhook="$dq_alert_webhook" \
  --set-string mlEngine.dataQuality.quarantineDir="$dq_quarantine_dir" \
  --set-string mlflow.secretRef.existingSecret="$mlflow_secret_name" \
  --set-string mlflow.postgres.database="$mlflow_postgres_db" \
  --set-string mlflow.postgres.user="$mlflow_postgres_user" \
  --set-string mlflow.image.repository="$mlflow_repo" \
  --set-string mlflow.image.tag="$image_tag" \
  --wait \
  --timeout 10m

kubectl rollout status deployment/frontend -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/bff -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/ml-engine -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/mlflow -n "$K8S_NAMESPACE" --timeout=180s
kubectl get pods -n "$K8S_NAMESPACE"

# ---------------------------------------------------------------------------
# Post-deploy smoke test (H02) + auto-rollback on failure (H03)
# ---------------------------------------------------------------------------
bff_pod=$(kubectl get pod -n "$K8S_NAMESPACE" -l app=bff -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
ml_pod=$(kubectl get pod -n "$K8S_NAMESPACE" -l app=ml-engine -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

smoke_pass=true

# BFF /health — routed via pod exec so no Ingress dependency
if [ -n "$bff_pod" ]; then
  printf '[smoke] BFF /health ... '
  if ! kubectl exec "$bff_pod" -n "$K8S_NAMESPACE" -- \
       wget -qO- --timeout=10 http://localhost:8788/health > /dev/null 2>&1; then
    printf 'FAIL\n'
    smoke_pass=false
  else
    printf 'OK\n'
  fi
else
  printf '[smoke] BFF pod not found — FAIL\n'
  smoke_pass=false
fi

# ML Engine /health
if [ -n "$ml_pod" ]; then
  printf '[smoke] ML Engine /health ... '
  if ! kubectl exec "$ml_pod" -n "$K8S_NAMESPACE" -- \
       wget -qO- --timeout=10 http://localhost:8001/health > /dev/null 2>&1; then
    printf 'FAIL\n'
    smoke_pass=false
  else
    printf 'OK\n'
  fi
else
  printf '[smoke] ML Engine pod not found — FAIL\n'
  smoke_pass=false
fi

if [ "$smoke_pass" = "false" ]; then
  printf '[smoke] Smoke test FAILED — initiating Helm rollback\n'
  helm rollback "$release_name" -n "$K8S_NAMESPACE" --wait --timeout 5m
  printf '[smoke] Rollback complete. Failing pipeline.\n'
  exit 1
fi

printf '[smoke] All smoke checks PASSED\n'
