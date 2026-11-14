import { createGateway } from "./app.js";
import { env } from "./config/env.js";
const server = createGateway(env).listen(env.PORT);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
