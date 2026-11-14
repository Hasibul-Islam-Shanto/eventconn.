import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "../../../generated/client/index.js";
import { z } from "zod";
import { assert, AppError } from "../../../../../packages/config/src/http.js";
import {
  envelopeSchema,
  eventMessage,
  type DomainEvent,
  type Publisher,
  type TicketSnapshot,
} from "../../../../../packages/shared-types/src/index.js";
import {
  holdInput,
  calculatePrice,
  paymentPayload,
} from "./booking.validation.js";
export class BookingService {
  constructor(
    private db: PrismaClient,
    private getTicket: (
      id: string,
      requestId: string,
    ) => Promise<TicketSnapshot>,
    private publish: Publisher,
    private holdMinutes = 10,
    private internalSecret = "default-internal-secret",
  ) {}
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await this.db.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2034" &&
          i < 4
        )
          continue;
        throw e;
      }
    }
  }
  async sync(ticket: TicketSnapshot) {
    return this.transaction(async (tx) => {
      const existing = await tx.ticketInventory.findUnique({
        where: { ticketTypeId: ticket.id },
      });
      if (existing) {
        assert(
          existing.eventId === ticket.eventId &&
            existing.organizerId === ticket.organizerId,
          409,
          "INVENTORY_CONFLICT",
          "Inventory identity cannot change",
        );
        const delta = ticket.capacity - existing.totalQuantity;
        assert(
          existing.availableQuantity + delta >= 0,
          409,
          "CAPACITY_CONFLICT",
          "Capacity cannot be below reserved tickets",
        );
        return tx.ticketInventory.update({
          where: { id: existing.id },
          data: {
            totalQuantity: ticket.capacity,
            availableQuantity: { increment: delta },
          },
        });
      }
      return tx.ticketInventory.create({
        data: {
          eventId: ticket.eventId,
          ticketTypeId: ticket.id,
          organizerId: ticket.organizerId,
          totalQuantity: ticket.capacity,
          availableQuantity: ticket.capacity,
        },
      });
    });
  }
  async hold(
    userId: string,
    input: z.infer<typeof holdInput>,
    requestId: string,
  ) {
    const ticket = await this.getTicket(input.ticketTypeId, requestId);
    const now = new Date();
    assert(
      ticket.eventId === input.eventId,
      400,
      "INVALID_TICKET",
      "Ticket does not belong to this event",
    );
    assert(
      ticket.eventStatus === "PUBLISHED" &&
        ticket.isActive &&
        new Date(ticket.salesStartAt) <= now &&
        new Date(ticket.salesEndAt) > now,
      409,
      "SALES_CLOSED",
      "Tickets are not currently on sale",
    );
    return this.transaction(async (tx) => {
      const reserved = await tx.ticketInventory.updateMany({
        where: {
          ticketTypeId: ticket.id,
          eventId: ticket.eventId,
          availableQuantity: { gte: input.quantity },
        },
        data: { availableQuantity: { decrement: input.quantity } },
      });
      assert(
        reserved.count === 1,
        409,
        "INSUFFICIENT_INVENTORY",
        "Not enough tickets available",
      );
      return tx.ticketHold.create({
        data: {
          ...input,
          userId,
          organizerId: ticket.organizerId,
          ticketName: ticket.name,
          unitPrice: ticket.price,
          expiresAt: new Date(Date.now() + this.holdMinutes * 60000),
        },
      });
    });
  }
  async getHold(id: string, userId: string) {
    const hold = await this.db.ticketHold.findUnique({ where: { id } });
    assert(hold, 404, "HOLD_NOT_FOUND", "Hold not found");
    assert(
      hold.userId === userId,
      403,
      "FORBIDDEN",
      "Hold belongs to another customer",
    );
    return hold;
  }
  async create(userId: string, holdId: string, key: string, requestId: string) {
    const previous = await this.db.idempotencyRecord.findUnique({
      where: { userId_key: { userId, key } },
      include: { booking: { include: { items: true } } },
    });
    if (previous) {
      assert(
        previous.fingerprint === holdId,
        409,
        "IDEMPOTENCY_CONFLICT",
        "Key was used for a different request",
      );
      return previous.booking;
    }
    const hold = await this.getHold(holdId, userId);
    const ticket = await this.getTicket(hold.ticketTypeId, requestId);
    assert(
      ticket.eventStatus === "PUBLISHED" && ticket.isActive,
      409,
      "SALES_CLOSED",
      "Event is no longer bookable",
    );
    try {
      return await this.transaction(async (tx) => {
        const claimed = await tx.ticketHold.updateMany({
          where: {
            id: holdId,
            userId,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          data: { status: "CONVERTED" },
        });
        assert(
          claimed.count === 1,
          409,
          "HOLD_UNAVAILABLE",
          "Hold is expired or already used",
        );
        const booking = await tx.booking.create({
          data: {
            userId,
            eventId: hold.eventId,
            organizerId: hold.organizerId,
            holdId,
            ...calculatePrice(hold.unitPrice, hold.quantity),
            expiresAt: new Date(Date.now() + 10 * 60000),
            items: {
              create: {
                ticketTypeId: hold.ticketTypeId,
                ticketName: hold.ticketName,
                quantity: hold.quantity,
                unitPrice: hold.unitPrice,
              },
            },
          },
          include: { items: true },
        });
        await tx.idempotencyRecord.create({
          data: { userId, key, fingerprint: holdId, bookingId: booking.id },
        });
        return booking;
      });
    } catch (e) {
      const existing = await this.db.idempotencyRecord.findUnique({
        where: { userId_key: { userId, key } },
        include: { booking: { include: { items: true } } },
      });
      if (existing) {
        assert(
          existing.fingerprint === holdId,
          409,
          "IDEMPOTENCY_CONFLICT",
          "Key was used for a different request",
        );
        return existing.booking;
      }
      throw e;
    }
  }
  async get(id: string, userId: string, organizer = false) {
    const booking = await this.db.booking.findUnique({
      where: { id },
      include: { items: true, tickets: { orderBy: { ticketNumber: "asc" } } },
    });
    assert(booking, 404, "BOOKING_NOT_FOUND", "Booking not found");
    assert(
      (organizer ? booking.organizerId : booking.userId) === userId,
      403,
      "FORBIDDEN",
      "Booking belongs to another account",
    );
    return booking;
  }
  async list(userId: string, page: number, limit: number, organizer = false) {
    const where = organizer ? { organizerId: userId } : { userId };
    const [data, total] = await this.db.$transaction([
      this.db.booking.findMany({
        where,
        include: { items: true, tickets: { orderBy: { ticketNumber: "asc" } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.booking.count({ where }),
    ]);
    return { data, total };
  }
  private async release(tx: Prisma.TransactionClient, bookingId: string) {
    const items = await tx.bookingItem.findMany({ where: { bookingId } });
    for (const item of items)
      await tx.ticketInventory.update({
        where: { ticketTypeId: item.ticketTypeId },
        data: { availableQuantity: { increment: item.quantity } },
      });
  }
  async cancel(id: string, userId: string, requestId: string) {
    await this.get(id, userId);
    const booking = await this.transaction(async (tx) => {
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (current.status === "CANCELLED") return current;
      assert(
        current.status === "PENDING",
        409,
        "BOOKING_LOCKED",
        "Only unpaid pending bookings can be cancelled",
      );
      await tx.booking.update({
        where: { id },
        data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
      });
      await tx.issuedTicket.updateMany({
        where: { bookingId: id },
        data: { status: "CANCELLED" },
      });
      await this.release(tx, id);
      return tx.booking.findUniqueOrThrow({
        where: { id },
        include: { items: true, tickets: true },
      });
    });
    await this.publish({
      ...eventMessage(
        "booking.cancelled",
        { bookingId: id, userId },
        requestId,
      ),
      eventId: id,
    });
    return booking;
  }
  async expire(now = new Date()) {
    const holds = await this.db.ticketHold.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      select: { id: true },
      take: 100,
    });
    for (const h of holds)
      await this.transaction(async (tx) => {
        const updated = await tx.ticketHold.updateMany({
          where: { id: h.id, status: "ACTIVE", expiresAt: { lte: now } },
          data: { status: "EXPIRED" },
        });
        if (!updated.count) return;
        const hold = await tx.ticketHold.findUniqueOrThrow({
          where: { id: h.id },
        });
        await tx.ticketInventory.update({
          where: { ticketTypeId: hold.ticketTypeId },
          data: { availableQuantity: { increment: hold.quantity } },
        });
      });
    const bookings = await this.db.booking.findMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      select: { id: true, userId: true },
      take: 100,
    });
    for (const b of bookings) {
      try {
        await this.cancel(b.id, b.userId, crypto.randomUUID());
      } catch (e) {
        if (!(e instanceof AppError && e.code === "BOOKING_LOCKED")) throw e;
      }
    }
    return { holds: holds.length, bookings: bookings.length };
  }
  async payment(message: DomainEvent) {
    if (!["payment.succeeded", "payment.failed"].includes(message.eventType))
      return;
    const payload = paymentPayload.parse(message.payload);
    const result = await this.transaction(async (tx) => {
      const processed = await tx.processedEvent.findUnique({
        where: { eventId: message.eventId },
      });
      if (processed)
        return processed.result ? envelopeSchema.parse(processed.result) : null;
      const booking = await tx.booking.findUnique({
        where: { id: payload.bookingId },
        include: { items: true },
      });
      assert(booking, 404, "BOOKING_NOT_FOUND", "Booking not found");
      assert(
        booking.userId === payload.userId &&
          booking.total === payload.amount &&
          booking.currency === payload.currency,
        409,
        "PAYMENT_MISMATCH",
        "Payment does not match booking",
      );
      let output: DomainEvent | null = null;
      if (booking.status === "PENDING") {
        const success =
          message.eventType === "payment.succeeded" &&
          booking.expiresAt > new Date();
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: success ? "CONFIRMED" : "CANCELLED",
            paymentStatus: success ? "SUCCEEDED" : "FAILED",
          },
        });
        if (success) {
          for (const item of booking.items) {
            for (let n = 1; n <= item.quantity; n++) {
              const codeSuffix = crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase();
              const ticketCode = `EC-${booking.id.slice(0, 4).toUpperCase()}-${codeSuffix}-${n}`;
              const qrSignature = crypto
                .createHmac("sha256", this.internalSecret)
                .update(`${ticketCode}:${booking.eventId}:${booking.id}:${n}`)
                .digest("hex");
              await tx.issuedTicket.create({
                data: {
                  bookingId: booking.id,
                  eventId: booking.eventId,
                  organizerId: booking.organizerId,
                  ticketTypeId: item.ticketTypeId,
                  ticketName: item.ticketName,
                  ticketNumber: n,
                  ticketCode,
                  qrSignature,
                  status: "VALID",
                },
              });
            }
          }
        } else {
          await tx.issuedTicket.updateMany({
            where: { bookingId: booking.id },
            data: { status: "CANCELLED" },
          });
          await this.release(tx, booking.id);
        }
        output = eventMessage(
          success ? "booking.confirmed" : "booking.cancelled",
          {
            bookingId: booking.id,
            userId: booking.userId,
            paymentId: payload.paymentId,
            eventId: booking.eventId,
            organizerId: booking.organizerId,
            total: booking.total,
            currency: booking.currency,
          },
          message.correlationId,
        );
      }
      await tx.processedEvent.create({
        data: {
          eventId: message.eventId,
          ...(output ? { result: output as Prisma.InputJsonValue } : {}),
        },
      });
      return output;
    });
    if (result) await this.publish(result);
  }

  async checkIn(
    organizerId: string,
    ticketCode: string,
    qrSignature: string,
    eventId: string,
  ) {
    return this.transaction(async (tx) => {
      const ticket = await tx.issuedTicket.findUnique({
        where: { ticketCode },
        include: { booking: true },
      });
      assert(ticket, 404, "TICKET_NOT_FOUND", "Ticket code was not found");
      assert(
        ticket.organizerId === organizerId,
        403,
        "FORBIDDEN",
        "You do not have permission to check in tickets for this event",
      );
      assert(
        ticket.eventId === eventId,
        400,
        "EVENT_MISMATCH",
        "This ticket is not for this event",
      );
      const expectedSig = crypto
        .createHmac("sha256", this.internalSecret)
        .update(
          `${ticket.ticketCode}:${ticket.eventId}:${ticket.bookingId}:${ticket.ticketNumber}`,
        )
        .digest("hex");
      assert(
        expectedSig.length === qrSignature.length &&
          crypto.timingSafeEqual(
            Buffer.from(expectedSig),
            Buffer.from(qrSignature),
          ),
        400,
        "INVALID_SIGNATURE",
        "Tampered or invalid ticket QR signature",
      );
      assert(
        ticket.status !== "CANCELLED",
        400,
        "TICKET_CANCELLED",
        "This ticket belongs to a cancelled booking",
      );
      assert(
        ticket.status !== "CHECKED_IN" && !ticket.checkedInAt,
        409,
        "ALREADY_CHECKED_IN",
        `Ticket was already checked in at ${ticket.checkedInAt?.toISOString()}`,
      );
      const updated = await tx.issuedTicket.update({
        where: { id: ticket.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: new Date(),
          checkedInBy: organizerId,
        },
      });
      return {
        ticketCode: updated.ticketCode,
        ticketName: updated.ticketName,
        ticketNumber: updated.ticketNumber,
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        bookingId: updated.bookingId,
      };
    });
  }

  async getCheckInStats(organizerId: string, eventId: string) {
    const [total, checkedIn, recent] = await Promise.all([
      this.db.issuedTicket.count({
        where: { eventId, organizerId, status: { not: "CANCELLED" } },
      }),
      this.db.issuedTicket.count({
        where: { eventId, organizerId, status: "CHECKED_IN" },
      }),
      this.db.issuedTicket.findMany({
        where: { eventId, organizerId, status: "CHECKED_IN" },
        orderBy: { checkedInAt: "desc" },
        take: 10,
      }),
    ]);
    return {
      total,
      checkedIn,
      remaining: Math.max(0, total - checkedIn),
      recent,
    };
  }
}
