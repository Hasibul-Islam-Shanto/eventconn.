#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="eventconn-local"
NAMESPACE="${1:-default}"

echo "=========================================================="
echo "          EventConn Local Cleanup Selector                "
echo "=========================================================="
echo "1) Full teardown: Delete the entire KinD cluster (frees all memory and ports)"
echo "2) Uninstall app only: Run helm uninstall (keeps KinD cluster running)"
read -rp "Enter choice [1 or 2]: " choice

if [ "$choice" = "1" ]; then
  echo "Deleting KinD cluster '${CLUSTER_NAME}'..."
  kind delete cluster --name "${CLUSTER_NAME}"
  echo "KinD cluster '${CLUSTER_NAME}' deleted successfully!"
elif [ "$choice" = "2" ]; then
  echo "Uninstalling Helm release 'eventconn' from namespace '${NAMESPACE}'..."
  helm uninstall eventconn -n "${NAMESPACE}" || true
  kubectl delete pvc -l app.kubernetes.io/name=postgres -n "${NAMESPACE}" || true
  echo "Application uninstalled successfully!"
else
  echo "Invalid choice. Exiting."
  exit 1
fi
