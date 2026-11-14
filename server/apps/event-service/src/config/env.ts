import { z } from "zod";
import { baseEnv } from "../../../../packages/config/src/env.js";
export const env = baseEnv
  .extend({
    PORT: z.coerce.number().int().positive().max(65535).default(4002),
    EVENT_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.url(),
  })
  .parse(process.env);
