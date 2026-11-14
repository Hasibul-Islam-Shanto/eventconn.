#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-production}"

echo "=========================================================="
echo "        EventConn Production Teardown (${NAMESPACE})      "
echo "=========================================================="

echo "Uninstalling Helm release 'eventconn' from namespace '${NAMESPACE}'..."
helm uninstall eventconn -n "${NAMESPACE}" || true

echo "Deleting PVCs..."
kubectl delete pvc -l app.kubernetes.io/name=postgres -n "${NAMESPACE}" || true

echo "Deleting namespace '${NAMESPACE}'..."
kubectl delete namespace "${NAMESPACE}" || true

echo "Production resources removed successfully!"
