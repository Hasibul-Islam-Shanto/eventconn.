import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { Server } from "node:http";
import type { Express } from "express";
import { z } from "zod";
import amqp from "amqplib";
import { connectBroker } from "../packages/config/src/messaging.js";
import { PrismaClient as AuthDb } from "../apps/auth-service/generated/client/index.js";
import { PrismaClient as EventDb } from "../apps/event-service/generated/client/index.js";
import { PrismaClient as BookingDb } from "../apps/booking-service/generated/client/index.js";
import { PrismaClient as PaymentDb } from "../apps/payment-service/generated/client/index.js";
import { PrismaClient as NotificationDb } from "../apps/notification-service/generated/client/index.js";
import { createAuthApp } from "../apps/auth-service/src/app.js";
import { createEventApp } from "../apps/event-service/src/app.js";
import { createBookingApp } from "../apps/booking-service/src/app.js";
import { createPaymentApp } from "../apps/payment-service/src/app.js";
import { createGateway } from "../apps/api-gateway/src/app.js";
import { BookingService } from "../apps/booking-service/src/modules/bookings/booking.service.js";
import { PaymentService } from "../apps/payment-service/src/modules/payments/payment.service.js";
import { NotificationService } from "../apps/notification-service/src/modules/notifications/notification.service.js";
import { trustedBookingSchema } from "../apps/payment-service/src/modules/payments/payment.validation.js";
import {
  ticketSnapshotSchema,
  type DomainEvent,
} from "../packages/shared-types/src/index.js";
import { serviceCall } from "../packages/config/src/http.js";
import { baseEnv } from "../packages/config/src/env.js";
const enabled = ["AUTH", "EVENT", "BOOKING", "PAYMENT", "NOTIFICATION"].every(
  (n) => process.env[`${n}_DATABASE_URL`],
);
describe.skipIf(!enabled)(
  "cross-service HTTP with real databases and " +
    (process.env.TEST_RABBITMQ_URL
      ? "RabbitMQ"
      : "deterministic event delivery"),
  () => {
    const authDb = new AuthDb();
    const eventDb = new EventDb();
    const bookingDb = new BookingDb();
    const paymentDb = new PaymentDb();
    const notificationDb = new NotificationDb();
    const servers: Server[] = [];
    const messages: DomainEvent[] = [];
    let broker: Awaited<ReturnType<typeof connectBroker>> | undefined;
    const queuePrefix = `eventconn.integration.${crypto.randomUUID()}`;
    const expected = new Set<string>();
    const delivered = new Set<string>();
    const publish = async (e: DomainEvent) => {
      if (broker) {
        expected.add(`n:${e.eventId}`);
        if (e.eventType.startsWith("payment.")) expected.add(`b:${e.eventId}`);
        await broker.publish(e);
      } else messages.push(e);
    };
    const secret = "test-secret-at-least-thirty-two-characters";
    const users: string[] = [];
    let gateway: Express;
    let bookings: BookingService;
    let notifications: NotificationService;
    let categoryId: string;
    let venueId: string;
    let eventId: string;
    let ticketId: string;
    let organizerCookie: string;
    let customerCookie: string;
    let customerId: string;
    async function listen(app: Express) {
      const server = app.listen(0, "127.0.0.1");
      servers.push(server);
      await new Promise<void>((r) => server.once("listening", r));
      const addr = server.address();
      if (!addr || typeof addr === "string") throw Error("No port");
      return `http://127.0.0.1:${addr.port}`;
    }
    async function drain() {
      if (broker) {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ([...expected].every((id) => delivered.has(id))) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw Error("Timed out waiting for the cross-service RabbitMQ flow");
      }
      while (messages.length) {
        const message = messages.shift();
        if (!message) break;
        await notifications.consume(message);
        if (message.eventType.startsWith("payment.")) {
          await bookings.payment(message);
          await bookings.payment(message);
        }
        await notifications.consume(message);
      }
    }
    beforeAll(async () => {
      const authUrl = await listen(createAuthApp(authDb, secret));
      let eventUrl = "";
      bookings = new BookingService(
        bookingDb,
        (id, rid) =>
          serviceCall(
            `${eventUrl}/internal/ticket-types/${id}`,
            secret,
            rid,
            ticketSnapshotSchema,
          ),
        publish,
      );
      const bookingUrl = await listen(
        createBookingApp(bookings, secret, secret),
      );
      eventUrl = await listen(
        createEventApp(
          eventDb,
          secret,
          secret,
          async (ticket, rid) => {
            await serviceCall(
              `${bookingUrl}/internal/inventory`,
              secret,
              rid,
              z.unknown(),
              { method: "PUT", body: JSON.stringify(ticket) },
            );
          },
          publish,
        ),
      );
      const payments = new PaymentService(
        paymentDb,
        (id, userId, rid) =>
          serviceCall(
            `${bookingUrl}/internal/bookings/${id}?userId=${userId}`,
            secret,
            rid,
            trustedBookingSchema,
          ),
        publish,
      );
      const paymentUrl = await listen(createPaymentApp(payments, secret));
      notifications = new NotificationService(notificationDb);
      if (process.env.TEST_RABBITMQ_URL) {
        broker = await connectBroker(
          process.env.TEST_RABBITMQ_URL,
          "integration-test",
        );
        await broker.consume(
          `${queuePrefix}.notifications`,
          ["#"],
          async (event) => {
            await notifications.consume(event);
            await notifications.consume(event);
            delivered.add(`n:${event.eventId}`);
          },
        );
        await broker.consume(
          `${queuePrefix}.bookings`,
          ["payment.*"],
          async (event) => {
            await bookings.payment(event);
            await bookings.payment(event);
            delivered.add(`b:${event.eventId}`);
          },
        );
      }
      gateway = createGateway(
        baseEnv.parse({
          PORT: 4000,
          JWT_SECRET: secret,
          INTERNAL_SECRET: secret,
          AUTH_SERVICE_URL: authUrl,
          EVENT_SERVICE_URL: eventUrl,
          BOOKING_SERVICE_URL: bookingUrl,
          PAYMENT_SERVICE_URL: paymentUrl,
        }),
      );
    });
    afterAll(async () => {
      if (broker && process.env.TEST_RABBITMQ_URL) {
        await broker.close();
        const connection = await amqp.connect(process.env.TEST_RABBITMQ_URL);
        const channel = await connection.createChannel();
        for (const consumer of ["notifications", "bookings"])
          for (const suffix of ["", ".retry", ".dead"])
            await channel.deleteQueue(`${queuePrefix}.${consumer}${suffix}`);
        await channel.close();
        await connection.close();
      }
      await Promise.all(
        servers.map(
          (server) => new Promise<void>((r) => server.close(() => r())),
        ),
      );
      await notificationDb.notification.deleteMany({
        where: { userId: { in: users } },
      });
      await paymentDb.payment.deleteMany({ where: { userId: { in: users } } });
      const ids = (
        await bookingDb.booking.findMany({
          where: { userId: { in: users } },
          select: { id: true },
        })
      ).map((b) => b.id);
      await bookingDb.processedEvent.deleteMany({
        where: { eventId: { in: processedIds } },
      });
      await bookingDb.idempotencyRecord.deleteMany({
        where: { userId: { in: users } },
      });
      await bookingDb.bookingItem.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await bookingDb.booking.deleteMany({ where: { id: { in: ids } } });
      await bookingDb.ticketHold.deleteMany({
        where: { userId: { in: users } },
      });
      if (eventId) {
        await bookingDb.ticketInventory.deleteMany({ where: { eventId } });
        await eventDb.event.delete({ where: { id: eventId } });
      }
      if (venueId) await eventDb.venue.delete({ where: { id: venueId } });
      if (categoryId)
        await eventDb.eventCategory.delete({ where: { id: categoryId } });
      await authDb.user.deleteMany({ where: { id: { in: users } } });
      await Promise.all(
        [authDb, eventDb, bookingDb, paymentDb, notificationDb].map((db) =>
          db.$disconnect(),
        ),
      );
    });
    const processedIds: string[] = [];
    async function register(accountType: string) {
      const email = `flow-${crypto.randomUUID()}@example.com`;
      const registered = await request(gateway)
        .post("/api/auth/register")
        .send({
          name: "Flow User",
          email,
          password: "safe-password-123",
          accountType,
        });
      expect(registered.status).toBe(201);
      users.push(registered.body.data.id);
      const login = await request(gateway)
        .post("/api/auth/login")
        .send({ email, password: "safe-password-123" });
      expect(login.status).toBe(200);
      return {
        id: registered.body.data.id as string,
        cookie: String(login.headers["set-cookie"]?.[0] ?? ""),
      };
    }
    it("registers users, publishes an event and synchronizes inventory over HTTP", async () => {
      organizerCookie = (await register("ORGANIZER")).cookie;
      const customer = await register("CUSTOMER");
      customerCookie = customer.cookie;
      customerId = customer.id;
      categoryId = (
        await eventDb.eventCategory.create({
          data: { name: crypto.randomUUID(), slug: crypto.randomUUID() },
        })
      ).id;
      const venue = await request(gateway)
        .post("/api/organizer/venues")
        .set("Cookie", organizerCookie)
        .send({
          name: "Concert Hall",
          address: "Road 1",
          city: "Dhaka",
          timezone: "Asia/Dhaka",
        });
      expect(venue.status).toBe(201);
      venueId = venue.body.data.id;
      const event = await request(gateway)
        .post("/api/organizer/events")
        .set("Cookie", organizerCookie)
        .send({
          title: "Integration concert",
          slug: crypto.randomUUID(),
          shortDescription: "Live music",
          description: "Cross service test",
          categoryId,
          venueId,
          startDateTime: new Date(Date.now() + 86400000 * 2).toISOString(),
          endDateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        });
      expect(event.status).toBe(201);
      eventId = event.body.data.id;
      const ticket = await request(gateway)
        .post(`/api/organizer/events/${eventId}/ticket-types`)
        .set("Cookie", organizerCookie)
        .send({
          name: "General",
          price: 15500,
          capacity: 5,
          salesStartAt: new Date(Date.now() - 60000).toISOString(),
          salesEndAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(ticket.status).toBe(201);
      ticketId = ticket.body.data.id;
      expect(
        (
          await request(gateway)
            .patch(`/api/organizer/events/${eventId}`)
            .set("Cookie", organizerCookie)
            .send({ status: "PUBLISHED" })
        ).status,
      ).toBe(200);
      expect(
        (
          await bookingDb.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticketId },
          })
        ).availableQuantity,
      ).toBe(5);
      await drain();
    });
    async function book() {
      const hold = await request(gateway)
        .post("/api/bookings/holds")
        .set("Cookie", customerCookie)
        .send({ eventId, ticketTypeId: ticketId, quantity: 1 });
      expect(hold.status).toBe(201);
      const booking = await request(gateway)
        .post("/api/bookings")
        .set("Cookie", customerCookie)
        .set("Idempotency-Key", crypto.randomUUID())
        .send({ holdId: hold.body.data.id });
      expect(booking.status).toBe(201);
      return String(booking.body.data.id);
    }
    it("confirms a paid booking and persists one notification per event despite redelivery", async () => {
      const bookingId = await book();
      const payment = await request(gateway)
        .post("/api/payments")
        .set("Cookie", customerCookie)
        .set("Idempotency-Key", crypto.randomUUID())
        .send({ bookingId, outcome: "SUCCEEDED" });
      expect(payment.status).toBe(201);
      expect(payment.body.data.amount).toBe(15500);
      processedIds.push(payment.body.data.eventId);
      await drain();
      const result = await request(gateway)
        .get(`/api/bookings/${bookingId}`)
        .set("Cookie", customerCookie);
      expect(result.body.data.status).toBe("CONFIRMED");
      expect(
        await notificationDb.notification.count({
          where: { bookingId, eventType: "booking.confirmed" },
        }),
      ).toBe(1);
      expect(
        (
          await request(gateway)
            .get(`/api/organizer/bookings/${bookingId}`)
            .set("Cookie", organizerCookie)
        ).status,
      ).toBe(200);
    });
    it("cancels on payment failure and restores inventory only once", async () => {
      const bookingId = await book();
      const payment = await request(gateway)
        .post("/api/payments")
        .set("Cookie", customerCookie)
        .set("Idempotency-Key", crypto.randomUUID())
        .send({ bookingId, outcome: "FAILED" });
      expect(payment.status).toBe(201);
      processedIds.push(payment.body.data.eventId);
      await drain();
      expect((await bookings.get(bookingId, customerId)).status).toBe(
        "CANCELLED",
      );
      expect(
        (
          await bookingDb.ticketInventory.findUniqueOrThrow({
            where: { ticketTypeId: ticketId },
          })
        ).availableQuantity,
      ).toBe(4);
    });
    it("rejects mismatched payment amounts without mutating a booking", async () => {
      const bookingId = await book();
      const message: DomainEvent = {
        eventId: crypto.randomUUID(),
        eventType: "payment.succeeded",
        occurredAt: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        payload: {
          paymentId: crypto.randomUUID(),
          bookingId,
          userId: customerId,
          amount: 1,
          currency: "BDT",
        },
      };
      await expect(bookings.payment(message)).rejects.toMatchObject({
        code: "PAYMENT_MISMATCH",
      });
      expect((await bookings.get(bookingId, customerId)).status).toBe(
        "PENDING",
      );
    });
  },
);
