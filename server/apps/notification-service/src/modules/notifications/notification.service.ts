import { z } from "zod";
import type { PrismaClient } from "../../../generated/client/index.js";
import {
  envelopeSchema,
  type DomainEvent,
} from "../../../../../packages/shared-types/src/index.js";
import { serviceCall } from "../../../../../packages/config/src/http.js";
import { EmailService } from "../email/email.service.js";
import { logger } from "../../../../../packages/logger/src/index.js";

const log = logger("notification-service");

const payloadSchema = z.object({
  userId: z.uuid(),
  bookingId: z.uuid(),
  eventId: z.uuid().optional(),
  total: z.number().int().optional(),
  currency: z.string().optional(),
});

const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().email(),
});

const eventDetailSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  startDateTime: z.string(),
  venue: z
    .object({
      name: z.string(),
      city: z.string(),
      address: z.string(),
      timezone: z.string(),
    })
    .optional(),
});

const bookingDetailSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  total: z.number().int(),
  currency: z.string(),
  tickets: z
    .array(
      z.object({
        ticketCode: z.string(),
        ticketName: z.string(),
        ticketNumber: z.number(),
      }),
    )
    .optional(),
  items: z.array(
    z.object({
      ticketName: z.string(),
      quantity: z.number(),
    }),
  ),
});

export class NotificationService {
  constructor(
    private db: PrismaClient,
    private emailService?: EmailService,
    private authUrl = "http://localhost:4001",
    private eventUrl = "http://localhost:4002",
    private bookingUrl = "http://localhost:4003",
    private clientOrigin = "http://localhost:3000",
    private internalSecret = "default-internal-secret",
  ) {}

  async consume(input: DomainEvent) {
    const event = envelopeSchema.parse(input);
    if (event.eventType === "event.published") return;

    const data = payloadSchema.parse(event.payload);

    let notificationMessage = `Notification for ${event.eventType} on booking ${data.bookingId}`;

    if (event.eventType === "booking.confirmed") {
      try {
        const user = await serviceCall(
          `${this.authUrl}/internal/users/${data.userId}`,
          this.internalSecret,
          event.correlationId,
          userSchema,
        );

        const booking = await serviceCall(
          `${this.bookingUrl}/internal/bookings/${data.bookingId}?userId=${data.userId}`,
          this.internalSecret,
          event.correlationId,
          bookingDetailSchema,
        );

        const eventDetail = await serviceCall(
          `${this.eventUrl}/internal/events/${booking.eventId}`,
          this.internalSecret,
          event.correlationId,
          eventDetailSchema,
        );

        const eventDateFormatted = new Date(eventDetail.startDateTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: eventDetail.venue?.timezone || "UTC",
        });

        const totalFormatted = `${(booking.total / 100).toFixed(2)} ${booking.currency}`;

        const ticketsList =
          booking.tickets && booking.tickets.length > 0
            ? booking.tickets
            : booking.items.flatMap((item) =>
                Array.from({ length: item.quantity }, (_, idx) => ({
                  ticketCode: `EC-${data.bookingId.slice(0, 4).toUpperCase()}-${idx + 1}`,
                  ticketName: item.ticketName,
                  ticketNumber: idx + 1,
                })),
              );

        if (this.emailService) {
          const sent = await this.emailService.sendBookingConfirmation({
            to: user.email,
            customerName: user.name,
            eventTitle: eventDetail.title,
            eventDate: eventDateFormatted,
            venueName: eventDetail.venue?.name || "TBA",
            venueAddress: eventDetail.venue ? `${eventDetail.venue.address}, ${eventDetail.venue.city}` : "",
            bookingId: data.bookingId,
            tickets: ticketsList,
            totalFormatted,
            bookingUrl: `${this.clientOrigin}/bookings/${data.bookingId}`,
          });

          notificationMessage = sent
            ? `Confirmation email dispatched to ${user.email} (Booking: ${data.bookingId})`
            : `Email dispatch queued/simulated for ${user.email} (Booking: ${data.bookingId})`;
        }
      } catch (err) {
        log.error(`Failed to enrich or dispatch confirmation email: ${(err as Error).message}`);
        notificationMessage = `Booking confirmed for ${data.bookingId} (Email dispatch failed: ${(err as Error).message})`;
      }
    } else if (event.eventType === "booking.cancelled") {
      notificationMessage = `Booking ${data.bookingId} was cancelled.`;
    } else if (event.eventType === "payment.failed") {
      notificationMessage = `Payment failed for booking ${data.bookingId}.`;
    }

    await this.db.notification.upsert({
      where: { eventId: event.eventId },
      create: {
        eventId: event.eventId,
        eventType: event.eventType,
        userId: data.userId,
        bookingId: data.bookingId,
        message: notificationMessage,
        correlationId: event.correlationId,
      },
      update: {
        message: notificationMessage,
      },
    });
  }
}
