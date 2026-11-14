import {
  Prisma,
  type PrismaClient,
  type Payment,
} from "../../../generated/client/index.js";
import type { z } from "zod";
import { assert } from "../../../../../packages/config/src/http.js";
import {
  eventMessage,
  type Publisher,
} from "../../../../../packages/shared-types/src/index.js";
import { paymentInput, type TrustedBooking } from "./payment.validation.js";
export class PaymentService {
  constructor(
    private db: PrismaClient,
    private getBooking: (
      id: string,
      userId: string,
      requestId: string,
    ) => Promise<TrustedBooking>,
    private publish: Publisher,
  ) {}
  async create(
    userId: string,
    input: z.infer<typeof paymentInput>,
    key: string,
    requestId: string,
  ) {
    const fingerprint = JSON.stringify(input);
    let payment = await this.db.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    });
    if (payment) {
      assert(
        payment.fingerprint === fingerprint,
        409,
        "IDEMPOTENCY_CONFLICT",
        "Key was used for a different request",
      );
      await this.emit(payment);
      return payment;
    }
    const booking = await this.getBooking(input.bookingId, userId, requestId);
    assert(
      booking.userId === userId,
      403,
      "FORBIDDEN",
      "Booking belongs to another customer",
    );
    assert(
      booking.status === "PENDING" && new Date(booking.expiresAt) > new Date(),
      409,
      "BOOKING_NOT_PAYABLE",
      "Booking cannot be paid",
    );
    try {
      payment = await this.db.payment.create({
        data: {
          bookingId: booking.id,
          userId,
          amount: booking.total,
          currency: booking.currency,
          status: input.outcome,
          idempotencyKey: key,
          fingerprint,
          correlationId: requestId,
        },
      });
    } catch (e) {
      if (
        !(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        )
      )
        throw e;
      payment = await this.db.payment.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      assert(
        payment && payment.fingerprint === fingerprint,
        409,
        "PAYMENT_EXISTS",
        "A payment already exists for this booking",
      );
    }
    await this.emit(payment);
    return payment;
  }
  private async emit(payment: Payment) {
    if (payment.status !== "SUCCEEDED" && payment.status !== "FAILED") return;
    const message = eventMessage(
      payment.status === "SUCCEEDED" ? "payment.succeeded" : "payment.failed",
      {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
      },
      payment.correlationId,
    );
    await this.publish({
      ...message,
      eventId: payment.eventId,
      occurredAt: payment.createdAt.toISOString(),
    });
  }
  async get(id: string, userId: string) {
    const payment = await this.db.payment.findUnique({ where: { id } });
    assert(payment, 404, "PAYMENT_NOT_FOUND", "Payment not found");
    assert(
      payment.userId === userId,
      403,
      "FORBIDDEN",
      "Payment belongs to another customer",
    );
    return payment;
  }
}
