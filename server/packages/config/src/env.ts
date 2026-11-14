import "dotenv/config";
import { z } from "zod";
export const baseEnv = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JWT_SECRET: z.string().min(32),
  INTERNAL_SECRET: z.string().min(32),
  AUTH_SERVICE_URL: z.url().default("http://localhost:4001"),
  EVENT_SERVICE_URL: z.url().default("http://localhost:4002"),
  BOOKING_SERVICE_URL: z.url().default("http://localhost:4003"),
  PAYMENT_SERVICE_URL: z.url().default("http://localhost:4005"),
  CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
});
export type ServiceEnv = z.infer<typeof baseEnv>;
