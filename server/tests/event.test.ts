import { afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../apps/event-service/generated/client/index.js";
import { createEventApp } from "../apps/event-service/src/app.js";
const secret = "test-secret-at-least-thirty-two-characters";
const organizerId = crypto.randomUUID();
const auth = (role = "ORGANIZER", userId = organizerId) =>
  `Bearer ${jwt.sign({ userId, role }, secret, { issuer: "eventconn", audience: "eventconn" })}`;
describe.skipIf(!process.env.EVENT_DATABASE_URL)(
  "event HTTP and ownership",
  () => {
    const db = new PrismaClient();
    const sync = vi.fn(async () => {});
    const app = createEventApp(db, secret, secret, sync, async () => {});
    let eventId: string;
    let categoryId: string;
    let venueId: string;
    const startDateTime = new Date(Date.now() + 86400000 * 3).toISOString();
    const endDateTime = new Date(Date.now() + 86400000 * 4).toISOString();
    afterAll(async () => {
      await db.event.deleteMany({ where: { organizerId } });
      if (categoryId)
        await db.eventCategory.delete({ where: { id: categoryId } });
      if (venueId) await db.venue.delete({ where: { id: venueId } });
      await db.$disconnect();
    });
    it("creates a draft event and rejects invalid dates and customer access", async () => {
      categoryId = (
        await db.eventCategory.create({
          data: { name: crypto.randomUUID(), slug: crypto.randomUUID() },
        })
      ).id;
      venueId = (
        await db.venue.create({
          data: {
            name: "Hall",
            city: "Dhaka",
            address: "Road 1",
            timezone: "Asia/Dhaka",
          },
        })
      ).id;
      const data = {
        title: "Test concert",
        slug: crypto.randomUUID(),
        shortDescription: "Music",
        description: "Test concert description",
        categoryId,
        venueId,
        startDateTime,
        endDateTime,
      };
      expect(
        (
          await request(app)
            .post("/organizer/events")
            .set("Authorization", auth("CUSTOMER"))
            .send(data)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/organizer/events")
            .set("Authorization", auth())
            .send({ ...data, endDateTime: startDateTime })
        ).status,
      ).toBe(400);
      const res = await request(app)
        .post("/organizer/events")
        .set("Authorization", auth())
        .send(data);
      expect(res.status).toBe(201);
      eventId = res.body.data.id;
      expect((await request(app).get(`/events/${eventId}`)).status).toBe(404);
    });
    it("rejects another organizer and permits editing own draft", async () => {
      expect(
        (
          await request(app)
            .patch(`/organizer/events/${eventId}`)
            .set("Authorization", auth("ORGANIZER", crypto.randomUUID()))
            .send({ title: "Stolen" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/organizer/events/${eventId}`)
            .set("Authorization", auth())
            .send({ title: "New concert" })
        ).status,
      ).toBe(200);
    });
    it("validates ticket prices, sales dates and publication, then syncs inventory", async () => {
      expect(
        (
          await request(app)
            .patch(`/organizer/events/${eventId}`)
            .set("Authorization", auth())
            .send({ status: "PUBLISHED" })
        ).status,
      ).toBe(409);
      const ticket = {
        name: "VIP",
        price: 10000,
        capacity: 20,
        salesStartAt: new Date().toISOString(),
        salesEndAt: startDateTime,
      };
      expect(
        (
          await request(app)
            .post(`/organizer/events/${eventId}/ticket-types`)
            .set("Authorization", auth())
            .send({ ...ticket, price: -1 })
        ).status,
      ).toBe(400);
      expect(
        (
          await request(app)
            .post(`/organizer/events/${eventId}/ticket-types`)
            .set("Authorization", auth())
            .send(ticket)
        ).status,
      ).toBe(201);
      expect(
        (
          await request(app)
            .patch(`/organizer/events/${eventId}`)
            .set("Authorization", auth())
            .send({ status: "PUBLISHED" })
        ).status,
      ).toBe(200);
      expect(sync).toHaveBeenCalledOnce();
      expect(
        (
          await request(app)
            .patch(`/organizer/events/${eventId}`)
            .set("Authorization", auth())
            .send({ status: "DRAFT" })
        ).status,
      ).toBe(409);
    });
    it("returns public detail, filters and bounded pagination", async () => {
      expect(
        (await request(app).get(`/events/${eventId}`)).body.data.title,
      ).toBe("New concert");
      const res = await request(app).get(
        "/events?search=New%20concert&city=Dhaka&page=1&limit=1",
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.limit).toBe(1);
      expect((await request(app).get("/events?limit=101")).status).toBe(400);
      expect(
        (await request(app).get("/events?city=Nowhere")).body.data,
      ).toHaveLength(0);
      expect(
        (
          await request(app).get(
            "/internal/ticket-types/" + crypto.randomUUID(),
          )
        ).status,
      ).toBe(401);
    });
  },
);
