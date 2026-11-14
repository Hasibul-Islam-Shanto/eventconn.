# EventConn backend

Six independently runnable Node.js/Express/TypeScript services. PostgreSQL owns all durable state; RabbitMQ delivers domain events. Redis, real email, and a real payment provider are not part of this service.

## Local setup

Requires Node.js 22.12+, npm, and Docker. From the repository root, start Postgres and RabbitMQ:

```sh
docker compose up -d postgres rabbitmq
```

Postgres is published on `localhost:5433` (`postgres` / `postgres`) so it does not collide with a Postgres already listening on port 5432. The container still uses port 5432 on the Compose network. The first start creates `auth_db`, `event_db`, `booking_db`, `notification_db`, `payment_db`, plus the matching `*_test` databases. RabbitMQ listens on `localhost:5672` (`guest` / `guest`). The management UI is http://localhost:15672.

Then start the services on the host:

```sh
cd server
npm ci
cp .env.example .env
# Generate two independent secrets: openssl rand -hex 32
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Each service must have its own database; database credentials should be scoped accordingly outside local development. Generated Prisma clients and `.env` files are ignored. Do not run `npm run dev` while the full Compose stack is up; both bind ports 4000–4005.

## Docker

From the repository root, one command builds and runs Postgres, RabbitMQ, every backend service, and the Next.js app:

```sh
docker compose up --build
```

Open http://localhost:3000. The gateway is published on port 4000. Other services stay on the Compose network and call each other by service name. `NODE_ENV` stays `development` on the backend so the session cookie works over `http://localhost`. The browser calls `http://localhost:4000/api`, not a Docker hostname.

Compose applies migrations on startup and seeds event categories. Replace `JWT_SECRET` and `INTERNAL_SECRET` in `docker-compose.yml` before using this anywhere other than a local machine. Do not run host processes on ports 3000 or 4000 while this stack is up. To run only the databases for host development, use `docker compose up -d postgres rabbitmq`.

## Services

| Service              | Default port | Database        | Responsibility                                           |
| -------------------- | ------------ | --------------- | -------------------------------------------------------- |
| api-gateway          | 4000         | none            | CORS, request IDs, rate limits, authentication, proxying |
| auth-service         | 4001         | auth_db         | Registration, bcrypt, JWT cookie sessions                |
| event-service        | 4002         | event_db        | Catalog, ownership, publication, ticket definitions      |
| booking-service      | 4003         | booking_db      | Inventory, holds, bookings, payment event consumption    |
| notification-service | 4004         | notification_db | Durable mock notifications                               |
| payment-service      | 4005         | payment_db      | Idempotent mock payment outcomes                         |

The gateway entry point is `http://localhost:4000/api`. Each service exposes `/health`. Startup validates configuration and connects required dependencies before listening. Gateway and auth do not require RabbitMQ. The development runner stops the group when a service fails. A lost broker connection terminates the affected service; restart it after restoring RabbitMQ. Nothing is registered as an operating system service.

Build with `npm run build`. To run an individual compiled service from `server`, use:

```sh
node --env-file=.env dist/apps/auth-service/src/server.js
```

Replace `auth-service` with the desired service name. Set `PORT` only for single-service processes. `npm run dev` uses the six defaults. Configure the service URLs when changing ports.

## API contract

Success: `{ "success": true, "message": "Success", "data": ... }`.
Errors: `{ "success": false, "message": "...", "code": "..." }`.
Paginated lists also return `pagination: { page, limit, total, totalPages }`. Defaults are page 1, limit 20; maximum limit is 100. IDs are UUIDs. Timestamps are ISO 8601 UTC; venue timezone is an IANA name. Money is integer **BDT minor units** (100 = BDT 1.00); MVP booking fees are zero.

Use `credentials: "include"` in frontend requests. Login sets an HTTP-only, SameSite=Lax cookie; production sets Secure. Bearer JWTs are also accepted. Tokens expire after one hour. Logout clears the browser cookie; it does not revoke a copied token before expiry. Cross-origin browser writes are restricted to `CLIENT_ORIGIN` at the gateway. Services also verify JWTs independently and do not trust identity headers.

Registration takes `name`, `email`, `password` (10–72 UTF-8 bytes), and optional `accountType` (`CUSTOMER`, default, or `ORGANIZER`). Self-service organizer enrollment is intentional for this MVP. `role`, `userId`, prices, and totals supplied outside their defined schemas are rejected. Ownership always comes from the authenticated user.

| Method               | Gateway path                                              | Access / input                                                     |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| POST                 | /api/auth/register                                        | Public; registration fields above                                  |
| POST                 | /api/auth/login                                           | Public; email, password                                            |
| POST                 | /api/auth/logout                                          | Clear session cookie                                               |
| GET                  | /api/auth/me                                              | Authenticated                                                      |
| GET                  | /api/events                                               | Public; search, category slug, city, UTC date, page, limit         |
| GET                  | /api/events/:eventId                                      | Public published detail                                            |
| GET                  | /api/categories                                           | Public seeded categories                                           |
| GET                  | /api/venues                                               | Public; up to 100 venues                                           |
| POST                 | /api/organizer/venues                                     | Organizer; name, address, city, timezone                           |
| POST                 | /api/organizer/events                                     | Organizer; event fields below                                      |
| GET                  | /api/organizer/events                                     | Own events; public filters plus status                             |
| GET / PATCH / DELETE | /api/organizer/events/:eventId                            | Owner only                                                         |
| POST                 | /api/organizer/events/:eventId/ticket-types               | Owner; ticket fields below                                         |
| PATCH / DELETE       | /api/organizer/events/:eventId/ticket-types/:ticketTypeId | Owner; draft only                                                  |
| POST                 | /api/bookings/holds                                       | Customer; eventId, ticketTypeId, quantity (1–20)                   |
| GET                  | /api/bookings/holds/:holdId                               | Customer owns hold                                                 |
| POST                 | /api/bookings                                             | Customer; holdId; required Idempotency-Key                         |
| GET                  | /api/bookings                                             | Own bookings; page, limit                                          |
| GET                  | /api/bookings/:bookingId                                  | Customer owns booking                                              |
| PATCH                | /api/bookings/:bookingId/cancel                           | Customer; empty body; unpaid pending booking                       |
| GET                  | /api/organizer/bookings                                   | Own events' bookings; page, limit                                  |
| GET                  | /api/organizer/bookings/:bookingId                        | Organizer owns event                                               |
| POST                 | /api/payments                                             | Customer; bookingId, outcome: SUCCEEDED or FAILED; Idempotency-Key |
| GET                  | /api/payments/:paymentId                                  | Customer owns payment                                              |

Event creation fields: `title`, `slug`, `shortDescription`, `description`, optional `coverImageUrl`, `categoryId`, `venueId`, `startDateTime`, `endDateTime`. New events are drafts. PATCH accepts partial event fields or `status`. Draft → published/cancelled; published → completed/cancelled. Completion requires the event to have ended. Public lists always show published events, regardless of a supplied status filter.

Ticket fields: `name`, optional `description`, `price` in minor units, `capacity`, `salesStartAt`, `salesEndAt`, optional `isActive` (default true). Sales must end by event start. Publish requires at least one active ticket. Published definitions are immutable to avoid changing prices/capacity underneath active reservations. Only draft events/tickets can be deleted. Cancelling an event stops new sales; it does not refund existing bookings. Confirmed booking cancellation/refunds are outside the MVP.

Idempotency keys are 8–128 characters (`A–Z`, `a–z`, digits, `_ . : -`). They are scoped to the authenticated user. Reusing a key with different input returns 409. Only one mock payment is allowed per booking; failure is terminal and a new booking is required to try again. Mock `outcome` is a simulation control, not a real provider callback.

Internal endpoints require `x-internal-secret` and are never exposed by the gateway:

- Event: GET `/internal/ticket-types/:id`, GET `/internal/events/:id`.
- Booking: PUT `/internal/inventory`, GET `/internal/bookings/:id?userId=...`.
- Notification: GET `/internal/notifications/:userId` for mock notification inspection.

## Correctness and service boundaries

Event publication synchronously initializes booking inventory using an authenticated, timed HTTP call. If synchronization fails, publication fails and can be retried. Booking rechecks the live catalog before holding/converting tickets, so partially synchronized draft inventory cannot be sold. Published ticket definitions cannot change. No service reads another service's database.

A hold uses a conditional inventory decrement inside a PostgreSQL transaction. Serializable transactions retry serialization conflicts. Database check constraints prohibit negative inventory and availability above capacity. Hold expiration claims ACTIVE rows transactionally before returning inventory, so concurrent workers cannot release twice.

Holds expire after `HOLD_MINUTES` (default 10). A 30-second worker also cancels abandoned PENDING bookings after ten minutes. Conversion stores a trusted price snapshot and a booking idempotency record in the same transaction. Ownership checks apply to both customer and organizer reads. Payment messages are validated against booking owner, amount and currency. Duplicate messages cannot confirm/cancel twice or release inventory twice. A late success after cancellation/expiry cannot resurrect the booking; this is mock-only behavior, with real payment reconciliation intentionally deferred.

RabbitMQ uses durable topic exchange `eventconn.events`, persistent messages, publisher confirms, prefetch 10, explicit acknowledgments, three delayed retries, and `.dead` queues. Known subscriber queues are declared before publishing so consumers can start later. Queues are `eventconn.booking-payments` and `eventconn.notifications`; each consumer has `.retry` and `.dead` companions. Invalid envelopes go directly to dead-letter; handler failures retry three times. Consumers persist event IDs. Notifications are database records, never real email/SMS.

The roadmap explicitly defers transactional outbox. A crash between a database commit and a broker publish can still leave an event unpublished. Payment retries with the same key republish the same event ID; redelivered payment events also replay their stored booking result event. Booking cancellation retries republish a stable event ID. These recovery paths reduce, but do not eliminate, the crash window. There is no background outbox/reconciliation worker. Dead-letter queues require inspection and controlled replay after the cause is fixed. Payment records can remain committed even when the first publish attempt fails; clients must retry the same request with the same idempotency key.

## Verification

Use dedicated test databases whose names end in `_test` and a dedicated RabbitMQ test vhost. Tests refuse configured database URLs with another suffix.

```sh
cp .env.test.example .env.test
# Docker Compose already creates auth_test, event_test, booking_test,
# notification_test, and payment_test. Migrate those databases:
node --env-file=.env.test --import tsx scripts/database.ts migrate
# Create a dedicated RabbitMQ vhost and grant your test account access:
docker compose exec rabbitmq rabbitmqctl add_vhost eventconn_test
docker compose exec rabbitmq rabbitmqctl set_permissions -p eventconn_test guest '.*' '.*' '.*'
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm audit
```

The suite includes unit logic, Supertest routes, real Prisma/PostgreSQL transactions, simultaneous last-ticket requests, concurrent expiration/cancellation, ownership failures, idempotency conflicts, payment failures, duplicate notifications, and a full HTTP flow across services with deterministic event delivery. `tests/rabbitmq.test.ts` tests actual broker acknowledgments, delayed retries, invalid messages, and dead-letter exhaustion when `TEST_RABBITMQ_URL` is set. Missing database/broker configuration produces explicit skipped suites; it is not evidence that those integrations passed.

The frontend in `client/` calls this gateway. See the [frontend README](../client/README.md) for routes and local run steps.
