import { z } from "zod";
import { baseEnv } from "../../../../packages/config/src/env.js";
export const env = baseEnv
  .extend({
    PORT: z.coerce.number().int().positive().max(65535).default(4003),
    BOOKING_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.url(),
    HOLD_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  })
  .parse(process.env);
