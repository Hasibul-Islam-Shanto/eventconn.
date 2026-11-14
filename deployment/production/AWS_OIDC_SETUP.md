# Production CI/CD Pipeline Guide (Docker Hub & AWS OIDC)

This setup uses **Docker Hub** for container image distribution (tagged by Git commit SHA, `latest`, and environment name) and **AWS OIDC** for secure, secretless authentication to your AWS Kubernetes cluster (Amazon EKS or EC2).

---

## Architecture Flow

```
                                      +---------------------------------------------+
                                      |            GitHub Actions CI/CD             |
                                      +---------------------------------------------+
                                                             |
                 +-------------------------------------------+-------------------------------------------+
                 |                                           |                                           |
                 v                                           v                                           v
       [ 1. Tests & Quality ]                     [ 2. Security Scans ]                       [ 3. Build & Scan (Matrix) ]
   - Client: lint, typecheck, test           - OWASP Dependency-Check (NVD)              - Parallel build for all 7 services
   - Postgres & RabbitMQ containers          - NPM Production Audit                      - Docker Buildx + GHA caching
   - Server: generate, migrate, vitest                                                   - Trivy Vulnerability Scan (SARIF)
                                                                                         - Upload to GitHub Security
                                                                                                     |
                                                                                                     v
                                                                                         [ 4. Push to Docker Hub ]
                                                                                         - Tags: :<sha>, :latest, :<env>
                                                                                         - Uses DOCKERHUB_TOKEN
                                                                                                     |
                                                                                                     v
                                                                                         [ 5. Helm & IaC Trivy Scan ]
                                                                                         - Lint & validate umbrella chart
                                                                                                     |
                                                                                                     v
                                                                                         [ 6. AWS OIDC & Deployment ]
                                                                                         - AWS OIDC assumes IAM Role
                                                                                         - Creates dockerhub-secret in K8s
                                                                                         - Helm upgrade --atomic --timeout 10m
                                                                                         - Automated rollout verification
```

---

## 1. Setting Up Docker Hub

1. Log in to [Docker Hub](https://hub.docker.com).
2. Go to **Account Settings > Security > New Access Token**.
3. Generate a Personal Access Token (PAT) with **Read & Write** permissions (description: `github-actions-eventconn`).
4. Note your **Docker Hub Username** and the **Access Token**.

---

## 2. Setting Up AWS OIDC for Cluster Access

Because you are using AWS for your Kubernetes cluster (EKS or EC2), the pipeline uses AWS OIDC to authenticate without any static AWS keys.

### Automated Setup Script
Run the automated script to configure AWS IAM OIDC:
```bash
./deployment/production/setup-aws-oidc.sh Hasibul-Islam-Shanto eventconn us-east-1
```

Or configure manually in AWS IAM:
* **OIDC Provider:** `https://token.actions.githubusercontent.com` with Audience `sts.amazonaws.com`
* **IAM Role:** `github-actions-eventconn-deploy-role` with trust policy allowing `repo:Hasibul-Islam-Shanto/eventconn:*`
* **Permissions:** `eks:DescribeCluster`, `eks:ListClusters`

---

## 3. Final List of Secrets & Variables

Navigate to **GitHub Repository > Settings > Secrets and variables > Actions**.

### 🔐 Repository Secrets (`Secrets`)

| Secret Name | Required | Description | Example Value |
| :--- | :---: | :--- | :--- |
| `DOCKERHUB_USERNAME` | **Yes** | Your Docker Hub username or organization name | `hasibulshanto` |
| `DOCKERHUB_TOKEN` | **Yes** | Docker Hub Personal Access Token (PAT) with Read/Write | `dckr_pat_xxxxxxxxx` |
| `AWS_ROLE_ARN` | **Yes** | AWS IAM Role ARN for OIDC authentication | `arn:aws:iam::123456789012:role/github-actions-eventconn-deploy-role` |
| `PROD_JWT_SECRET` | **Yes** | Secure JWT signing key (min 32 characters) | `9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c` |
| `PROD_INTERNAL_SECRET` | **Yes** | Internal service-to-service communication token | `8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d` |
| `KUBECONFIG` | Cond. | Base64 or plain Kubeconfig (required if using EC2/k3s instead of EKS) | Content of `~/.kube/config` |
| `PROD_AUTH_DB_URL` | Optional | Custom PostgreSQL URL for Auth DB (uses internal Postgres if omitted) | `postgresql://user:pass@host:5432/auth_db` |
| `PROD_EVENT_DB_URL` | Optional | Custom PostgreSQL URL for Event DB | `postgresql://user:pass@host:5432/event_db` |
| `PROD_BOOKING_DB_URL`| Optional | Custom PostgreSQL URL for Booking DB | `postgresql://user:pass@host:5432/booking_db` |
| `PROD_NOTIFICATION_DB_URL` | Optional | Custom PostgreSQL URL for Notification DB | `postgresql://user:pass@host:5432/notification_db` |
| `PROD_PAYMENT_DB_URL`| Optional | Custom PostgreSQL URL for Payment DB | `postgresql://user:pass@host:5432/payment_db` |
| `PROD_RABBITMQ_URL`  | Optional | Custom RabbitMQ connection URL | `amqp://user:pass@rabbitmq:5672` |
| `PROD_SMTP_USER`     | Optional | SMTP Username for transactional emails | `no-reply@eventconn.com` |
| `PROD_SMTP_PASS`     | Optional | SMTP Password / App Token | `app-password` |

---

### 🌐 Repository Variables (`Variables`)

| Variable Name | Required | Default | Description | Example Value |
| :--- | :---: | :---: | :--- | :--- |
| `AWS_REGION` | **Yes** | `us-east-1` | AWS Region hosting your EKS cluster / EC2 | `us-east-1` |
| `EKS_CLUSTER_NAME` | Cond. | - | Name of your Amazon EKS cluster (if deploying to EKS) | `eventconn-production` |
| `KUBE_NAMESPACE` | No | `production` | Target Kubernetes namespace | `production` |
| `PROD_API_BASE_URL` | No | `http://<EC2_IP>:4000/api` | Public URL for API Gateway accessed by browser client | `https://api.eventconn.com/api` |
| `PROD_CLIENT_ORIGIN`| No | `http://<EC2_IP>:3000` | Frontend Origin permitted by API Gateway CORS | `https://eventconn.com` |
| `PROD_APP_URL`      | No | `http://eventconn.com` | Environment URL link displayed in GitHub Deployment | `https://eventconn.com` |
