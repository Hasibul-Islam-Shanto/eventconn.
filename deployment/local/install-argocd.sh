#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Installing ArgoCD in cluster ==="
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "Waiting for ArgoCD server to be ready..."
kubectl wait --namespace argocd \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=argocd-server \
  --timeout=180s || true

echo "=== 2. ArgoCD Initial Admin Password ==="
ARGOCD_PW=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "Username: admin"
echo "Password: ${ARGOCD_PW}"
echo ""
echo "=== 3. Starting Port Forward ==="
echo "Run this command to access ArgoCD UI at https://localhost:8080 :"
echo "kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo ""
echo "=== 4. To deploy via ArgoCD App-of-Apps ==="
echo "Ensure your Git repository 'https://github.com/Hasibul-Islam-Shanto/eventconn.git' contains the 'deployment/' folder on 'main'."
echo "Then apply the root application:"
echo "kubectl apply -f deployment/argocd/bootstrap/app-of-apps.yaml"
