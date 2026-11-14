import { PrismaClient } from "../generated/client/index.js";
import { createNotificationApp } from "./app.js";
import { NotificationService } from "./modules/notifications/notification.service.js";
import { EmailService } from "./modules/email/email.service.js";
import { env } from "./config/env.js";
import { connectBroker } from "../../../packages/config/src/messaging.js";
import { shutdown } from "../../../packages/config/src/lifecycle.js";

const db = new PrismaClient();
await db.$connect();

const broker = await connectBroker(env.RABBITMQ_URL, "notification-service");

const emailService = new EmailService({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS,
  from: env.SMTP_FROM,
});

const service = new NotificationService(
  db,
  emailService,
  env.AUTH_SERVICE_URL,
  env.EVENT_SERVICE_URL,
  env.BOOKING_SERVICE_URL,
  env.CLIENT_ORIGIN,
  env.INTERNAL_SECRET,
);

await broker.consume(
  "eventconn.notifications",
  ["booking.*", "payment.*"],
  (event) => service.consume(event),
);

const server = createNotificationApp(db, env.INTERNAL_SECRET).listen(env.PORT);

shutdown(server, async () => {
  await broker.close();
  await db.$disconnect();
});
