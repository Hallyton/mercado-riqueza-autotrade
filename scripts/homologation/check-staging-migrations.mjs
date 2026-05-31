import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const pull = resolve(process.cwd(), ".env.staging.pull");
if (!existsSync(pull)) {
  console.log("NO_PULL_FILE");
  process.exit(1);
}

let dbUrl = "";
for (const line of readFileSync(pull, "utf8").split(/\r?\n/)) {
  if (line.startsWith("DATABASE_URL=")) {
    dbUrl = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
    break;
  }
}

if (!dbUrl || dbUrl.includes("localhost")) {
  console.log("STAGING_DB: INVALID_OR_LOCALHOST");
  process.exit(1);
}

const hostMatch = dbUrl.match(/@([^/]+)\//);
console.log("STAGING_DB_HOST:", hostMatch?.[1] ?? "unknown");

const out = execSync("npx prisma migrate status", {
  env: { ...process.env, DATABASE_URL: dbUrl, DOTENV_CONFIG_PATH: "" },
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
});

const lines = out.split(/\r?\n/).filter((l) =>
  /migration|Database schema|pending|applied|found/i.test(l)
);
console.log(lines.join("\n"));
