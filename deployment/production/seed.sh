#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-production}"

echo "=========================================================="
echo "         Seeding EventConn Demo Data (Kubernetes)         "
echo "=========================================================="

# Delete any old seed pod if left behind
kubectl delete pod eventconn-seed-job -n "${NAMESPACE}" --ignore-not-found=true >/dev/null 2>&1 || true

# Run seed pod attached to terminal, stream output, and auto-delete when done
kubectl run eventconn-seed-job \
  --namespace="${NAMESPACE}" \
  --image="shanto78/eventconn-auth-service:latest" \
  --image-pull-policy="IfNotPresent" \
  --restart=Never \
  --attach \
  --rm \
  --env="AUTH_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/auth_db" \
  --env="EVENT_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/event_db" \
  --env="BOOKING_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/booking_db" \
  --command -- npm run db:seed

echo ""
echo "=========================================================="
echo "             Database Seeding Completed!                  "
echo "=========================================================="
echo "Demo Accounts Created:"
echo "  • Organizer: organizer@eventconn.com / Password123!"
echo "  • Customer:  customer@eventconn.com  / Password123!"
echo "=========================================================="
