import { execFileSync } from "node:child_process";
import { cpSync } from "node:fs";
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
for (const name of ["auth", "event", "booking", "notification", "payment"])
  cpSync(
    `apps/${name}-service/generated`,
    `dist/apps/${name}-service/generated`,
    { recursive: true },
  );
