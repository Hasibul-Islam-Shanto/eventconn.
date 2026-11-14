import "dotenv/config";
import { execFileSync } from "node:child_process";
const action = process.argv[2];
for (const name of ["auth", "event", "booking", "notification", "payment"]) {
  const schema = `apps/${name}-service/prisma/schema.prisma`;
  const args =
    action === "generate"
      ? ["generate", "--schema", schema]
      : ["migrate", "deploy", "--schema", schema];
  execFileSync("npx", ["prisma", ...args], { stdio: "inherit" });
}
