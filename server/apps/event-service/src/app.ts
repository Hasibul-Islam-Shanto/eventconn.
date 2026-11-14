import type { PrismaClient } from "../generated/client/index.js";
import { z } from "zod";
import {
  assert,
  baseApp,
  finish,
  ok,
  authenticate,
  identity,
  role,
  internal,
  paged,
  uuid,
  requestId,
} from "../../../packages/config/src/http.js";
import type {
  Publisher,
  TicketSnapshot,
} from "../../../packages/shared-types/src/index.js";
import { EventService } from "./modules/events/event.service.js";
import {
  eventInput,
  eventPatch,
  eventQuery,
  ticketInput,
  venueInput,
} from "./modules/events/event.validation.js";
export function createEventApp(
  db: PrismaClient,
  secret: string,
  internalSecret: string,
  sync: (ticket: TicketSnapshot, id: string) => Promise<void>,
  publish: Publisher,
) {
  const app = baseApp("event-service");
  const service = new EventService(db, sync, publish);
  app.get("/categories", async (_req, res) =>
    ok(res, await db.eventCategory.findMany({ orderBy: { name: "asc" } })),
  );
  app.get("/venues", async (_req, res) =>
    ok(res, await db.venue.findMany({ take: 100, orderBy: { name: "asc" } })),
  );
  app.get("/events", async (req, res) => {
    const q = eventQuery.parse(req.query);
    const result = await service.list(q);
    paged(res, result.data, result.total, q.page, q.limit);
  });
  app.get("/events/:eventId", async (req, res) =>
    ok(res, await service.detail(uuid.parse(req.params.eventId))),
  );
  app.use("/organizer", authenticate(secret), role("ORGANIZER"));
  app.post("/organizer/venues", async (req, res) =>
    ok(
      res,
      await db.venue.create({ data: venueInput.parse(req.body) }),
      "Venue created",
      201,
    ),
  );
  app.post("/organizer/events", async (req, res) =>
    ok(
      res,
      await service.create(identity(res).userId, eventInput.parse(req.body)),
      "Event created",
      201,
    ),
  );
  app.get("/organizer/events", async (req, res) => {
    const q = eventQuery.parse(req.query);
    const result = await service.list(q, identity(res).userId);
    paged(res, result.data, result.total, q.page, q.limit);
  });
  app.get("/organizer/events/:eventId", async (req, res) =>
    ok(
      res,
      await service.own(uuid.parse(req.params.eventId), identity(res).userId),
    ),
  );
  app.patch("/organizer/events/:eventId", async (req, res) =>
    ok(
      res,
      await service.patch(
        uuid.parse(req.params.eventId),
        identity(res).userId,
        eventPatch.parse(req.body),
        requestId(res),
      ),
    ),
  );
  app.delete("/organizer/events/:eventId", async (req, res) => {
    await service.remove(uuid.parse(req.params.eventId), identity(res).userId);
    ok(res, null, "Event deleted");
  });
  app.post("/organizer/events/:eventId/ticket-types", async (req, res) =>
    ok(
      res,
      await service.ticket(
        uuid.parse(req.params.eventId),
        identity(res).userId,
        ticketInput.parse(req.body),
      ),
      "Ticket type created",
      201,
    ),
  );
  app.patch(
    "/organizer/events/:eventId/ticket-types/:ticketTypeId",
    async (req, res) => {
      const id = uuid.parse(req.params.eventId);
      const event = await service.own(id, identity(res).userId);
      const ticketId = uuid.parse(req.params.ticketTypeId);
      const existing = event.ticketTypes.find((t) => t.id === ticketId);
      assert(existing, 404, "TICKET_NOT_FOUND", "Ticket type not found");
      const patch = ticketInput.partial().strict().parse(req.body);
      const merged = existing
        ? {
            name: existing.name,
            description: existing.description,
            price: existing.price,
            capacity: existing.capacity,
            salesStartAt: existing.salesStartAt,
            salesEndAt: existing.salesEndAt,
            isActive: existing.isActive,
            ...patch,
          }
        : patch;
      ok(
        res,
        await service.ticket(
          id,
          identity(res).userId,
          z
            .object({
              name: z.string(),
              description: z.string(),
              price: z.number(),
              capacity: z.number(),
              salesStartAt: z.date(),
              salesEndAt: z.date(),
              isActive: z.boolean(),
            })
            .parse(merged),
          ticketId,
        ),
      );
    },
  );
  app.delete(
    "/organizer/events/:eventId/ticket-types/:ticketTypeId",
    async (req, res) => {
      await service.deleteTicket(
        uuid.parse(req.params.eventId),
        identity(res).userId,
        uuid.parse(req.params.ticketTypeId),
      );
      ok(res, null, "Ticket type deleted");
    },
  );
  app.use("/internal", internal(internalSecret));
  app.get("/internal/ticket-types/:id", async (req, res) =>
    ok(res, await service.trustedTicket(uuid.parse(req.params.id))),
  );
  app.get("/internal/events/:id", async (req, res) => {
    const event = await db.event.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
      select: {
        id: true,
        title: true,
        startDateTime: true,
        organizerId: true,
        status: true,
        venue: { select: { name: true, city: true, address: true, timezone: true } },
      },
    });
    ok(res, event);
  });
  return finish(app, "event-service");
}
