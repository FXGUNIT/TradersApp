#!/bin/sh
set -eu

: "${KUBECONFIG_B64:?KUBECONFIG_B64 is required}"
: "${K8S_NAMESPACE:?K8S_NAMESPACE is required}"
: "${K8S_REGISTRY_SECRET:?K8S_REGISTRY_SECRET is required}"
: "${REGISTRY_HOST:?REGISTRY_HOST is required}"
: "${REGISTRY_USERNAME:?REGISTRY_USERNAME is required}"
: "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD is required}"

chart_dir="k8s/helm/tradersapp"
release_name="${K8S_RELEASE_NAME:-tradersapp}"
values_file="${K8S_HELM_VALUES_FILE:-$chart_dir/values.prod.yaml}"
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
  --set-string mlflow.image.repository="$mlflow_repo" \
  --set-string mlflow.image.tag="$image_tag" \
  --wait \
  --timeout 10m

kubectl rollout status deployment/frontend -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/bff -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/ml-engine -n "$K8S_NAMESPACE" --timeout=180s
kubectl rollout status deployment/mlflow -n "$K8S_NAMESPACE" --timeout=180s
kubectl get pods -n "$K8S_NAMESPACE"
