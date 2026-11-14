import { PrismaClient } from "../generated/client/index.js";
import { createAuthApp } from "./app.js";
import { env } from "./config/env.js";
const db = new PrismaClient();
await db.$connect();
const server = createAuthApp(
  db,
  env.JWT_SECRET,
  env.NODE_ENV === "production",
  env.INTERNAL_SECRET,
).listen(env.PORT);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => void db.$disconnect().then(() => process.exit(0)));
  });
