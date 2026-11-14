#!/usr/bin/env bash
set -euo pipefail

EC2_IP="${1:-}"
NAMESPACE="${2:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -z "${EC2_IP}" ]; then
  read -rp "Enter your EC2 Public IP or Domain (e.g. 54.210.12.34): " EC2_IP
fi

if [ -z "${EC2_IP}" ]; then
  echo "Error: EC2 Public IP or Domain is required."
  exit 1
fi

echo "=========================================================="
echo "      EventConn Production Deployment (EC2: ${EC2_IP})   "
echo "=========================================================="

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install eventconn "${ROOT_DIR}/deployment/charts/eventconn" \
  --namespace "${NAMESPACE}" \
  -f "${SCRIPT_DIR}/values.yaml" \
  --set frontend.env.NEXT_PUBLIC_API_BASE_URL="http://${EC2_IP}:4000/api" \
  --set api-gateway.env.CLIENT_ORIGIN="http://${EC2_IP}:3000"

echo ""
echo "Waiting for services to become ready..."
kubectl rollout status deployment/frontend -n "${NAMESPACE}" --timeout=120s || true
kubectl rollout status deployment/api-gateway -n "${NAMESPACE}" --timeout=120s || true

echo ""
echo "=========================================================="
echo "            Production Deployment Complete!               "
echo "=========================================================="
echo "Ensure your EC2 Security Group allows inbound traffic for:"
echo "  • Port 3000 (Frontend Web App)"
echo "  • Port 4000 (API Gateway)"
echo ""
echo "Access URLs:"
echo "  • Frontend:    http://${EC2_IP}:3000"
echo "  • API Gateway: http://${EC2_IP}:4000/api/health"
echo "=========================================================="
