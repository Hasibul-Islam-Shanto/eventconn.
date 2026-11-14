# Production Deployment Guide (AWS EC2)

This folder contains the Helm configuration, scripts, and instructions to deploy the EventConn 7-microservice stack to an AWS EC2 instance.

---

## Architecture on EC2

* **Frontend:** Runs on port `3000` (NodePort `30000`).
* **API Gateway:** Runs on port `4000` (NodePort `30001`).
* **Internal Microservices:** Auth (`4001`), Event (`4002`), Booking (`4003`), Notification (`4004`), Payment (`4005`), PostgreSQL (`5432`), RabbitMQ (`5672`).
* **Session Cookies:** Configured for HTTP without requiring TLS/SSL certificates upfront.

---

## Prerequisites on Your EC2 Instance

1. **Kubernetes Cluster:** A running Kubernetes cluster (k3s, microk8s, kubeadm, or KinD) on the EC2 instance.
2. **Helm 3 Installed:** `helm version`
3. **AWS EC2 Security Group Inbound Rules:**
   Allow inbound traffic in your EC2 Security Group for:
   | Port | Protocol | Source | Purpose |
   | :--- | :--- | :--- | :--- |
   | `3000` | TCP | `0.0.0.0/0` | Frontend Web UI |
   | `4000` | TCP | `0.0.0.0/0` | API Gateway |
   | `22` | TCP | Your IP | SSH Access |

---

## Quick Start (Automated Script)

Deploy by passing your EC2 Public IP directly to the deploy script:

```bash
./deployment/production/deploy.sh <YOUR_EC2_IP>
```
*Example:*
```bash
./deployment/production/deploy.sh 54.210.12.34
```

*What this script does:*
1. Creates the `production` namespace.
2. Applies `deployment/production/values.yaml`.
3. Injects `NEXT_PUBLIC_API_BASE_URL="http://<YOUR_EC2_IP>:4000/api"` into the Frontend.
4. Injects `CLIENT_ORIGIN="http://<YOUR_EC2_IP>:3000"` into the API Gateway to allow CORS.
5. Waits for pod rollouts and confirms deployment.

---

## Manual Helm Command (Direct CLI)

If you prefer to deploy using raw Helm commands:

```bash
helm upgrade --install eventconn deployment/charts/eventconn \
  -n production \
  --create-namespace \
  -f deployment/production/values.yaml \
  --set frontend.env.NEXT_PUBLIC_API_BASE_URL="http://<YOUR_EC2_IP>:4000/api" \
  --set api-gateway.env.CLIENT_ORIGIN="http://<YOUR_EC2_IP>:3000"
```

### Check Deployment Status:
```bash
kubectl get pods -n production
```

---

## Customizing Production Secrets

Before going live with real users, change the default secrets in `values.yaml` or pass them via `--set`:

```yaml
infrastructure:
  secrets:
    jwtSecret: "CHANGE_TO_A_CRYPTOGRAPHICALLY_SECURE_KEY_32_CHARS"
    internalSecret: "CHANGE_TO_A_SECURE_INTERNAL_KEY_32_CHARS"
```

---

## Teardown / Uninstall

To remove the deployment and all allocated resources from EC2:

```bash
./deployment/production/clean.sh
```
Or with Helm:
```bash
helm uninstall eventconn -n production
kubectl delete namespace production
```
