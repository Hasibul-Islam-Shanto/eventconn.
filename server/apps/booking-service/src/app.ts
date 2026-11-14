import { z } from "zod";
import {
  baseApp,
  finish,
  ok,
  authenticate,
  identity,
  role,
  internal,
  paged,
  pagination,
  uuid,
  requestId,
} from "../../../packages/config/src/http.js";
import { ticketSnapshotSchema } from "../../../packages/shared-types/src/index.js";
import { BookingService } from "./modules/bookings/booking.service.js";
import {
  holdInput,
  bookingInput,
  idempotencyKey,
  checkInInput,
} from "./modules/bookings/booking.validation.js";
export function createBookingApp(
  service: BookingService,
  secret: string,
  internalSecret: string,
) {
  const app = baseApp("booking-service");
  app.use("/internal", internal(internalSecret));
  app.put("/internal/inventory", async (req, res) =>
    ok(res, await service.sync(ticketSnapshotSchema.parse(req.body))),
  );
  app.get("/internal/bookings/:id", async (req, res) =>
    ok(
      res,
      await service.get(
        uuid.parse(req.params.id),
        uuid.parse(req.query.userId),
      ),
    ),
  );
  app.use("/bookings", authenticate(secret), role("CUSTOMER"));
  app.post("/bookings/holds", async (req, res) =>
    ok(
      res,
      await service.hold(
        identity(res).userId,
        holdInput.parse(req.body),
        requestId(res),
      ),
      "Hold created",
      201,
    ),
  );
  app.get("/bookings/holds/:id", async (req, res) =>
    ok(
      res,
      await service.getHold(uuid.parse(req.params.id), identity(res).userId),
    ),
  );
  app.post("/bookings", async (req, res) =>
    ok(
      res,
      await service.create(
        identity(res).userId,
        bookingInput.parse(req.body).holdId,
        idempotencyKey.parse(req.get("idempotency-key")),
        requestId(res),
      ),
      "Booking created",
      201,
    ),
  );
  app.get("/bookings", async (req, res) => {
    const q = pagination.parse(req.query);
    const result = await service.list(identity(res).userId, q.page, q.limit);
    paged(res, result.data, result.total, q.page, q.limit);
  });
  app.get("/bookings/:id", async (req, res) =>
    ok(res, await service.get(uuid.parse(req.params.id), identity(res).userId)),
  );
  app.patch("/bookings/:id/cancel", async (req, res) => {
    z.object({})
      .strict()
      .parse(req.body ?? {});
    ok(
      res,
      await service.cancel(
        uuid.parse(req.params.id),
        identity(res).userId,
        requestId(res),
      ),
    );
  });
  app.use("/organizer", authenticate(secret), role("ORGANIZER"));
  app.post("/organizer/check-in", async (req, res) => {
    const input = checkInInput.parse(req.body);
    ok(
      res,
      await service.checkIn(
        identity(res).userId,
        input.ticketCode,
        input.qrSignature,
        input.eventId,
      ),
      "Ticket checked in successfully",
    );
  });
  app.get("/organizer/events/:eventId/check-ins", async (req, res) => {
    ok(
      res,
      await service.getCheckInStats(
        identity(res).userId,
        uuid.parse(req.params.eventId),
      ),
    );
  });
  app.get("/organizer/bookings", async (req, res) => {
    const q = pagination.parse(req.query);
    const result = await service.list(
      identity(res).userId,
      q.page,
      q.limit,
      true,
    );
    paged(res, result.data, result.total, q.page, q.limit);
  });
  app.get("/organizer/bookings/:id", async (req, res) =>
    ok(
      res,
      await service.get(uuid.parse(req.params.id), identity(res).userId, true),
    ),
  );
  return finish(app, "booking-service");
}
