# Local Deployment Guide (KinD & Helm)

This folder contains the complete, self-contained configuration and automation scripts to run the EventConn 7-microservice stack locally on macOS/Linux.

---

## Architecture & Port Mapping

Every service binds directly to its native localhost port on your machine using KinD NodePort mappings. **No port forwarding is needed.**

| Service | Localhost URL | KinD NodePort | Description |
| :--- | :--- | :--- | :--- |
| **Frontend** | `http://localhost:3000` | `30000` | Next.js Web App |
| **API Gateway** | `http://localhost:4000` | `30001` | Express Gateway (`/api/health`) |
| **Auth Service** | `http://localhost:4001` | `30002` | User auth & JWT issuance |
| **Event Service** | `http://localhost:4002` | `30003` | Event catalog & tiers |
| **Booking Service** | `http://localhost:4003` | `30004` | Ticket reservations & holds |
| **Notification Service** | `http://localhost:4004` | `30005` | Email & notifications |
| **Payment Service** | `http://localhost:4005` | `30006` | Payment processing |
| **PostgreSQL** | `localhost:5433` | `30007` | PostgreSQL 16 database |
| **RabbitMQ UI** | `http://localhost:15672` | `30008` | Management (`guest` / `guest`) |

---

## Quick Start (Automated)

### 1. Deploy the Complete Stack
Run the single automated deployment script:
```bash
./deployment/local/deploy.sh
```
*What this script does:*
1. Checks and creates the KinD cluster using `kind-config.yaml` (mapping ports `3000`, `4000`, etc.).
2. Builds and loads local Docker images into KinD.
3. Deploys the stack using Helm with `values.yaml`.
4. Waits for pods to be healthy and ready.

### 2. Seed Database with Demo Accounts
Run the seed script:
```bash
./deployment/local/seed.sh
```
*Demo Accounts Created:*
- **Organizer:** `organizer@eventconn.com` / `Password123!`
- **Customer:** `customer@eventconn.com` / `Password123!`

### 3. Cleanup / Teardown
```bash
./deployment/local/clean.sh
```
*Option 1:* Deletes the entire KinD cluster (frees all memory and ports).  
*Option 2:* Uninstalls the Helm release only (keeps cluster running).

---

## Manual Helm Commands (If You Prefer Raw CLI)

### Install / Upgrade:
```bash
helm upgrade --install eventconn deployment/charts/eventconn \
  -n default \
  -f deployment/local/values.yaml
```

### Check Pod Status:
```bash
kubectl get pods -n default
```

### Uninstall:
```bash
helm uninstall eventconn -n default
```

---

## Alternative: Docker Compose (No Kubernetes)

If you prefer running without Kubernetes at any time:
```bash
# Start all containers
docker compose up -d

# Stop all containers
docker compose down
```
All ports bind to the exact same localhost ports listed in the table above.
