import { z } from "zod";
import { baseEnv } from "../../../../packages/config/src/env.js";
export const env = baseEnv
  .extend({
    PORT: z.coerce.number().int().positive().default(4001),
    AUTH_DATABASE_URL: z.string().min(1),
  })
  .parse(process.env);
