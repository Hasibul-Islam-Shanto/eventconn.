import { z } from "zod";
export const holdInput = z
  .object({
    eventId: z.uuid(),
    ticketTypeId: z.uuid(),
    quantity: z.number().int().min(1).max(20),
  })
  .strict();
export const bookingInput = z.object({ holdId: z.uuid() }).strict();
export const idempotencyKey = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/);
export const paymentPayload = z
  .object({
    paymentId: z.uuid(),
    bookingId: z.uuid(),
    userId: z.uuid(),
    amount: z.number().int().nonnegative(),
    currency: z.literal("BDT"),
  })
  .strict();
export const checkInInput = z
  .object({
    ticketCode: z.string().min(5).max(64),
    qrSignature: z.string().min(16).max(128),
    eventId: z.uuid(),
  })
  .strict();
export function calculatePrice(unitPrice: number, quantity: number) {
  const subtotal = unitPrice * quantity;
  const fees = 0;
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 2147483647)
    throw new Error("Invalid money amount");
  return { subtotal, fees, total: subtotal + fees };
}
