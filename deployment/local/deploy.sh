#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="eventconn-local"
NAMESPACE="${1:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=========================================================="
echo "      EventConn Local Deployment (KinD + Helm)           "
echo "=========================================================="

echo "=== 1. Checking KinD Cluster ==="
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating KinD cluster '${CLUSTER_NAME}' with localhost port mappings..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${SCRIPT_DIR}/kind-config.yaml"
else
  echo "KinD cluster '${CLUSTER_NAME}' is already running."
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"

echo ""
echo "=== 2. Building & Loading Docker Images into KinD ==="
# Frontend
echo "Building and loading frontend..."
docker build -t ghcr.io/hasibul-islam-shanto/eventconn-frontend:v1.0.0 "${ROOT_DIR}/client"
kind load docker-image ghcr.io/hasibul-islam-shanto/eventconn-frontend:v1.0.0 --name "${CLUSTER_NAME}"

# Backend microservices
SERVICES=("api-gateway" "auth-service" "event-service" "booking-service" "notification-service" "payment-service")
for svc in "${SERVICES[@]}"; do
  echo "Building and loading ${svc}..."
  docker build -t "ghcr.io/hasibul-islam-shanto/eventconn-${svc}:v1.0.0" -f "${ROOT_DIR}/server/apps/${svc}/Dockerfile" "${ROOT_DIR}/server"
  kind load docker-image "ghcr.io/hasibul-islam-shanto/eventconn-${svc}:v1.0.0" --name "${CLUSTER_NAME}"
done

echo ""
echo "=== 3. Deploying via Single Helm Command ==="
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install eventconn "${ROOT_DIR}/deployment/charts/eventconn" \
  --namespace "${NAMESPACE}" \
  -f "${SCRIPT_DIR}/values.yaml"

echo ""
echo "=== 4. Waiting for Services to be Ready ==="
kubectl rollout status deployment/frontend -n "${NAMESPACE}" --timeout=120s || true
kubectl rollout status deployment/api-gateway -n "${NAMESPACE}" --timeout=120s || true

echo ""
echo "=========================================================="
echo "            Local Deployment Succeeded!                   "
echo "=========================================================="
echo "Access your app directly on localhost (no port-forwarding needed):"
echo "  • Frontend:              http://localhost:3000"
echo "  • API Gateway:           http://localhost:4000/api/health"
echo "  • Auth Service:          http://localhost:4001"
echo "  • Event Service:         http://localhost:4002"
echo "  • Booking Service:       http://localhost:4003"
echo "  • Notification Service:  http://localhost:4004"
echo "  • Payment Service:       http://localhost:4005"
echo "  • PostgreSQL:            localhost:5433"
echo "  • RabbitMQ Management:   http://localhost:15672 (guest/guest)"
echo ""
echo "To seed demo accounts and events, run:"
echo "  ./deployment/local/seed.sh"
echo "=========================================================="
