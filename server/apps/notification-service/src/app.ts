import type { PrismaClient } from "../generated/client/index.js";
import {
  baseApp,
  finish,
  internal,
  uuid,
  ok,
} from "../../../packages/config/src/http.js";
export function createNotificationApp(db: PrismaClient, secret: string) {
  const app = baseApp("notification-service");
  app.use("/internal", internal(secret));
  app.get("/internal/notifications/:userId", async (req, res) =>
    ok(
      res,
      await db.notification.findMany({
        where: { userId: uuid.parse(req.params.userId) },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
  );
  return finish(app, "notification-service");
}
