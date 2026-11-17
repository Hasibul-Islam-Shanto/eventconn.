import express, {
  type Request,
  type Response,
  type NextFunction,
  type ErrorRequestHandler,
} from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { logger } from "../../logger/src/index.js";
import {
  roleSchema,
  type Identity,
  type Role,
} from "../../shared-types/src/index.js";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const assert: (
  condition: unknown,
  status: number,
  code: string,
  message: string,
) => asserts condition = (condition, status, code, message) => {
  if (!condition) throw new AppError(status, code, message);
};
export function verifyToken(token: string, secret: string): Identity {
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "eventconn",
      audience: "eventconn",
    });
    return z.object({ userId: z.uuid(), role: roleSchema }).parse(claims);
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }
}
export function tokenFrom(req: Request): string | undefined {
  const bearer = req.headers.authorization;
  return bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : typeof req.cookies?.session === "string"
      ? req.cookies.session
      : undefined;
}
export function identity(res: Response): Identity {
  return res.locals.identity as Identity;
}
export function requestId(res: Response): string {
  return res.locals.requestId as string;
}
export function authenticate(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = tokenFrom(req);
      assert(token, 401, "UNAUTHENTICATED", "Authentication required");
      res.locals.identity = verifyToken(token, secret);
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function role(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    try {
      assert(
        roles.includes(identity(res).role),
        403,
        "FORBIDDEN",
        "Role not allowed",
      );
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function internal(secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.get("x-internal-secret") ?? "";
    if (
      value.length !== secret.length ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(secret))
    )
      return next(
        new AppError(
          401,
          "UNTRUSTED_SERVICE",
          "Internal authentication required",
        ),
      );
    next();
  };
}
export const ok = (
  res: Response,
  data: unknown,
  message = "Success",
  status = 200,
) => res.status(status).json({ success: true, message, data });
export const pagination = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function paged(
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return res.json({
    success: true,
    message: "Success",
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
export const uuid = z.uuid();
export function baseApp(service: string) {
  const app = express();
  const log = logger(service);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.locals.requestId = z.uuid().safeParse(req.get("x-request-id")).success
      ? req.get("x-request-id")
      : randomUUID();
    res.setHeader("x-request-id", requestId(res));
    res.on("finish", () =>
      log.info(
        {
          requestId: requestId(res),
          userId: (res.locals.identity as Identity | undefined)?.userId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
        },
        "request completed",
      ),
    );
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/health", (_req, res) => ok(res, { service, status: "ok" }));
  return app;
}
export function finish(app: express.Express, service: string) {
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Route not found")),
  );
  const log = logger(service);
  const errors: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid request",
        code: "VALIDATION_ERROR",
      });
      return;
    }
    if (err instanceof AppError) {
      res
        .status(err.status)
        .json({ success: false, message: err.message, code: err.code });
      return;
    }
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? err.code
        : undefined;
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? err.status
        : undefined;
    if (code === "P2002") {
      res.status(409).json({
        success: false,
        message: "Resource already exists",
        code: "CONFLICT",
      });
      return;
    }
    if (code === "P2003") {
      res.status(409).json({
        success: false,
        message: "Referenced resource does not exist or is still in use",
        code: "REFERENCE_CONFLICT",
      });
      return;
    }
    if (code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Resource not found",
        code: "NOT_FOUND",
      });
      return;
    }
    if (status === 400 || status === 413) {
      res.status(status).json({
        success: false,
        message: "Invalid request body",
        code: "VALIDATION_ERROR",
      });
      return;
    }
    log.error(
      {
        requestId: requestId(res),
        errorType: err instanceof Error ? err.name : "UnknownError",
        code,
      },
      "Unhandled service error",
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  };
  app.use(errors);
  return app;
}
export async function serviceCall<T>(
  url: string,
  secret: string,
  correlationId: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-request-id": correlationId,
        ...init.headers,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AppError(
      503,
      "UPSTREAM_UNAVAILABLE",
      "Required service is unavailable",
    );
  }
  if (!response.ok)
    throw new AppError(
      [400, 403, 404, 409].includes(response.status) ? response.status : 502,
      "UPSTREAM_ERROR",
      "Required service rejected the request",
    );
  try {
    const body = z
      .object({ success: z.literal(true), data: schema })
      .parse(await response.json());
    return body.data;
  } catch {
    throw new AppError(
      502,
      "UPSTREAM_INVALID",
      "Invalid response from required service",
    );
  }
}
