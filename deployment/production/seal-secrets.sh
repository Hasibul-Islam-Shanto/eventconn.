#!/usr/bin/env bash
# ==============================================================================
# Helper Script: Encrypt Kubernetes Secrets using Bitnami Sealed Secrets
# ==============================================================================
set -euo pipefail

INPUT_FILE="${1:-deployment/production/secrets.yaml}"
OUTPUT_FILE="${2:-deployment/environments/production/sealed-secrets.yaml}"

if [ ! -f "${INPUT_FILE}" ]; then
  echo "Error: Input file '${INPUT_FILE}' not found."
  echo "Create your plain secret file first from the example:"
  echo "  cp deployment/production/secrets.example.yaml deployment/production/secrets.yaml"
  echo "Then edit it with your real production passwords and re-run this script."
  exit 1
fi

if ! command -v kubeseal &>/dev/null; then
  echo "Error: 'kubeseal' CLI is not installed."
  echo "Install it via:"
  echo "  brew install kubeseal (on Mac)"
  echo "  or run ./deployment/production/setup-ec2.sh on your EC2 instance."
  exit 1
fi

echo "=========================================================="
echo " Encrypting Secrets with Bitnami Sealed Secrets"
echo " Input:  ${INPUT_FILE}"
echo " Output: ${OUTPUT_FILE}"
echo "=========================================================="

# Auto-detect or specify the Sealed Secrets controller
CONTROLLER_NS="${SEALED_SECRETS_NS:-kube-system}"
CONTROLLER_NAME="${SEALED_SECRETS_NAME:-sealed-secrets-controller}"

# Check if a public certificate file exists locally (offline mode)
if [ -f "cert.pem" ]; then
  echo "Using local encryption certificate: cert.pem"
  kubeseal --cert cert.pem --format=yaml < "${INPUT_FILE}" > "${OUTPUT_FILE}"
else
  echo "Fetching encryption certificate from cluster (${CONTROLLER_NS}/${CONTROLLER_NAME})..."
  kubeseal \
    --controller-namespace "${CONTROLLER_NS}" \
    --controller-name "${CONTROLLER_NAME}" \
    --format=yaml < "${INPUT_FILE}" > "${OUTPUT_FILE}"
fi

echo ""
echo "✅ Secrets encrypted successfully into '${OUTPUT_FILE}'!"
echo "You can now safely commit '${OUTPUT_FILE}' to Git."
echo "ArgoCD will automatically sync and decrypt it inside your cluster."
echo ""
echo "⚠️  IMPORTANT: Do NOT commit '${INPUT_FILE}' with plaintext secrets to Git!"
