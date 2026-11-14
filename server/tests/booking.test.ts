import { afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../apps/booking-service/generated/client/index.js";
import { BookingService } from "../apps/booking-service/src/modules/bookings/booking.service.js";
import { createBookingApp } from "../apps/booking-service/src/app.js";
import type { TicketSnapshot } from "../packages/shared-types/src/index.js";
const secret = "test-secret-at-least-thirty-two-characters";
describe.skipIf(!process.env.BOOKING_DATABASE_URL)(
  "booking PostgreSQL concurrency",
  () => {
    const db = new PrismaClient();
    const userId = crypto.randomUUID();
    const ticket: TicketSnapshot = {
      id: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      organizerId: crypto.randomUUID(),
      name: "VIP",
      price: 12500,
      capacity: 1,
      isActive: true,
      eventStatus: "PUBLISHED",
      salesStartAt: new Date(Date.now() - 60000).toISOString(),
      salesEndAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const getTicket = vi.fn(async () => ticket);
    const publish = vi.fn(async () => {});
    const service = new BookingService(db, getTicket, publish);
    const app = createBookingApp(service, secret, secret);
    const token = (id = userId, role = "CUSTOMER") =>
      `Bearer ${jwt.sign({ userId: id, role }, secret, { issuer: "eventconn", audience: "eventconn" })}`;
    const hold = () =>
      request(app).post("/bookings/holds").set("Authorization", token()).send({
        eventId: ticket.eventId,
        ticketTypeId: ticket.id,
        quantity: 1,
      });
    const clear = async () => {
      const bookings = await db.booking.findMany({
        where: { eventId: ticket.eventId },
        select: { id: true },
      });
      const ids = bookings.map((b) => b.id);
      await db.idempotencyRecord.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await db.issuedTicket.deleteMany({ where: { eventId: ticket.eventId } });
      await db.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
      await db.booking.deleteMany({ where: { eventId: ticket.eventId } });
      await db.ticketHold.deleteMany({ where: { eventId: ticket.eventId } });
      await db.ticketInventory.deleteMany({
        where: { eventId: ticket.eventId },
      });
    };
    beforeEach(async () => {
      await clear();
      getTicket.mockResolvedValue(ticket);
      await service.sync(ticket);
    });
    afterAll(async () => {
      await clear();
      await db.$disconnect();
    });
    it("allows exactly one of two simultaneous last-ticket HTTP requests", async () => {
      const results = await Promise.all([hold(), hold()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe(
        "INSUFFICIENT_INVENTORY",
      );
      expect(
        (
          await db.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticket.id },
          })
        ).availableQuantity,
      ).toBe(0);
      expect(
        await db.ticketHold.count({ where: { eventId: ticket.eventId } }),
      ).toBe(1);
    });
    it("checks quantity, hold ownership, invalid tickets and upstream failure", async () => {
      expect(
        (
          await request(app)
            .post("/bookings/holds")
            .set("Authorization", token())
            .send({
              eventId: ticket.eventId,
              ticketTypeId: ticket.id,
              quantity: 0,
            })
        ).status,
      ).toBe(400);
      const h = (await hold()).body.data;
      expect(
        (
          await request(app)
            .get(`/bookings/holds/${h.id}`)
            .set("Authorization", token(crypto.randomUUID()))
        ).status,
      ).toBe(403);
      await expect(
        service.hold(
          userId,
          {
            eventId: crypto.randomUUID(),
            ticketTypeId: ticket.id,
            quantity: 1,
          },
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({ code: "INVALID_TICKET" });
      getTicket.mockRejectedValueOnce(new Error("offline"));
      await expect(
        service.hold(
          userId,
          { eventId: ticket.eventId, ticketTypeId: ticket.id, quantity: 1 },
          crypto.randomUUID(),
        ),
      ).rejects.toThrow("offline");
    });
    it("expires a hold exactly once even with concurrent workers", async () => {
      const h = (await hold()).body.data;
      await db.ticketHold.update({
        where: { id: h.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await Promise.all([service.expire(), service.expire()]);
      expect(
        (
          await db.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticket.id },
          })
        ).availableQuantity,
      ).toBe(1);
      await expect(
        service.create(userId, h.id, "expired-key", crypto.randomUUID()),
      ).rejects.toMatchObject({ code: "HOLD_UNAVAILABLE" });
    });
    it("uses trusted prices, replays concurrent bookings, and rejects conflicting keys", async () => {
      const h = (await hold()).body.data;
      const create = () =>
        request(app)
          .post("/bookings")
          .set("Authorization", token())
          .set("Idempotency-Key", "booking-key")
          .send({ holdId: h.id });
      expect(
        (
          await request(app)
            .post("/bookings")
            .set("Authorization", token())
            .set("Idempotency-Key", "booking-key")
            .send({ holdId: h.id, total: 1 })
        ).status,
      ).toBe(400);
      const responses = await Promise.all([create(), create()]);
      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      expect(responses[0]?.body.data.id).toBe(responses[1]?.body.data.id);
      expect(responses[0]?.body.data.total).toBe(12500);
      await expect(
        service.create(
          userId,
          crypto.randomUUID(),
          "booking-key",
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    });
    it("enforces customer and organizer ownership and cancels only once", async () => {
      const h = (await hold()).body.data;
      const b = await service.create(
        userId,
        h.id,
        "cancel-key",
        crypto.randomUUID(),
      );
      await expect(
        service.get(b.id, crypto.randomUUID()),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        service.get(b.id, crypto.randomUUID(), true),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await service.get(b.id, ticket.organizerId, true)).id).toBe(b.id);
      await Promise.all([
        service.cancel(b.id, userId, crypto.randomUUID()),
        service.cancel(b.id, userId, crypto.randomUUID()),
      ]);
      expect(
        (
          await db.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticket.id },
          })
        ).availableQuantity,
      ).toBe(1);
    });
    it("restores inventory for abandoned pending bookings", async () => {
      const h = (await hold()).body.data;
      const b = await service.create(
        userId,
        h.id,
        "timeout-key",
        crypto.randomUUID(),
      );
      await db.booking.update({
        where: { id: b.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await service.expire();
      await service.expire();
      expect((await service.get(b.id, userId)).status).toBe("CANCELLED");
      expect(
        (
          await db.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticket.id },
          })
        ).availableQuantity,
      ).toBe(1);
    });
  },
);
