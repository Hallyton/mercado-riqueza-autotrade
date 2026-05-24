/**
 * Simulador HTTP/CLI do EA Mãe — envia sinais para POST /api/master/signals.
 * Não dispara instruções; dispatch continua manual no painel admin.
 *
 * Env: MASTER_SIGNAL_API_URL, MASTER_EA_API_SECRET (nunca commitar).
 */
import {
  buildMasterSignalRequestBody,
  describeMasterSignalHttpResult,
  formatDryRunOutput,
  isSimulatorSuccessStatus,
  parseSimulatorCliArgs,
  resolveSimulatorEnv,
  sendMasterSignalHttp,
} from "@/lib/master-signals/simulator";

async function main() {
  const parsed = parseSimulatorCliArgs(process.argv);
  if (!parsed.ok) {
    console.error(`[master-signal] ${parsed.message}`);
    process.exit(1);
  }

  const env = resolveSimulatorEnv();
  if (!env.ok) {
    console.error(`[master-signal] ${env.message}`);
    process.exit(1);
  }

  const payload = buildMasterSignalRequestBody(parsed.input);

  if (parsed.input.dryRun) {
    console.log(formatDryRunOutput(env.config, payload));
    process.exit(0);
  }

  try {
    const result = await sendMasterSignalHttp(env.config, payload);
    console.log(describeMasterSignalHttpResult(result));
    process.exit(isSimulatorSuccessStatus(result.httpStatus, result.body) ? 0 : 1);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha de rede";
    console.error(`[master-signal] Erro ao enviar: ${message}`);
    process.exit(1);
  }
}

main();
