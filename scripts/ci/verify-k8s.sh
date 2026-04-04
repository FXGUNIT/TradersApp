#!/bin/sh
set -eu

chart_dir="k8s/helm/tradersapp"
base_values="$chart_dir/values.yaml"
prod_values="$chart_dir/values.prod.yaml"

helm lint "$chart_dir" --values "$base_values" --values "$prod_values"

helm template tradersapp "$chart_dir" \
  --namespace tradersapp \
  --values "$base_values" \
  --values "$prod_values" \
  --set-string imagePullSecrets[0].name=regcred \
  --set-string frontend.image.repository=registry.example.com/example/frontend \
  --set-string frontend.image.tag=test-sha \
  --set-string bff.image.repository=registry.example.com/example/bff \
  --set-string bff.image.tag=test-sha \
  --set-string mlEngine.image.repository=registry.example.com/example/ml-engine \
  --set-string mlEngine.image.tag=test-sha \
  --set-string mlflow.image.repository=registry.example.com/example/mlflow \
  --set-string mlflow.image.tag=test-sha \
  > /dev/null
