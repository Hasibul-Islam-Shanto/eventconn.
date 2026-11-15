#!/usr/bin/env bash
# ==============================================================================
# EventConn EC2 Node Provisioning Script (GitOps with ArgoCD & Sealed Secrets)
# Installs: k3s (Kubernetes), Helm 3, Bitnami Sealed Secrets, and ArgoCD
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo "    Provisioning AWS EC2 for EventConn GitOps Stack       "
echo "=========================================================="

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root or with sudo."
  exit 1
fi

# Detect Public IP
PUBLIC_IP=$(curl -s https://checkip.amazonaws.com || curl -s https://ifconfig.me || echo "")
if [ -z "${PUBLIC_IP}" ]; then
  read -rp "Enter EC2 Public IP or Domain: " PUBLIC_IP
fi

echo "EC2 Public IP: ${PUBLIC_IP}"

# 1. Update system packages
echo "--> [1/6] Updating system packages..."
apt-get update -y
apt-get install -y --no-install-recommends \
  curl \
  wget \
  git \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  jq

# 2. Install Helm 3
echo "--> [2/6] Installing Helm 3..."
if ! command -v helm &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
else
  echo "Helm is already installed: $(helm version --short)"
fi

# 3. Install k3s (Lightweight Kubernetes)
echo "--> [3/6] Installing k3s..."
if ! command -v k3s &>/dev/null; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--tls-san ${PUBLIC_IP} --write-kubeconfig-mode 644" sh -
else
  echo "k3s is already installed."
fi

# Wait for k3s node to be ready
echo "Waiting for Kubernetes node to be ready..."
until kubectl get nodes | grep -q "Ready"; do
  sleep 2
done
kubectl get nodes

# 4. Install Bitnami Sealed Secrets Controller & kubeseal CLI
echo "--> [4/6] Installing Bitnami Sealed Secrets Controller..."
SEALED_SECRETS_VERSION="v0.27.3"
kubectl apply -f "https://github.com/bitnami-labs/sealed-secrets/releases/download/${SEALED_SECRETS_VERSION}/controller.yaml"

if ! command -v kubeseal &>/dev/null; then
  echo "Installing kubeseal CLI..."
  ARCH=$(dpkg --print-architecture)
  wget "https://github.com/bitnami-labs/sealed-secrets/releases/download/${SEALED_SECRETS_VERSION}/kubeseal-${SEALED_SECRETS_VERSION#v}-linux-${ARCH}.tar.gz" -O /tmp/kubeseal.tar.gz
  tar -xvzf /tmp/kubeseal.tar.gz -C /usr/local/bin kubeseal
  rm -f /tmp/kubeseal.tar.gz
  chmod +x /usr/local/bin/kubeseal
fi

# 5. Install ArgoCD
echo "--> [5/6] Installing ArgoCD..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "Waiting for ArgoCD server pod to become ready..."
kubectl wait --namespace argocd \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=argocd-server \
  --timeout=240s || true

# 6. Bootstrap ArgoCD App-of-Apps
echo "--> [6/6] Bootstrapping ArgoCD Production App..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -f "${ROOT_DIR}/deployment/argocd/bootstrap/app-of-apps.yaml" ]; then
  kubectl apply -f "${ROOT_DIR}/deployment/argocd/bootstrap/app-of-apps.yaml"
  echo "ArgoCD App-of-Apps applied."
fi

# Fetch initial ArgoCD password
ARGOCD_PW=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || echo "See secret: argocd-initial-admin-secret")

echo ""
echo "=========================================================="
echo "         EC2 GitOps Setup Completed Successfully!         "
echo "=========================================================="
echo "ArgoCD UI Access:"
echo "  • Access via Port-Forward: kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "  • URL:      https://localhost:8080 (or expose via Ingress / NodePort)"
echo "  • Username: admin"
echo "  • Password: ${ARGOCD_PW}"
echo ""
echo "Sealed Secrets:"
echo "  • Controller: Active in kube-system namespace"
echo "  • kubeseal CLI: Installed at /usr/local/bin/kubeseal"
echo ""
echo "GitOps Deployment is now LIVE! ArgoCD will automatically"
echo "sync changes pushed to the 'main' branch in GitHub."
echo "=========================================================="
