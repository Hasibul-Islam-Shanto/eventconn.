# EventConn — Cloud-Native Distributed Event & Ticketing Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20%7C%20React%2019-black?logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%2022%20%7C%20Express-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20(5%20Databases)-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/Broker-RabbitMQ%20AMQP-FF6600?logo=rabbitmq)](https://www.rabbitmq.com/)
[![Docker](https://img.shields.io/badge/Containers-Docker%20%26%20Compose-2496ED?logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes%20%7C%20k3s-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Packaging-Helm%203-0F1689?logo=helm)](https://helm.sh/)
[![ArgoCD](https://img.shields.io/badge/GitOps-ArgoCD-EF7B42?logo=argo)](https://argo-cd.readthedocs.io/)
[![Playwright](https://img.shields.io/badge/Testing-Playwright%20Automation-45ba4b?logo=playwright)](https://playwright.dev/)

---

## 📌 Project Overview

**EventConn** is a cloud-native, distributed event discovery, ticketing, and check-in platform engineered to demonstrate high-concurrency architecture, strict data isolation, and enterprise GitOps continuous delivery.

The platform provides dual experiences tailored for **Customers** (event discovery, dynamic ticket tier reservation, atomic ticket holds, and cryptographically signed QR ticket passes) and **Organizers** (event lifecycle management, venue configuration, attendee tracking, revenue metrics, and live in-browser QR ticket check-in scanning).

### Key Architectural Highlights
- **Microservices Architecture:** 6 decoupled Node.js/Express backend services coordinated behind a unified API Gateway.
- **Database-per-Service Isolation:** 5 dedicated PostgreSQL databases (`auth_db`, `event_db`, `booking_db`, `payment_db`, `notification_db`) ensuring strict domain boundary enforcement without cross-database foreign keys.
- **Asynchronous Event-Driven Messaging:** RabbitMQ AMQP message broker orchestrating eventual consistency, payment status transitions, and durable notification dispatch.
- **Atomic Concurrency Control:** Ticket reservation with server-authoritative countdown hold timers (TTL) to prevent overselling under high demand.
- **Tamper-Proof Offline Verification:** Issued tickets contain HMAC-SHA256 digital signatures embedded into QR codes, enabling offline validation at venue gates.
- **Production GitOps Pipeline:** Declarative continuous deployment using **ArgoCD**, **Bitnami Sealed Secrets**, **Helm 3**, and **Kubernetes (k3s)** hosted on AWS EC2.
- **Automated Visual Verification:** Fully automated headless multi-role **Playwright** test suite capturing pixel-accurate screenshots across public, customer, and organizer user flows.

---

## 🏗️ Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Ingress Layer"]
        UserBrowser["User Browser (Customer / Organizer)"]
        NextClient["Next.js 16 Web Application\n(React 19, TanStack Query, Zustand)"]
        UserBrowser <-->|"HTTP / Session Cookie"| NextClient
    end

    subgraph GatewayLayer ["API Gateway & Ingress"]
        ApiGateway["API Gateway (Port 4000)\n- CORS & Rate Limiting\n- Cookie Session Verification\n- Request ID Tracing & Proxying"]
        NextClient <-->|"HTTP REST (credentials: include)"| ApiGateway
    end

    subgraph Microservices ["Domain Microservices Layer"]
        AuthSvc["Auth Service (Port 4001)\n- Registration & Bcrypt\n- JWT Session Cookies"]
        EventSvc["Event Service (Port 4002)\n- Catalogs & Venues\n- Ticket Definitions & Tiers"]
        BookingSvc["Booking Service (Port 4003)\n- Inventory & Atomic Holds\n- Order State Machine"]
        PaymentSvc["Payment Service (Port 4005)\n- Idempotent Processing\n- Payment Webhooks"]
        NotifSvc["Notification Service (Port 4004)\n- Email Dispatch\n- Durable Notification Logs"]

        ApiGateway <-->|"Internal HTTP"| AuthSvc
        ApiGateway <-->|"Internal HTTP"| EventSvc
        ApiGateway <-->|"Internal HTTP"| BookingSvc
        ApiGateway <-->|"Internal HTTP"| PaymentSvc
        ApiGateway <-->|"Internal HTTP"| NotifSvc
    end

    subgraph PersistenceLayer ["Dedicated Persistence & Event Broker"]
        AuthDB[("auth_db\n(PostgreSQL)")]
        EventDB[("event_db\n(PostgreSQL)")]
        BookingDB[("booking_db\n(PostgreSQL)")]
        PaymentDB[("payment_db\n(PostgreSQL)")]
        NotifDB[("notification_db\n(PostgreSQL)")]

        RabbitMQ{{"RabbitMQ Broker\n(AMQP Exchange / Queues)"}}

        AuthSvc --- AuthDB
        EventSvc --- EventDB
        BookingSvc --- BookingDB
        PaymentSvc --- PaymentDB
        NotifSvc --- NotifDB

        PaymentSvc -->|"payment.succeeded / failed"| RabbitMQ
        RabbitMQ -->|"Consume Payment Events"| BookingSvc
        BookingSvc -->|"booking.confirmed"| RabbitMQ
        RabbitMQ -->|"Consume Order Events"| NotifSvc
    end

    subgraph GitOpsLayer ["Cloud GitOps & Deployment Pipeline"]
        GitRepo["GitHub Repository\n(Manifests + Code)"]
        GHActions["GitHub Actions CI/CD\n- Buildx Matrix\n- Trivy & OWASP Scan"]
        DockerHub["Docker Hub Registry"]
        ArgoCD["ArgoCD Controller\n(Running on AWS EC2 k3s)"]
        SealedSecrets["Bitnami Sealed Secrets Controller"]

        GitRepo --> GHActions
        GHActions -->|"Push Images"| DockerHub
        GitRepo -->|"GitOps Sync"| ArgoCD
        ArgoCD -->|"Reconcile Helm Charts"| Microservices
        SealedSecrets -.->|"Decrypt Secrets"| Microservices
    end
```

---

## 🛠️ Tools Used

| Domain | Technology / Tool | Version / Spec | Purpose in EventConn |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Next.js** | `16.3.4` (App Router) | Server-side rendering, layout nesting, and route handlers |
| | **React** | `19.1.0` | Declarative component UI and server-action hooks |
| | **TypeScript** | `5.9.2` | End-to-end type safety across domain entities and API schemas |
| | **TanStack Query** | `5.102.8` | Client cache management, optimistic query invalidation, and polling |
| | **Tailwind CSS** | `4.1.12` | Design tokens, responsive grid layouts, and midnight-blue dark theme |
| | **React Hook Form + Zod** | `7.62` / `4.1` | Performant client-side validation and schema inference |
| | **HTML5 QR Code** | `2.3.8` | Real-time camera ticket scanning for event check-in |
| **Backend & APIs** | **Node.js** | `22.18.0` (LTS) | Asynchronous microservices runtime |
| | **Express** | `4.21` | Lightweight RESTful microservices and routing gateway |
| | **Prisma ORM** | `5.x` | Strongly typed schema models, migrations, and client generation |
| | **Bcrypt** | `5.1.1` | High-cost salted password hashing |
| | **Crypto (Native)** | Node Built-in | HMAC-SHA256 signature generation for offline ticket pass validation |
| **Data & Messaging**| **PostgreSQL** | `16.x` | 5 isolated relational databases for complete service boundary separation |
| | **RabbitMQ** | `3-management` | AMQP broker managing distributed asynchronous workflows |
| **DevOps & Cloud** | **Docker & Compose** | `29.x` / Compose v2 | Multi-stage image builds and local container orchestrator |
| | **Kubernetes (k3s)** | Lightweight K8s | Resource-efficient production cluster orchestration on AWS EC2 |
| | **KinD** | Local K8s | Kubernetes-in-Docker for local cluster validation |
| | **Helm** | `3.x` | Package management and parameterized deployment charts |
| | **ArgoCD** | Latest | Declarative GitOps deployment engine with automated drift detection |
| | **Bitnami Sealed Secrets** | Controller + `kubeseal`| Asymmetric public-key encryption storing encrypted secrets safely in Git |
| | **GitHub Actions** | CI/CD | Parallel build matrix, caching, vulnerability scanning, and Docker publishing |
| **Testing & Quality**| **Playwright** | `1.65.1` | Headless browser automation, role-based auth simulation, and visual capture |
| | **Node Test Runner** | Native / `tsx` | Focused unit testing for mappers, UTC date windows, and inventory math |
| | **Trivy & OWASP** | Security Linters | Container image vulnerability and CVE dependency scanning |

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js:** `v22.12.0` or higher
- **npm:** `v10.x` or higher
- **Docker & Docker Compose:** Docker Desktop or Docker Engine running locally

---

### Option A: One-Command Full Stack (Docker Compose — Recommended)

Build and boot all 7 microservices, databases, RabbitMQ, and the Next.js frontend with a single command:

```bash
docker compose up --build
```

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **API Gateway:** [http://localhost:4000/api](http://localhost:4000/api)
- **RabbitMQ Management Dashboard:** [http://localhost:15672](http://localhost:15672) (`guest` / `guest`)

Database migrations and initial categories are applied automatically on startup.

---

### Option B: Local Host Development (Hybrid Mode)

Run infrastructure in Docker while developing frontend and backend services directly on the host machine:

#### 1. Start Databases & Message Broker
```bash
docker compose up -d postgres rabbitmq
```
*Note: PostgreSQL is exposed on host port `5434` (or `5433`) to prevent collision with any existing local PostgreSQL service.*

#### 2. Start Backend Microservices
```bash
cd server
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

#### 3. Start Next.js Frontend
In a separate terminal:
```bash
cd client
npm ci
npm run dev
```

---

### Seed Demo Accounts

The database comes pre-configured with complete mock datasets (events in Dhaka, ticket tiers, venues, and sample bookings):

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Organizer** | `organizer@eventconn.com` | `Password123!` | Event creation, edit, attendee lists, ticket tiers, QR scanner |
| **Customer** | `customer@eventconn.com` | `Password123!` | Event browsing, booking tickets, viewing passes & profile |

---

## 🚢 Deployment Steps

EventConn supports two deployment targets: **Local Kubernetes via KinD & Helm** and **Production AWS EC2 via GitOps with ArgoCD**.

---

### Path 1: Local Kubernetes Deployment (KinD & Helm)

Deploy the entire microservice stack into an isolated local Kubernetes cluster with zero port-forwarding required:

```bash
# 1. Run the fully automated deployment script
./deployment/local/deploy.sh
```

**What the script executes:**
1. Provisions a local KinD cluster using [`deployment/local/kind-config.yaml`](deployment/local/kind-config.yaml) with direct NodePort-to-localhost bindings (`30000 -> 3000`, `30001 -> 4000`, etc.).
2. Builds local container images and injects them directly into the KinD control plane.
3. Installs the Helm chart (`deployment/charts/eventconn`) using local parameter overrides.
4. Waits for pod rollouts and healthcheck readiness.

#### Seed KinD Cluster:
```bash
./deployment/local/seed.sh
```

#### Tear Down KinD Cluster:
```bash
./deployment/local/clean.sh
```

---

### Path 2: Production AWS EC2 Deployment (k3s & ArgoCD GitOps)

The production infrastructure runs on an **AWS EC2 instance** running **k3s**, automated by an end-to-end **GitOps continuous delivery loop**.

```
Git Push to main ──▶ GitHub Actions CI (Test, Trivy Scan, Build & Push)
                          │
                          ▼
            Update Manifests in Repository
                          │
                          ▼
             ArgoCD (EC2) Reconciles Cluster ──▶ Zero-Downtime Rolling Update
                          │
                          ▼
            Bitnami Sealed Secrets Decrypted
```

#### 1. EC2 Security Group Prerequisites
Ensure the following ports are open in your AWS EC2 Security Group:
- `3000` (TCP): Frontend Web UI
- `4000` (TCP): API Gateway
- `22` (TCP): SSH Access

#### 2. Bootstrap the Cluster on EC2
SSH into your EC2 instance and execute the automated setup script:
```bash
# Installs k3s, Helm 3, Bitnami Sealed Secrets controller, and ArgoCD
./deployment/production/setup-ec2.sh
```

#### 3. Secure Production Secrets (Bitnami Sealed Secrets)
Never commit plaintext secrets to Git. Encrypt them using `kubeseal` against your cluster's public certificate:
```bash
./deployment/production/seal-secrets.sh
```
This generates `sealed-secrets.yaml`, which is safe to commit into version control.

#### 4. Deploy via Automated Script
```bash
./deployment/production/deploy.sh <YOUR_EC2_PUBLIC_IP>
```
*Example:*
```bash
./deployment/production/deploy.sh 54.210.12.34
```

This injects the dynamic public IP into the frontend environment (`NEXT_PUBLIC_API_BASE_URL="http://54.210.12.34:4000/api"`) and configures the API Gateway's CORS allowlist (`CLIENT_ORIGIN="http://54.210.12.34:3000"`).

#### 5. ArgoCD Continuous Reconciliation
Access the ArgoCD Web Dashboard:
```bash
# Port-forward ArgoCD server (or use LoadBalancer/NodePort)
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
ArgoCD continuously monitors the `main` branch. Any commit that updates container image tags triggers an automatic rolling rollout with zero downtime.

---

## 📸 Screenshots & Application Preview

The visual gallery below was captured automatically using the integrated Playwright automation suite.

### 🌐 Public Experience

| Landing Page | Event Catalog |
| :---: | :---: |
| ![Landing Page](screenshots/public/01-landing-page.png) | ![Event Catalog](screenshots/public/02-event-catalog.png) |

| Event Details & Ticket Tiers | User Sign In |
| :---: | :---: |
| ![Event Details](screenshots/public/03-event-details.png) | ![Sign In](screenshots/public/04-login.png) |

<details>
<summary><b>View Registration Screen</b></summary>
<br>

| Register Page |
| :---: |
| ![Register Page](screenshots/public/05-register.png) |

</details>

---

### 🎟️ Customer Experience

| My Bookings List | Confirmed Booking & Scannable QR Ticket Passes |
| :---: | :---: |
| ![My Bookings](screenshots/customer/01-my-bookings.png) | ![Booking Confirmation](screenshots/customer/02-booking-details.png) |

| Customer Profile |
| :---: |
| ![Customer Profile](screenshots/customer/03-profile.png) |

---

### 🏢 Organizer Experience

| Organizer Dashboard & Metrics | Events Management List |
| :---: | :---: |
| ![Organizer Dashboard](screenshots/organizer/01-dashboard.png) | ![Events Management](screenshots/organizer/02-events-list.png) |

| Create New Event | Edit Event & Ticket Types |
| :---: | :---: |
| ![Create Event](screenshots/organizer/03-create-event.png) | ![Edit Event](screenshots/organizer/04-edit-event.png) |

| Attendee Bookings Overview | Ticket Tiers & Capacity |
| :---: | :---: |
| ![Attendee Bookings](screenshots/organizer/05-bookings-list.png) | ![Ticket Tiers](screenshots/organizer/07-ticket-management.png) |

<details>
<summary><b>View QR Check-In Scanner & Organizer Profile</b></summary>
<br>

| Live QR Ticket Check-In Scanner | Attendee Booking Review |
| :---: | :---: |
| ![QR Ticket Scanner](screenshots/organizer/08-ticket-scanner.png) | ![Booking Review](screenshots/organizer/06-booking-details.png) |

| Organizer Business Profile |
| :---: |
| ![Organizer Profile](screenshots/organizer/09-profile.png) |

</details>

---

### 🤖 Re-Running the Playwright Screenshot Automation

EventConn includes a Playwright script that launches headless Chromium, handles session authentications, traverses all protected views, and outputs refreshed screenshots:

```bash
cd client

# Capture full-page desktop screenshots (1440x900)
npm run screenshots

# Include responsive mobile device viewports
npm run screenshots -- --mobile
```

---

## ⚡ Problems Faced & Engineering Solutions

### 1. GitOps & Cloud Infrastructure Automation
- **Challenge (Managing k3s on Constrained Cloud Compute):** Running a 7-microservice architecture alongside PostgreSQL, RabbitMQ, ArgoCD, and Sealed Secrets controllers on a standard EC2 tier led to memory pressure and out-of-memory (OOM) pod eviction risks.
  - **Solution:** Implemented tight container resource requests and limits (`resources.limits` and `resources.requests`) across all Helm templates. Selected **k3s** instead of standard kubeadm to reduce control-plane memory footprint by over 60%, and configured aggressive image caching in GitHub Actions.
- **Challenge (Zero-Secret Git Repositories):** Standard Kubernetes Secrets are only base64-encoded, making it insecure to commit manifests to GitHub when practicing true GitOps.
  - **Solution:** Integrated **Bitnami Sealed Secrets**. Secrets are encrypted offline using asymmetric cryptography against the cluster's public key certificate. Only the in-cluster controller holds the private decryption key, enabling completely public or team-shared Git manifests without credential exposure risk.
- **Challenge (Declarative Drift & Self-Healing Sync):** Microservices have startup dependencies (e.g., API Gateway requires Auth and Event services; Booking service requires RabbitMQ). When ArgoCD executed out-of-order parallel reconciliations, pods crashed before dependencies were ready.
  - **Solution:** Configured Kubernetes `readinessProbe` and `livenessProbe` on `/health` across all microservices, combined with init containers in Helm charts that assert database and message broker availability before starting the application runtime.

### 2. Cross-Environment Networking & Port Orchestration
- **Challenge (Docker Bridge Networks vs. Host Port Collisions):** Developers frequently run local database servers (e.g. PostgreSQL on default port `5432`). In Docker Compose and KinD, binding port `5432` or `5433` directly to the host caused severe socket binding failures (`bind: address already in use`).
  - **Solution:** Decoupled internal container networking from host networking. Inside Docker and Kubernetes virtual networks, services communicate over standard service discovery hostnames (e.g., `postgres:5432`, `rabbitmq:5672`). Host bindings are offset dynamically (e.g. `5434:5432`) without requiring any environment variable changes inside the microservices.
- **Challenge (Cross-Origin Cookie Session Propagation):** Because the frontend (`localhost:3000`) and the API Gateway (`localhost:4000`) run on different ports, browsers treat requests as cross-origin. Standard cookies were dropped by default, preventing user sessions from persisting.
  - **Solution:** Configured the API Gateway with dynamic CORS reflection (`Access-Control-Allow-Credentials: true` and `Access-Control-Allow-Origin` matching `CLIENT_ORIGIN`), set HTTP-only cookie parameters with `SameSite=Lax` for development, and wrapped the client fetch layer with `credentials: "include"`.
- **Challenge (Headless Browser State in Playwright):** Automated testing across protected customer and organizer routes required maintaining separate authenticated states without leaking session cookies or colliding between test steps.
  - **Solution:** Designed the Playwright automation script with isolated browser contexts (`browser.newContext()`). Each role executes its authentication handshake in an ephemeral context, automatically extracting dynamic event and booking IDs from the DOM before capturing full-page screenshots.

---

## 💡 What You Learned

### 1. Production GitOps as a Software Discipline
Transitioning from traditional CI/CD pushing scripts (`kubectl apply` from an engineer's laptop) to a declarative **GitOps model with ArgoCD** shifted how deployments are perceived:
- **Git is the Ultimate Truth:** Every deployment, rollback, and configuration change exists as a Git commit history. Manual `kubectl edit` interventions are immediately detected and self-healed by ArgoCD.
- **Security-First Pipeline Design:** Implementing asymmetric encryption with **Bitnami Sealed Secrets** demonstrated how to build enterprise-grade, zero-trust infrastructure where even CI runners never hold long-lived cluster credentials.

### 2. Managing Distributed System Complexities
- **Decoupled Relational Boundaries:** Breaking away from monolithic multi-table `JOIN` queries enforced strict architectural hygiene. Designing microservices with dedicated databases proved how domain models remain resilient and independently scalable, while relying on **RabbitMQ** event choreography to handle eventual consistency across the order-to-payment lifecycle.
- **Resilient Architectural Patterns:** Implementing atomic ticket holds, HMAC-signed offline ticket security, and automated end-to-end Playwright visual validation reinforced that software quality is built by anticipating network latency, race conditions, and infrastructure failure modes from day one.

---

## 📄 License & Credits

Built as an open-source, cloud-native engineering benchmark. Developed and maintained by the EventConn engineering team.
