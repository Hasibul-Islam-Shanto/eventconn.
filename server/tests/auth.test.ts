import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { PrismaClient } from "../apps/auth-service/generated/client/index.js";
import { createAuthApp } from "../apps/auth-service/src/app.js";
import jwt from "jsonwebtoken";
const url = process.env.AUTH_DATABASE_URL;
const secret = "test-secret-at-least-thirty-two-characters";
describe.skipIf(!url)("auth PostgreSQL HTTP", () => {
  const db = new PrismaClient();
  const app = createAuthApp(db, secret);
  const email = `auth-${crypto.randomUUID()}@example.com`;
  let cookie: string;
  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });
  beforeAll(async () => {
    await db.$connect();
  });
  it("registers a customer without exposing a hash", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Customer", email, password: "safe-password-123" });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("CUSTOMER");
    expect(res.body.data.passwordHash).toBeUndefined();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe("safe-password-123");
  });
  it("rejects duplicate email and invalid or injected role", async () => {
    expect(
      (
        await request(app)
          .post("/auth/register")
          .send({ name: "Customer", email, password: "safe-password-123" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/auth/register")
          .send({ name: "C", email: "bad", password: "x", role: "ORGANIZER" })
      ).status,
    ).toBe(400);
  });
  it("rejects wrong passwords and missing, invalid, expired JWTs", async () => {
    expect(
      (
        await request(app)
          .post("/auth/login")
          .send({ email, password: "wrong" })
      ).status,
    ).toBe(401);
    for (const token of [
      "",
      "invalid",
      jwt.sign({ userId: crypto.randomUUID(), role: "CUSTOMER" }, secret, {
        expiresIn: -1,
        issuer: "eventconn",
        audience: "eventconn",
      }),
    ])
      expect(
        (
          await request(app)
            .get("/auth/me")
            .set("Authorization", `Bearer ${token}`)
        ).status,
      ).toBe(401);
  });
  it("logs in, verifies JWT, and returns current user", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "safe-password-123" });
    expect(res.status).toBe(200);
    cookie = String(res.headers["set-cookie"]?.[0] ?? "");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(
      (await request(app).get("/auth/me").set("Cookie", cookie)).body.data
        .email,
    ).toBe(email);
  });
  it("clears the cookie on logout", async () => {
    const res = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(String(res.headers["set-cookie"]?.[0] ?? "")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
  });
});
