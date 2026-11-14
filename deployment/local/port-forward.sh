#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-default}"

echo "=== Forwarding EventConn Ports from Kubernetes (${NAMESPACE}) to Localhost ==="
echo "Frontend:              http://localhost:3000"
echo "API Gateway:           http://localhost:4000 (Health: http://localhost:4000/api/health)"
echo "Auth Service:          http://localhost:4001"
echo "Event Service:         http://localhost:4002"
echo "Booking Service:       http://localhost:4003"
echo "Notification Service:  http://localhost:4004"
echo "Payment Service:       http://localhost:4005"
echo "PostgreSQL:            localhost:5433"
echo "RabbitMQ Management:   http://localhost:15672 (guest/guest)"
echo ""
echo "Press Ctrl+C to terminate all port forwards."

cleanup() {
  echo ""
  echo "Stopping all port forwards..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

kubectl port-forward svc/frontend -n "${NAMESPACE}" 3000:3000 >/dev/null 2>&1 &
kubectl port-forward svc/api-gateway -n "${NAMESPACE}" 4000:4000 >/dev/null 2>&1 &
kubectl port-forward svc/auth-service -n "${NAMESPACE}" 4001:4001 >/dev/null 2>&1 &
kubectl port-forward svc/event-service -n "${NAMESPACE}" 4002:4002 >/dev/null 2>&1 &
kubectl port-forward svc/booking-service -n "${NAMESPACE}" 4003:4003 >/dev/null 2>&1 &
kubectl port-forward svc/notification-service -n "${NAMESPACE}" 4004:4004 >/dev/null 2>&1 &
kubectl port-forward svc/payment-service -n "${NAMESPACE}" 4005:4005 >/dev/null 2>&1 &
kubectl port-forward svc/postgres -n "${NAMESPACE}" 5433:5432 >/dev/null 2>&1 &
kubectl port-forward svc/rabbitmq -n "${NAMESPACE}" 5672:5672 15672:15672 >/dev/null 2>&1 &

wait
