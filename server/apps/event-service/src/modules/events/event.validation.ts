import { z } from "zod";
import { pagination } from "../../../../../packages/config/src/http.js";
const date = z.iso.datetime().transform((v) => new Date(v));
export const eventInput = z
  .object({
    title: z.string().trim().min(3).max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(200),
    shortDescription: z.string().min(1).max(500),
    description: z.string().min(1).max(20000),
    coverImageUrl: z.url().optional(),
    categoryId: z.uuid(),
    venueId: z.uuid(),
    startDateTime: date,
    endDateTime: date,
  })
  .strict();
export const eventPatch = eventInput
  .partial()
  .extend({
    status: z.enum(["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const ticketInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).default(""),
    price: z.number().int().min(0).max(100000000),
    capacity: z.number().int().min(1).max(1000000),
    salesStartAt: date,
    salesEndAt: date,
    isActive: z.boolean().default(true),
  })
  .strict();
export const eventQuery = pagination.extend({
  search: z.string().max(200).optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  date: z.iso.date().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"]).optional(),
});
export const venueInput = z
  .object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  })
  .strict();
