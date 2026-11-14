import { z } from "zod";
import { baseEnv } from "../../../../packages/config/src/env.js";
export const env = baseEnv
  .extend({ PORT: z.coerce.number().int().positive().default(4000) })
  .parse(process.env);
