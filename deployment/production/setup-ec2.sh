#!/usr/bin/env bash
# ==============================================================================
# EventConn EC2 Node Provisioning Script (Ubuntu 22.04 / 24.04 LTS)
# Installs: Docker, k3s (Kubernetes), Helm 3, and configures Kubeconfig for CI/CD
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo "    Provisioning AWS EC2 for EventConn Deployment         "
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
echo "--> [1/5] Updating system packages..."
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
echo "--> [2/5] Installing Helm 3..."
if ! command -v helm &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
else
  echo "Helm is already installed: $(helm version --short)"
fi

# 3. Install k3s (Lightweight Kubernetes) with TLS SAN for remote API access
echo "--> [3/5] Installing k3s..."
if ! command -v k3s &>/dev/null; then
  # Install k3s with the public IP added to the API TLS certificate
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

# 4. Prepare Kubeconfig for GitHub Actions
echo "--> [4/5] Generating GitHub Actions KUBECONFIG..."
K3S_CONFIG="/etc/rancher/k3s/k3s.yaml"
OUTPUT_CONFIG="/home/ubuntu/kubeconfig.yaml"

# Replace 127.0.0.1 with the EC2 Public IP
sed "s/127.0.0.1/${PUBLIC_IP}/g" "${K3S_CONFIG}" > "${OUTPUT_CONFIG}"
chmod 600 "${OUTPUT_CONFIG}"
chown ubuntu:ubuntu "${OUTPUT_CONFIG}"

echo "--> [5/5] Creating production namespace..."
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "=========================================================="
echo "         EC2 Setup Completed Successfully!                "
echo "=========================================================="
echo ""
echo "Next step for GitHub Actions CI/CD:"
echo "1. Run this command on EC2 to copy your Kubeconfig:"
echo ""
echo "   cat /home/ubuntu/kubeconfig.yaml"
echo ""
echo "2. Add the entire output as the GitHub Secret: KUBECONFIG"
echo "=========================================================="
