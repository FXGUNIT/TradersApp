#!/bin/bash
# Ultra-minimal sequential deploy - all in one SSH session, no overhead
set -euo pipefail

K8S="/var/lib/rancher/k3s/data/current/bin/kubectl --kubeconfig /tmp/k3s-server.yaml"
NS="tradersapp"

wait_api() {
  for i in $(seq 1 30); do
    if $K8S get ns "$NS" &>/dev/null; then echo "API_OK"; return 0; fi
    sleep 5
  done
  echo "API_TIMEOUT"
  return 1
}

echo "=== [1/7] Waiting for k3s API ==="
wait_api

echo "=== [2/7] Creating namespace ==="
$K8S create namespace "$NS" 2>/dev/null || true

echo "=== [3/7] Creating secrets ==="
$K8S delete secret bff-secrets ml-engine-secrets ghcr-pull -n "$NS" --ignore-not-found=true 2>/dev/null || true
$K8S create secret generic bff-secrets -n "$NS" \
  --from-literal=JWT_SECRET=dev-jwt-placeholder-change-in-prod \
  --from-literal=BFF_API_KEY=dev-bff-api-key-placeholder
$K8S create secret generic ml-engine-secrets -n "$NS" \
  --from-literal=KEYCLOAK_CLIENT_SECRET=dev-placeholder \
  --from-literal=AWS_SECRET_ACCESS_KEY=dev-placeholder \
  --from-literal=ALPHAVANTAGE_API_KEY=dev-placeholder
$K8S apply -f /tmp/ghcr-secret.yaml

echo "=== [4/7] Deploying services ==="
$K8S apply -f - --validate=false << 'SVC_YAML'
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
SVC_YAML

echo "=== [5/7] Deploying redis (1/4) ==="
$K8S delete deployment redis -n "$NS" --ignore-not-found=true 2>/dev/null || true
$K8S apply -f - --validate=false << 'REDIS_YAML'
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
REDIS_YAML

# Wait for redis
for i in $(seq 1 20); do
  if $K8S get pods -n "$NS" -l app=redis --field-selector=status.phase=Running 2>/dev/null | grep -q "1/1"; then
    echo "REDIS_READY"
    break
  fi
  sleep 10
done

wait_api

echo "=== [6/7] Deploying ml-engine (2/4) ==="
$K8S delete deployment ml-engine -n "$NS" --ignore-not-found=true 2>/dev/null || true
$K8S apply -f - --validate=false << 'ML_YAML'
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
        image: ghcr.io/fxgunit/ml-engine:latest
        ports:
        - containerPort: 8001
        env:
        - name: KAFKA_ENABLED
          value: "false"
        - name: DATABASE_URL
          value: ""
        - name: MLFLOW_TRACKING_URI
          value: ""
        envFrom:
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
ML_YAML

for i in $(seq 1 24); do
  if $K8S get pods -n "$NS" -l app=ml-engine --field-selector=status.phase=Running 2>/dev/null | grep -q "1/1"; then
    echo "ML_ENGINE_READY"
    break
  fi
  sleep 10
done

wait_api

echo "=== [7/7] Deploying bff (3/4) ==="
$K8S delete deployment bff -n "$NS" --ignore-not-found=true 2>/dev/null || true
$K8S apply -f - --validate=false << 'BFF_YAML'
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
        image: ghcr.io/fxgunit/bff:latest
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
BFF_YAML

for i in $(seq 1 24); do
  if $K8S get pods -n "$NS" -l app=bff --field-selector=status.phase=Running 2>/dev/null | grep -q "1/1"; then
    echo "BFF_READY"
    break
  fi
  sleep 10
done

wait_api

echo "=== [8/8] Deploying frontend (4/4) ==="
$K8S delete deployment frontend -n "$NS" --ignore-not-found=true 2>/dev/null || true
$K8S apply -f - --validate=false << 'FE_YAML'
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
        image: ghcr.io/fxgunit/frontend:latest
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: 200m
            memory: 128Mi
          requests:
            cpu: 50m
            memory: 64Mi
FE_YAML

for i in $(seq 1 24); do
  if $K8S get pods -n "$NS" -l app=frontend --field-selector=status.phase=Running 2>/dev/null | grep -q "1/1"; then
    echo "FRONTEND_READY"
    break
  fi
  sleep 10
done

echo ""
echo "=== FINAL STATUS ==="
$K8S get pods -n "$NS" -o wide
echo ""
echo "DONE"