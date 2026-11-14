import { afterAll, beforeAll, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createGateway } from "../apps/api-gateway/src/app.js";
import { baseEnv } from "../packages/config/src/env.js";
const secret = "test-secret-at-least-thirty-two-characters";
let upstream: Server;
let app: ReturnType<typeof createGateway>;
beforeAll(async () => {
  const echo = express();
  echo.use((req, res) => res.json({ headers: req.headers, path: req.path }));
  upstream = echo.listen(0, "127.0.0.1");
  await new Promise<void>((r) => upstream.once("listening", r));
  const addr = upstream.address();
  if (!addr || typeof addr === "string") throw Error("No port");
  const url = `http://127.0.0.1:${addr.port}`;
  app = createGateway(
    baseEnv.parse({
      PORT: 4000,
      JWT_SECRET: secret,
      INTERNAL_SECRET: secret,
      AUTH_SERVICE_URL: url,
      EVENT_SERVICE_URL: url,
      BOOKING_SERVICE_URL: url,
      PAYMENT_SERVICE_URL: url,
    }),
  );
});
afterAll(() => new Promise<void>((r) => upstream.close(() => r())));
it("forwards public paths with request IDs and strips spoofed headers", async () => {
  const res = await request(app)
    .get("/api/events?page=1")
    .set("x-user-id", "spoof")
    .set("x-user-role", "ORGANIZER")
    .set("x-internal-secret", "spoof");
  expect(res.status).toBe(200);
  expect(res.body.path).toBe("/events");
  expect(res.body.headers["x-user-id"]).toBeUndefined();
  expect(res.body.headers["x-internal-secret"]).toBeUndefined();
  expect(res.headers["x-request-id"]).toBeTruthy();
});
it("rejects protected requests and unknown routes", async () => {
  expect((await request(app).get("/api/bookings")).status).toBe(401);
  expect((await request(app).get("/api/missing")).status).toBe(404);
  expect(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", "https://evil.example")
    ).status,
  ).toBe(403);
});
it("forwards verified identity and enforces organizer access", async () => {
  const userId = crypto.randomUUID();
  const token = jwt.sign({ userId, role: "CUSTOMER" }, secret, {
    issuer: "eventconn",
    audience: "eventconn",
  });
  const res = await request(app)
    .get("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .set("x-user-id", "spoof");
  expect(res.body.headers["x-user-id"]).toBe(userId);
  expect(res.body.headers["x-user-role"]).toBe("CUSTOMER");
  expect(
    (
      await request(app)
        .get("/api/organizer/events")
        .set("Authorization", `Bearer ${token}`)
    ).status,
  ).toBe(403);
});
