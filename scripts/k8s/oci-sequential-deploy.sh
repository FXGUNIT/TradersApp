#!/bin/bash
# Sequential deploy on OCI k3s - runs on the k3s node itself to avoid network drops
set -euo pipefail

KUBECONFIG="/tmp/k3s-server.yaml"
NAMESPACE="tradersapp"
IMAGE_TAG="${1:-latest}"

echo "=== Sequential Deploy on OCI k3s ==="
echo "Tag: $IMAGE_TAG"

wait_for_kube() {
  local max_attempts=30
  local attempt=1
  while [[ $attempt -le $max_attempts ]]; do
    if kubectl --kubeconfig "$KUBECONFIG" get nodes &>/dev/null; then
      echo "k3s API is ready"
      return 0
    fi
    echo "Waiting for k3s API (attempt $attempt/$max_attempts)..."
    sleep 5
    attempt=$((attempt + 1))
  done
  echo "k3s API not responding after ${max_attempts} attempts"
  return 1
}

echo "Waiting for k3s..."
wait_for_kube

echo "Creating namespace..."
kubectl --kubeconfig "$KUBECONFIG" create namespace "$NAMESPACE" --dry-run=client -o yaml | \
  kubectl --kubeconfig "$KUBECONFIG" apply -f -

echo "Creating secrets..."
kubectl --kubeconfig "$KUBECONFIG" delete secret bff-secrets -n "$NAMESPACE" --ignore-not-found=true
kubectl --kubeconfig "$KUBECONFIG" create secret generic bff-secrets -n "$NAMESPACE" \
  --from-literal=JWT_SECRET=dev-jwt-placeholder-change-in-prod \
  --from-literal=BFF_API_KEY=dev-bff-api-key-placeholder

kubectl --kubeconfig "$KUBECONFIG" delete secret ml-engine-secrets -n "$NAMESPACE" --ignore-not-found=true
kubectl --kubeconfig "$KUBECONFIG" create secret generic ml-engine-secrets -n "$NAMESPACE" \
  --from-literal=KEYCLOAK_CLIENT_SECRET=dev-placeholder \
  --from-literal=AWS_SECRET_ACCESS_KEY=dev-placeholder \
  --from-literal=ALPHAVANTAGE_API_KEY=dev-placeholder

echo "Creating GHCR pull secret..."
GHCR_TOKEN=$(gh auth token)
kubectl --kubeconfig "$KUBECONFIG" delete secret ghcr-pull -n "$NAMESPACE" --ignore-not-found=true
kubectl --kubeconfig "$KUBECONFIG" create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=fxgunit \
  --docker-password="$GHCR_TOKEN" \
  --docker-email=fxgunit@users.noreply.github.com \
  -n "$NAMESPACE"

# Build minimal manifest inline (avoids helm template + network transfer)
MANIFEST="/tmp/tradersapp-${NAMESPACE}.yaml"
cat > "$MANIFEST" << 'ENDOFMANIFEST'
apiVersion: v1
kind: ConfigMap
metadata:
  name: ml-engine-config
  namespace: tradersapp
data:
  KAFKA_ENABLED: "false"
  DATABASE_URL: ""
  MLFLOW_TRACKING_URI: ""
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ml-engine-env
  namespace: tradersapp
data:
  LOG_LEVEL: "INFO"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: bff-config
  namespace: tradersapp
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis"
  ML_ENGINE_URL: "http://ml-engine:8001"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: tradersapp
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: bff
  namespace: tradersapp
spec:
  type: ClusterIP
  selector:
    app: bff
  ports:
  - port: 8788
    targetPort: 8788
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: tradersapp
spec:
  type: ClusterIP
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: ml-engine
  namespace: tradersapp
spec:
  type: ClusterIP
  selector:
    app: ml-engine
  ports:
  - port: 8001
    targetPort: 8001
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: tradersapp
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      imagePullSecrets:
      - name: ghcr-pull
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          limits:
            cpu: 200m
            memory: 128Mi
          requests:
            cpu: 50m
            memory: 64Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bff
  namespace: tradersapp
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: bff
  template:
    metadata:
      labels:
        app: bff
    spec:
      imagePullSecrets:
      - name: ghcr-pull
      containers:
      - name: bff
        image: ghcr.io/fxgunit/bff:IMAGE_TAG_PLACEHOLDER
        ports:
        - containerPort: 8788
        envFrom:
        - configMapRef:
            name: bff-config
        - secretRef:
            name: bff-secrets
        readinessProbe:
          httpGet:
            path: /health
            port: 8788
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          limits:
            cpu: 500m
            memory: 256Mi
          requests:
            cpu: 100m
            memory: 128Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: tradersapp
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      imagePullSecrets:
      - name: ghcr-pull
      containers:
      - name: frontend
        image: ghcr.io/fxgunit/frontend:IMAGE_TAG_PLACEHOLDER
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: 200m
            memory: 128Mi
          requests:
            cpu: 50m
            memory: 64Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-engine
  namespace: tradersapp
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: ml-engine
  template:
    metadata:
      labels:
        app: ml-engine
    spec:
      imagePullSecrets:
      - name: ghcr-pull
      containers:
      - name: ml-engine
        image: ghcr.io/fxgunit/ml-engine:IMAGE_TAG_PLACEHOLDER
        ports:
        - containerPort: 8001
        envFrom:
        - configMapRef:
            name: ml-engine-config
        - configMapRef:
            name: ml-engine-env
        - secretRef:
            name: ml-engine-secrets
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 10
          periodSeconds: 15
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
          requests:
            cpu: 250m
            memory: 256Mi
ENDOFMANIFEST

sed -i "s/IMAGE_TAG_PLACEHOLDER/$IMAGE_TAG/g" "$MANIFEST"
echo "Manifest written to $MANIFEST"

# Deploy redis first, wait for it
echo "Applying manifests..."
kubectl --kubeconfig "$KUBECONFIG" apply -f "$MANIFEST" --validate=false

echo "Waiting for redis pod to be ready..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/redis -n "$NAMESPACE" --timeout=300s || true

wait_for_kube

echo "Waiting for ml-engine pod to be ready..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/ml-engine -n "$NAMESPACE" --timeout=300s || true

wait_for_kube

echo "Waiting for bff pod to be ready..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/bff -n "$NAMESPACE" --timeout=300s || true

wait_for_kube

echo "Waiting for frontend pod to be ready..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/frontend -n "$NAMESPACE" --timeout=300s || true

wait_for_kube

echo ""
echo "=== Final Status ==="
kubectl --kubeconfig "$KUBECONFIG" get pods -n "$NAMESPACE" -o wide

echo ""
echo "Deploy complete."