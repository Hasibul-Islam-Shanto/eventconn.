# EventConn

Customer and organizer experiences share the Next.js app in [`client/`](client/). The API is the gateway in [`server/`](server/).

## Run the whole application

From the repository root:

```bash
docker compose up --build
```

Open http://localhost:3000. The gateway is http://localhost:4000/api. Do not run host processes on ports 3000 or 4000 while this stack is up.

## Run locally

Postgres and RabbitMQ can still run in Docker while the backend and frontend run on the host.

```bash
docker compose up -d postgres rabbitmq
cd server
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

In another terminal:

```bash
cd client
npm ci
npm run dev
```

Open http://localhost:3000. The gateway is http://localhost:4000/api.

See the [backend README](server/README.md) and [frontend README](client/README.md) for service ports, API contracts, and environment variables.
