import { randomUUID } from "node:crypto";
import { z } from "zod";
export const roleSchema = z.enum(["CUSTOMER", "ORGANIZER"]);
export type Role = z.infer<typeof roleSchema>;
export type Identity = { userId: string; role: Role };
export const envelopeSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.enum([
      "event.published",
      "booking.confirmed",
      "booking.cancelled",
      "payment.succeeded",
      "payment.failed",
    ]),
    occurredAt: z.iso.datetime(),
    correlationId: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
export type DomainEvent = z.infer<typeof envelopeSchema>;
export type Publisher = (event: DomainEvent) => Promise<void>;
export const eventMessage = (
  eventType: DomainEvent["eventType"],
  payload: DomainEvent["payload"],
  correlationId: string,
): DomainEvent => ({
  eventId: randomUUID(),
  eventType,
  occurredAt: new Date().toISOString(),
  correlationId,
  payload,
});
export const ticketSnapshotSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  organizerId: z.uuid(),
  name: z.string(),
  price: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  isActive: z.boolean(),
  eventStatus: z.string(),
  salesStartAt: z.string(),
  salesEndAt: z.string(),
});
export type TicketSnapshot = z.infer<typeof ticketSnapshotSchema>;
