import { z } from "zod";
import { baseEnv } from "../../../../packages/config/src/env.js";

export const env = baseEnv
  .extend({
    PORT: z.coerce.number().int().positive().max(65535).default(4004),
    NOTIFICATION_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.url(),
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z.coerce.boolean().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default("EventConn Tickets <no-reply@eventconn.com>"),
  })
  .parse(process.env);
