import { afterAll, describe, it, expect } from "vitest";
import { PrismaClient } from "../apps/notification-service/generated/client/index.js";
import { NotificationService } from "../apps/notification-service/src/modules/notifications/notification.service.js";
import { eventMessage } from "../packages/shared-types/src/index.js";
describe.skipIf(!process.env.NOTIFICATION_DATABASE_URL)(
  "notification persistence",
  () => {
    const db = new PrismaClient();
    const service = new NotificationService(db);
    const userId = crypto.randomUUID();
    afterAll(async () => {
      await db.notification.deleteMany({ where: { userId } });
      await db.$disconnect();
    });
    it("records each mock notification only once", async () => {
      const event = eventMessage(
        "booking.confirmed",
        { userId, bookingId: crypto.randomUUID() },
        crypto.randomUUID(),
      );
      await Promise.all([service.consume(event), service.consume(event)]);
      expect(
        await db.notification.count({ where: { eventId: event.eventId } }),
      ).toBe(1);
    });
    it("rejects an invalid message without recording it", async () => {
      const event = eventMessage(
        "payment.failed",
        { userId },
        crypto.randomUUID(),
      );
      await expect(service.consume(event)).rejects.toThrow();
      expect(
        await db.notification.count({ where: { eventId: event.eventId } }),
      ).toBe(0);
    });
  },
);
