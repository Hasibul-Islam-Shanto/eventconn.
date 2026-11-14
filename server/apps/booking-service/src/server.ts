import { PrismaClient } from "../generated/client/index.js";
import { createBookingApp } from "./app.js";
import { BookingService } from "./modules/bookings/booking.service.js";
import { env } from "./config/env.js";
import { connectBroker } from "../../../packages/config/src/messaging.js";
import { serviceCall } from "../../../packages/config/src/http.js";
import { shutdown } from "../../../packages/config/src/lifecycle.js";
import { ticketSnapshotSchema } from "../../../packages/shared-types/src/index.js";
import { logger } from "../../../packages/logger/src/index.js";
const db = new PrismaClient();
await db.$connect();
const broker = await connectBroker(env.RABBITMQ_URL, "booking-service");
const service = new BookingService(
  db,
  (id, requestId) =>
    serviceCall(
      `${env.EVENT_SERVICE_URL}/internal/ticket-types/${id}`,
      env.INTERNAL_SECRET,
      requestId,
      ticketSnapshotSchema,
    ),
  broker.publish,
  env.HOLD_MINUTES,
  env.INTERNAL_SECRET,
);
await broker.consume("eventconn.booking-payments", ["payment.*"], (event) =>
  service.payment(event),
);
let busy = false;
const timer = setInterval(() => {
  if (busy) return;
  busy = true;
  void service
    .expire()
    .catch(() => logger("booking-service").error("Expiration worker failed"))
    .finally(() => {
      busy = false;
    });
}, 30000);
timer.unref();
const server = createBookingApp(
  service,
  env.JWT_SECRET,
  env.INTERNAL_SECRET,
).listen(env.PORT);
shutdown(server, async () => {
  clearInterval(timer);
  await broker.close();
  await db.$disconnect();
});
