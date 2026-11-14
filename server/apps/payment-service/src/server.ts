import { PrismaClient } from "../generated/client/index.js";
import { createPaymentApp } from "./app.js";
import { PaymentService } from "./modules/payments/payment.service.js";
import { trustedBookingSchema } from "./modules/payments/payment.validation.js";
import { env } from "./config/env.js";
import { connectBroker } from "../../../packages/config/src/messaging.js";
import { serviceCall } from "../../../packages/config/src/http.js";
import { shutdown } from "../../../packages/config/src/lifecycle.js";
const db = new PrismaClient();
await db.$connect();
const broker = await connectBroker(env.RABBITMQ_URL, "payment-service");
const service = new PaymentService(
  db,
  (id, userId, requestId) =>
    serviceCall(
      `${env.BOOKING_SERVICE_URL}/internal/bookings/${id}?userId=${userId}`,
      env.INTERNAL_SECRET,
      requestId,
      trustedBookingSchema,
    ),
  broker.publish,
);
const server = createPaymentApp(service, env.JWT_SECRET).listen(env.PORT);
shutdown(server, async () => {
  await broker.close();
  await db.$disconnect();
});
