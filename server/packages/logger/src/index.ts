import pino from "pino";
export const logger = (service: string) =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "password",
      "passwordHash",
      "secret",
      "token",
      "jwt",
      "cookie",
      "authorization",
      "req.headers",
      "headers",
    ],
  });
