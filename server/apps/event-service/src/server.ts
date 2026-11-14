import { z } from "zod";
import { PrismaClient } from "../generated/client/index.js";
import { createEventApp } from "./app.js";
import { env } from "./config/env.js";
import { connectBroker } from "../../../packages/config/src/messaging.js";
import { serviceCall } from "../../../packages/config/src/http.js";
import { shutdown } from "../../../packages/config/src/lifecycle.js";
const db = new PrismaClient();
await db.$connect();
const broker = await connectBroker(env.RABBITMQ_URL, "event-service");
const app = createEventApp(
  db,
  env.JWT_SECRET,
  env.INTERNAL_SECRET,
  async (ticket, id) => {
    await serviceCall(
      `${env.BOOKING_SERVICE_URL}/internal/inventory`,
      env.INTERNAL_SECRET,
      id,
      z.unknown(),
      { method: "PUT", body: JSON.stringify(ticket) },
    );
  },
  broker.publish,
);
const server = app.listen(env.PORT);
shutdown(server, async () => {
  await broker.close();
  await db.$disconnect();
});
