import { z } from "zod";
// Organizer enrollment is an explicit MVP account choice; never accept identity from request headers.
export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().toLowerCase(),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine((v) => Buffer.byteLength(v) <= 72),
    accountType: z.enum(["CUSTOMER", "ORGANIZER"]).default("CUSTOMER"),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1).max(72),
  })
  .strict();
