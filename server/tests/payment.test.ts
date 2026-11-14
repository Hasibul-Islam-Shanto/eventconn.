import { afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../apps/payment-service/generated/client/index.js";
import { PaymentService } from "../apps/payment-service/src/modules/payments/payment.service.js";
import { createPaymentApp } from "../apps/payment-service/src/app.js";
import type { TrustedBooking } from "../apps/payment-service/src/modules/payments/payment.validation.js";
const secret = "test-secret-at-least-thirty-two-characters";
describe.skipIf(!process.env.PAYMENT_DATABASE_URL)("mock payments", () => {
  const db = new PrismaClient();
  const userId = crypto.randomUUID();
  let booking: TrustedBooking;
  const publish = vi.fn(async () => {});
  const getBooking = vi.fn(async () => booking);
  const service = new PaymentService(db, getBooking, publish);
  const app = createPaymentApp(service, secret);
  beforeEach(() => {
    booking = {
      id: crypto.randomUUID(),
      userId,
      status: "PENDING",
      total: 10000,
      currency: "BDT",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };
    publish.mockClear();
  });
  afterAll(async () => {
    await db.payment.deleteMany({ where: { userId } });
    await db.$disconnect();
  });
  it("creates a successful mock payment with a trusted amount and replays it", async () => {
    const key = crypto.randomUUID();
    const input = { bookingId: booking.id, outcome: "SUCCEEDED" as const };
    const [a, b] = await Promise.all([
      service.create(userId, input, key, crypto.randomUUID()),
      service.create(userId, input, key, crypto.randomUUID()),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.amount).toBe(10000);
    expect(a.status).toBe("SUCCEEDED");
    expect(publish.mock.calls).toHaveLength(2);
    await expect(
      service.create(
        userId,
        { ...input, outcome: "FAILED" },
        key,
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      service.create(userId, input, crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "PAYMENT_EXISTS" });
  });
  it("publishes mock failure and rejects wrong ownership", async () => {
    const p = await service.create(
      userId,
      { bookingId: booking.id, outcome: "FAILED" },
      crypto.randomUUID(),
      crypto.randomUUID(),
    );
    expect(p.status).toBe("FAILED");
    await expect(service.get(p.id, crypto.randomUUID())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      service.create(
        crypto.randomUUID(),
        { bookingId: booking.id, outcome: "SUCCEEDED" },
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects client amounts and non-payable bookings", async () => {
    const token = jwt.sign({ userId, role: "CUSTOMER" }, secret, {
      issuer: "eventconn",
      audience: "eventconn",
    });
    expect(
      (
        await request(app)
          .post("/payments")
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", crypto.randomUUID())
          .send({ bookingId: booking.id, outcome: "SUCCEEDED", amount: 1 })
      ).status,
    ).toBe(400);
    booking.status = "CANCELLED";
    await expect(
      service.create(
        userId,
        { bookingId: booking.id, outcome: "SUCCEEDED" },
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "BOOKING_NOT_PAYABLE" });
  });
  it("retries publishing the same event after a broker failure", async () => {
    const input = { bookingId: booking.id, outcome: "SUCCEEDED" as const };
    const key = crypto.randomUUID();
    publish.mockRejectedValueOnce(new Error("broker offline"));
    await expect(
      service.create(userId, input, key, crypto.randomUUID()),
    ).rejects.toThrow("broker offline");
    const p = await service.create(userId, input, key, crypto.randomUUID());
    expect(p.status).toBe("SUCCEEDED");
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(
      1,
    );
  });
});
