# EventConn frontend

The existing Next.js customer and organizer interfaces are connected to the EventConn backend through the API Gateway.

```text
Next.js browser application
          ↓
      API Gateway
          ↓
Auth · Event · Booking · Payment services
          ↓
RabbitMQ → Notification service
```

The browser never calls a microservice directly. It does not read or store JWTs. Login creates an HTTP-only cookie, every API request uses `credentials: "include"`, and `GET /auth/me` is the source of truth after page loads and refreshes.

## Run locally

Start the whole stack from the repository root with `docker compose up --build`, then open http://localhost:3000.

For host development, start only Postgres and RabbitMQ, then the API gateway, using [the backend setup guide](../server/README.md). Publish the gateway on port 4000. Then:

```bash
cd client
npm ci
npm run dev
```

The development frontend runs at http://localhost:3000. When `NEXT_PUBLIC_API_BASE_URL` is unset, the app uses `http://localhost:4000/api`. The Docker image bakes that same URL in at build time. Copy `.env.example` to `.env.local` only to point a host dev server at a different gateway. The API Gateway must set `CLIENT_ORIGIN=http://localhost:3000`. Do not point `NEXT_PUBLIC_API_BASE_URL` at Auth, Event, Booking, or Payment Service. A Docker service hostname is not reachable from the browser. Do not run `npm run dev` on port 3000 while the Compose `web` service is up.

## State ownership

- TanStack Query owns current user, categories, events, holds, bookings, payments, organizer events and organizer bookings.
- Zustand owns only theme and saved-event presentation preferences.
- React Hook Form and Zod own local form state and fast client validation.
- PostgreSQL remains authoritative for price, inventory, hold expiry, booking status and payment status.

The small provider in `src/components/demo-provider.tsx` now supplies theme application and toast feedback only. It contains no mock domain state and persists no users, events, or bookings. `src/mocks/data.ts` contains editorial Unsplash URL generation only.

## Integrated features

Customer features backed by real APIs:

- Registration, login, logout, session restoration and customer route protection
- Backend event categories, discovery, debounced search, filters and pagination
- Event details and ticket definitions
- Atomic ticket holds with a countdown derived from backend `expiresAt`
- Idempotent booking creation and mock payment submission
- Short-lived polling while an asynchronous payment confirmation is pending
- Booking history, booking details and pending-booking cancellation

Organizer features backed by real APIs:

- Organizer route protection and current account display
- Paginated event management, creation, editing and publication
- Venue creation required by the backend event contract
- Ticket type creation, editing and deletion for draft events
- Paginated booking management and booking detail ownership checks
- Dashboard counts, ticket totals and revenue based on real organizer queries

The current backend has no profile-update endpoint, so profile pages show authoritative account fields as read-only while retaining local theme controls. Organizer booking responses contain user IDs rather than names/emails because Booking Service does not query Auth Service. Public event inventory exposes ticket capacity rather than live availability, so the UI does not claim an exact remaining quantity before creating a hold.

## API integration structure

```text
src/
  app/providers.tsx                 TanStack Query and application providers
  lib/env.ts                        Gateway URL
  lib/api-client.ts                 Typed fetch wrapper and normalized ApiError
  lib/query-client.ts               Query defaults
  features/auth/api.ts              Framework-independent auth requests
  features/auth/queries.ts          Auth queries and mutations
  features/events/api.ts            Event response types and mapper
  features/events/queries.ts        Event/category query keys and hooks
  features/bookings/api.ts          Hold, booking and payment requests
  features/bookings/queries.ts      Booking query keys, mutations and polling
  features/organizer/api.ts         Organizer event/ticket/booking requests
  features/organizer/queries.ts     Targeted organizer invalidation
```

GET requests forward TanStack Query's AbortSignal. Event list caches use a 90-second stale time, categories use ten minutes, booking lists use twenty seconds, and current-user data uses two minutes. Background refetches keep existing data visible. Mutations that affect inventory or payment are never optimistic.

Booking and payment calls require a stable UUID idempotency key. Checkout creates one key for each submission attempt and reuses it if the mutation is retried. The booking confirmation view appears only after Booking Service reports a terminal state; payment success alone displays a waiting message.

API errors are normalized into `{ status, message, code, fieldErrors }`. A 401 makes `/auth/me` resolve to an unauthenticated state. A 403 remains a forbidden response, allowing route protection to redirect an authenticated user to the correct experience. Components never display raw SQL, Prisma, network addresses, or stack traces.

## Routes

| Route                                                                            | Data source                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| `/`, `/events`, `/events/[eventId]`                                              | Public Event Service APIs through the gateway |
| `/login`, `/register`                                                            | Auth Service APIs through the gateway         |
| `/bookings`, `/bookings/[bookingId]`, `/profile`                                 | Customer-only queries                         |
| `/organizer`                                                                     | Organizer event and booking queries           |
| `/organizer/events`, `/organizer/events/new`, `/organizer/events/[eventId]/edit` | Organizer event APIs                          |
| `/organizer/tickets`                                                             | Ticket type mutation APIs                     |
| `/organizer/bookings`, `/organizer/bookings/[bookingId]`                         | Organizer booking APIs                        |
| `/organizer/profile`                                                             | Authenticated organizer account               |

## Validation & Testing

```bash
cd client
npm run typecheck
npm run lint
npm test
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api npm run build
npm audit
```

### Automated UI Screenshots (Playwright)

With the backend and frontend running at `http://localhost:3000`:

```bash
# Capture desktop full-page screenshots (1440x900)
npm run screenshots

# Capture both desktop and mobile viewports
npm run screenshots -- --mobile
```

Screenshots are saved in `../screenshots/` categorizing `/public`, `/customer`, and `/organizer` routes.

Focused tests cover UTC sale windows, the backend cancellation state, event response mapping, ticket capacity/price mapping, authoritative booking item snapshots, and venue-timezone conversion. End-to-end browser smoke testing requires the API Gateway and backend dependencies to be running.

The established Midnight Blue + Ice UI, responsive layouts, dark/light/system themes, loading states, empty states and toast feedback remain in place. WebSockets, SSE, real payment providers, offline caching, GraphQL and query-cache persistence remain outside this phase.
