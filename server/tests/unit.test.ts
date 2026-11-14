import { it, expect } from "vitest";
import { calculatePrice } from "../apps/booking-service/src/modules/bookings/booking.validation.js";
import { baseEnv } from "../packages/config/src/env.js";
import { serviceCall } from "../packages/config/src/http.js";
import { z } from "zod";
it("calculates integer minor-unit totals and rejects overflow", () => {
  expect(calculatePrice(1099, 3)).toEqual({
    subtotal: 3297,
    fees: 0,
    total: 3297,
  });
  expect(() => calculatePrice(Number.MAX_SAFE_INTEGER, 2)).toThrow();
});
it("fails fast on invalid secrets and environment", () => {
  expect(() => baseEnv.parse({ PORT: 0, JWT_SECRET: "short" })).toThrow();
});
it("normalizes unavailable upstreams", async () => {
  await expect(
    serviceCall(
      "http://127.0.0.1:1",
      "secret",
      crypto.randomUUID(),
      z.unknown(),
    ),
  ).rejects.toMatchObject({ status: 503, code: "UPSTREAM_UNAVAILABLE" });
});
