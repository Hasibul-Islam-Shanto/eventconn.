import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "../generated/client/index.js";
import {
  baseApp,
  finish,
  ok,
  authenticate,
  identity,
  internal,
  uuid,
} from "../../../packages/config/src/http.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { registerSchema, loginSchema } from "./modules/auth/auth.validation.js";
export function createAuthApp(
  db: PrismaClient,
  secret: string,
  production = false,
  internalSecret = "default-internal-secret",
) {
  const app = baseApp("auth-service");
  const service = new AuthService(db, secret);
  app.use(
    "/auth",
    rateLimit({
      windowMs: 60000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        code: "RATE_LIMITED",
        message: "Too many requests",
      },
    }),
  );
  const cookie = {
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
  };
  app.post("/auth/register", async (req, res) =>
    ok(
      res,
      await service.register(registerSchema.parse(req.body)),
      "User registered",
      201,
    ),
  );
  app.post("/auth/login", async (req, res) => {
    const result = await service.login(loginSchema.parse(req.body));
    res.cookie("session", result.token, { ...cookie, maxAge: 3600000 });
    ok(res, result.user, "Logged in");
  });
  app.post("/auth/logout", (_req, res) => {
    res.clearCookie("session", cookie);
    ok(res, null, "Logged out");
  });
  app.get("/auth/me", authenticate(secret), async (_req, res) =>
    ok(res, await service.me(identity(res).userId)),
  );
  app.use("/internal", internal(internalSecret));
  app.get("/internal/users/:id", async (req, res) =>
    ok(res, await service.me(uuid.parse(req.params.id))),
  );
  return finish(app, "auth-service");
}
