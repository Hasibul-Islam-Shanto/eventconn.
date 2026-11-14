import cors from "cors";
import { rateLimit } from "express-rate-limit";
import {
  baseApp,
  finish,
  AppError,
  verifyToken,
  tokenFrom,
  requestId,
  ok,
} from "../../../packages/config/src/http.js";
import type { ServiceEnv } from "../../../packages/config/src/env.js";
export function createGateway(env: ServiceEnv) {
  const app = baseApp("api-gateway");
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        code: "RATE_LIMITED",
        message: "Too many requests",
      },
    }),
  );
  app.get("/api/health", (_req, res) => ok(res, { service: "api-gateway" }));
  app.use("/api", async (req, res) => {
    const path = req.path;
    let target: string;
    const auth = /^\/auth(?:\/|$)/.test(path);
    const catalog = /^\/(events|categories|venues)(?:\/|$)/.test(path);
    const organizer = path.startsWith("/organizer/");
    if (auth) target = env.AUTH_SERVICE_URL;
    else if (
      /^\/(bookings|organizer\/bookings|organizer\/check-in)(?:\/|$)/.test(
        path,
      ) ||
      /^\/organizer\/events\/[^/]+\/check-ins(?:\/|$)/.test(path)
    )
      target = env.BOOKING_SERVICE_URL;
    else if (catalog || /^\/organizer\/(events|venues)(?:\/|$)/.test(path))
      target = env.EVENT_SERVICE_URL;
    else if (/^\/payments(?:\/|$)/.test(path)) target = env.PAYMENT_SERVICE_URL;
    else throw new AppError(404, "NOT_FOUND", "Route not found");
    // Cookie writes require same-origin requests; non-browser clients can omit Origin.
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") &&
      req.get("origin") !== env.CLIENT_ORIGIN
    )
      throw new AppError(403, "ORIGIN_DENIED", "Origin not allowed");
    const publicRoute =
      (auth &&
        ["/auth/register", "/auth/login", "/auth/logout"].includes(path)) ||
      (catalog && req.method === "GET");
    const token = tokenFrom(req);
    const claims = token ? verifyToken(token, env.JWT_SECRET) : undefined;
    if (!publicRoute && !claims)
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    if (organizer && claims?.role !== "ORGANIZER")
      throw new AppError(403, "FORBIDDEN", "Organizer access required");
    res.locals.identity = claims;
    // Build an allowlist: never relay client-supplied identity, internal credentials, host, or forwarding headers.
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-request-id": requestId(res),
    };
    if (claims) {
      headers["x-user-id"] = claims.userId;
      headers["x-user-role"] = claims.role;
    }
    if (token) headers.authorization = `Bearer ${token}`;
    const key = req.get("idempotency-key");
    if (key) headers["idempotency-key"] = key;
    let upstream: Response;
    try {
      upstream = await fetch(`${target}${req.url}`, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method) && req.body !== undefined
          ? { body: JSON.stringify(req.body) }
          : {}),
        signal: AbortSignal.timeout(6000),
        redirect: "manual",
      });
    } catch {
      throw new AppError(
        503,
        "UPSTREAM_UNAVAILABLE",
        "Required service is unavailable",
      );
    }
    for (const cookie of upstream.headers.getSetCookie())
      res.appendHeader("set-cookie", cookie);
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") ?? "application/json")
      .send(Buffer.from(await upstream.arrayBuffer()));
  });
  return finish(app, "api-gateway");
}
