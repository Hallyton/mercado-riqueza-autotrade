import fs from "fs";

const path = ".env.staging.pull";
if (!fs.existsSync(path)) {
  console.log("NO_ENV_FILE");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      if (eq <= 0) return null;
      const k = l.slice(0, eq).trim();
      let v = l.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
    .filter(Boolean),
);

const secretKeys = new Set(["ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "DATABASE_URL"]);
for (const k of [
  "BILLING_PROVIDER",
  "ASAAS_ENV",
  "BILLING_REAL_PAYMENTS_ENABLED",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
]) {
  const v = env[k] ?? "";
  if (secretKeys.has(k)) {
    console.log(`${k}: ${v.length > 0 ? `SET(len=${v.length})` : "EMPTY"}`);
  } else {
    console.log(`${k}: ${v || "EMPTY"}`);
  }
}
