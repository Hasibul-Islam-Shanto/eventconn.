import { config } from "dotenv";
import { defineConfig } from "vitest/config";
config({ path: ".env.test", quiet: true });
// Tests also accept explicit environment variables. Do not silently use an application database.
for (const name of ["AUTH", "EVENT", "BOOKING", "PAYMENT", "NOTIFICATION"]) {
  const value = process.env[`${name}_DATABASE_URL`];
  if (value && !new URL(value).pathname.endsWith("_test"))
    throw new Error(
      `${name}_DATABASE_URL must target a database ending in _test`,
    );
}
export default defineConfig({
  test: { fileParallelism: false, testTimeout: 20000, hookTimeout: 60000 },
});
