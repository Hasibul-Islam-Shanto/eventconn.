import type { Server } from "node:http";
export function shutdown(server: Server, cleanup: () => Promise<void>) {
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(
        () =>
          void cleanup()
            .then(() => process.exit(0))
            .catch(() => process.exit(1)),
      );
    });
}
