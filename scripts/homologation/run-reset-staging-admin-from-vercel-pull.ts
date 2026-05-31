/**
 * Carrega .env.staging.pull (vercel env pull) e executa reset admin — sem imprimir secrets.
 */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

const pullPath = resolve(process.cwd(), ".env.staging.pull");
if (!existsSync(pullPath)) {
  console.error("[load-staging-pull] .env.staging.pull ausente. Rode: vercel env pull .env.staging.pull --environment=production");
  process.exit(1);
}

for (const line of readFileSync(pullPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[load-staging-pull] DATABASE_URL ausente no pull");
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL?.trim() || !process.env.ADMIN_PASSWORD?.trim()) {
  console.error("[load-staging-pull] ADMIN_EMAIL/ADMIN_PASSWORD ausentes no pull");
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "homolog:reset-staging-admin-password"],
  { stdio: "inherit", env: process.env, cwd: process.cwd() }
);
process.exit(result.status ?? 1);
