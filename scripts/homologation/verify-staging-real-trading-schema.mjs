/**
 * Verifica migrations de conta real no PostgreSQL (staging ou local).
 * Uso: defina DATABASE_URL no shell (não commitar .env).
 *   node scripts/homologation/verify-staging-real-trading-schema.mjs
 * Opcional: APPLY_MIGRATE=1 para rodar prisma migrate deploy antes.
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v.length > 0) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const redact = (s) => String(s).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[REDACTED]");

const url = loadDatabaseUrl();
if (!url) {
  console.error(
    "DATABASE_URL ausente. Defina no shell ou em .env local (não commitar). Staging: copiar do Neon/Vercel."
  );
  process.exit(2);
}

process.env.DATABASE_URL = url;

if (process.env.APPLY_MIGRATE === "1") {
  try {
    const out = execSync("npx prisma migrate deploy", {
      encoding: "utf8",
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(redact(out));
  } catch (e) {
    if (e.stdout) console.log(redact(String(e.stdout)));
    if (e.stderr) console.error(redact(String(e.stderr)));
    process.exit(e.status ?? 1);
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const requiredTables = [
  "real_trading_approvals",
  "account_snapshots",
  "real_trade_preflights",
  "execution_protection_reports",
  "terms_acceptances",
];

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'real_trading_approvals',
        'account_snapshots',
        'real_trade_preflights',
        'execution_protection_reports',
        'terms_acceptances'
      )
    ORDER BY table_name
  `;

  const found = new Set(rows.map((r) => r.table_name));
  const missing = requiredTables.filter((t) => !found.has(t));

  console.log("Tabelas encontradas:", [...found].join(", ") || "(nenhuma)");
  if (missing.length) {
    console.error("Tabelas ausentes:", missing.join(", "));
    process.exit(1);
  }

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    WHERE migration_name LIKE '%real_trading%'
       OR migration_name LIKE '%conditional_real%'
    ORDER BY finished_at DESC
  `;

  for (const m of migrations) {
    console.log(`Migration OK: ${m.migration_name}`);
  }

  console.log("Schema real trading: OK");
}

main()
  .catch((err) => {
    console.error(redact(err.message ?? err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
