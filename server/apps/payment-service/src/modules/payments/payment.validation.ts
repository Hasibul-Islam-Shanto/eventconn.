import { z } from "zod";
export const paymentInput = z
  .object({ bookingId: z.uuid(), outcome: z.enum(["SUCCEEDED", "FAILED"]) })
  .strict();
export const paymentKey = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/);
export const trustedBookingSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
  total: z.number().int().nonnegative(),
  currency: z.literal("BDT"),
  expiresAt: z.string(),
});
export type TrustedBooking = z.infer<typeof trustedBookingSchema>;
