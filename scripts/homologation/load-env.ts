/**
 * Carrega .env / .env.local antes de Prisma ou lib/*.
 * Deve ser importado como primeira linha em cada script de homologação.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
