# Production GitOps with ArgoCD & Bitnami Sealed Secrets

This setup establishes a GitOps deployment pipeline using **GitHub Actions**, **Docker Hub**, **ArgoCD**, and **Bitnami Sealed Secrets**.

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
                                                                                         - Pushes :<sha> and :latest
                                                                                         - Uses DOCKERHUB_USERNAME & TOKEN
                                                                                                     |
                                                                                                     v
                                                                                         [ 5. GitOps Promotion ]
                                                                                         - Updates image tags in Git
                                                                                         - Commits to main [skip ci]
                                                                                                     |
                                                                                                     v
                                                                         +-------------------------------------------------------+
                                                                         |                 ArgoCD (Runs on EC2)                  |
                                                                         | - Detects Git commit on 'main'                        |
                                                                         | - Pulls new images from Docker Hub                    |
                                                                         | - Deploys rolling update with zero downtime           |
                                                                         | - Decrypts Sealed Secrets automatically               |
                                                                         +-------------------------------------------------------+
```

---

## Key Advantages of this Architecture

1. **NO `KUBECONFIG` Secret in GitHub:** GitHub does not need access to your Kubernetes API or EC2 machine.
2. **NO Inbound Port 6443 Opened on EC2:** Your EC2 machine does not need to accept inbound traffic from GitHub's cloud; ArgoCD makes *outbound* calls to pull Git updates.
3. **NO Application Secrets in GitHub:** Passwords and tokens are encrypted as `SealedSecret` resources committed to Git. Only your EC2 cluster holds the decryption key.
4. **Self-Healing:** If any pod or service drifts or fails, ArgoCD automatically reconciles it to the state defined in Git.

---

## 1. Secrets & Variables Required in GitHub

Because ArgoCD and Sealed Secrets handle deployment and passwords, your GitHub setup is now minimal:

### 🔐 Repository Secrets (`Settings > Secrets and variables > Actions > Secrets`)

| Secret Name | Required | Description | Example Value |
| :--- | :---: | :--- | :--- |
| `DOCKERHUB_USERNAME` | **Yes** | Your Docker Hub username or organization name | `hasibulshanto` |
| `DOCKERHUB_TOKEN` | **Yes** | Docker Hub Personal Access Token (PAT) with Read/Write | `dckr_pat_xxxxxxxxx` |

*(No other secrets are needed!)*

| Port | Protocol | Source | Purpose |
| :--- | :---: | :--- | :--- |
| `22` | TCP | Your IP | Secure SSH access |
| `30080`| TCP | `0.0.0.0/0` | ArgoCD Web UI (HTTPS) |
| `3000` | TCP | `0.0.0.0/0` | Frontend Web UI |
| `4000` | TCP | `0.0.0.0/0` | API Gateway |
| `80` | TCP | `0.0.0.0/0` | HTTP traffic (Ingress) |
| `443` | TCP | `0.0.0.0/0` | HTTPS traffic (Ingress / SSL) |

---

## 2. Setting Up Your EC2 Machine (One Command)

SSH into your EC2 instance and run the setup script:
```bash
git clone https://github.com/Hasibul-Islam-Shanto/eventconn.git
cd eventconn
sudo ./deployment/production/setup-ec2.sh
```

What this script automatically provisions:
* **k3s:** Lightweight production Kubernetes cluster.
* **Helm 3:** Kubernetes package manager.
* **Bitnami Sealed Secrets Controller & `kubeseal` CLI:** For decrypting secrets.
* **ArgoCD:** Deployed into `argocd` namespace and bootstrapped with the `app-of-apps.yaml`.

---

## 3. How to Manage Secrets with Bitnami Sealed Secrets

1. Copy the example secrets file:
   ```bash
   cp deployment/production/secrets.example.yaml deployment/production/secrets.yaml
   ```
2. Edit `deployment/production/secrets.yaml` with your real production passwords.
3. Encrypt it into a `SealedSecret`:
   ```bash
   ./deployment/production/seal-secrets.sh deployment/production/secrets.yaml deployment/environments/production/sealed-secrets.yaml
   ```
4. Commit the encrypted file:
   ```bash
   git add deployment/environments/production/sealed-secrets.yaml
   git commit -m "feat(secrets): add encrypted sealed secrets"
   git push origin main
   ```
5. ArgoCD automatically applies and decrypts it into Kubernetes secrets.
