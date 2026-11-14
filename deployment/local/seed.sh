#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== Seeding EventConn Database ==="

# Check if PostgreSQL is reachable on localhost:5433 directly
if ! nc -z localhost 5433 2>/dev/null; then
  echo "Port 5433 not directly open on host. Setting up temporary port-forward..."
  kubectl port-forward svc/postgres -n "${NAMESPACE}" 5433:5432 >/dev/null 2>&1 &
  PF_PID=$!
  trap 'kill $PF_PID 2>/dev/null || true' EXIT
  sleep 2
fi

(cd "${ROOT_DIR}/server" && npm run db:seed)
echo "=== Seeding Complete! ==="
