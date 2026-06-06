import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readMql(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), "ea", "mql5", relativePath), "utf8");
}

describe("contratos MQL5 — EA cliente", () => {
  const executor = readMql("MR_AutoTrade_Executor.mq5");
  const constants = readMql(path.join("includes", "MR_AT_Constants.mqh"));
  const auth = readMql(path.join("includes", "MR_AT_Auth.mqh"));
  const license = readMql(path.join("includes", "MR_AT_License.mqh"));
  const execution = readMql(path.join("includes", "MR_AT_Execution.mqh"));
  const signal = readMql(path.join("includes", "MR_AT_Signal.mqh"));
  const http = readMql(path.join("includes", "MR_AT_Http.mqh"));
  const realTrading = readMql(path.join("includes", "MR_AT_RealTrading.mqh"));
  const management = readMql(path.join("includes", "MR_AT_ManagementPlan.mqh"));
  const combinedClient = [executor, constants, execution, signal, realTrading, management, auth, license, http].join(
    "\n"
  );

  it("mantém apenas inputs operacionais permitidos, sem parâmetros de estratégia", () => {
    expect(executor).toContain("input string InpApiBaseUrl");
    expect(executor).toContain("input string InpActivationCode");
    expect(executor).toContain("input string InpDeviceId");
    expect(executor).toContain("input int    InpLogLevel");
    expect(executor).toContain("input bool   InpDebugMode       = true");
    expect(executor).toContain('input string InpTradeMode       = "DEMO"');

    for (const forbiddenInput of [
      "InpStopLoss",
      "InpTakeProfit",
      "InpTrailing",
      "InpStrategy",
      "InpIndicator",
      "InpStartHour",
      "InpEndHour",
      "InpManualLot",
    ]) {
      expect(executor).not.toContain(forbiddenInput);
    }
  });

  it("usa magic number fixo e payload de instruction sem campo estratégico", () => {
    expect(constants).toContain("#define MR_AT_EA_MAGIC");
    expect(constants).toContain("instruction_id");
    expect(constants).toContain("idempotency_key");
    expect(constants).toContain("magic_number");
    expect(constants).not.toContain("strategy");
    expect(constants).not.toContain("indicator");
    expect(constants).not.toContain("InpStopLoss");
    expect(constants).not.toContain("InpTakeProfit");
  });

  it("integra snapshots e proteção SL/TP para conta real", () => {
    expect(realTrading).toContain("/api/v1/ea/account-snapshots");
    expect(realTrading).toContain("/api/v1/ea/execution-protection");
    expect(realTrading).toContain("PRE_MARKET");
    expect(realTrading).toContain("PRE_TRADE");
    expect(realTrading).toContain("PROTECTION_CONFIRMED");
    expect(realTrading).toContain("PROTECTION_FAILED");
    expect(execution).toContain("MR_AT_ResolveInstructionMagic");
    expect(signal).toContain("account_login");
    expect(signal).toContain("MR_AT_ValidateInstructionContext");
    expect(executor).toContain("MR_AT_EnsurePreMarketSnapshot");
    expect(executor).toContain('MR_AT_SendAccountSnapshot("POST_MARKET")');
  });

  it("envia trade_mode e conta na ativação sem logar código ou token", () => {
    expect(license).toContain("trade_mode");
    expect(license).toContain("account_login");
    expect(license).toContain("account_server");
    expect(executor).toContain("TradeMode configurado:");
    expect(license).not.toContain("MR_AT_LogInfo(\"License\", code");
    expect(license).not.toContain("MR_AT_LogInfo(\"License\", g_device_token");
  });

  it("não loga Authorization, Bearer ou tokens em mensagens operacionais", () => {
    expect(combinedClient).not.toMatch(
      /MR_AT_Log(?:Info|Debug|Error)\([^)]*Authorization:\s*Bearer/
    );
    expect(combinedClient).not.toMatch(
      /MR_AT_Log(?:Info|Debug|Error)\([^)]*g_device_token/
    );
    expect(combinedClient).not.toMatch(
      /MR_AT_Log(?:Info|Debug|Error)\([^)]*\+\s*InpActivationCode/
    );
    expect(execution).not.toContain("payload=" + "{");
  });

  it("não loga activation code nem device token bruto em mensagens operacionais", () => {
    const combined = [auth, license, http].join("\n");

    expect(combined).toContain("FileWriteString(h, g_device_token");
    expect(combined).not.toMatch(/MR_AT_Log(?:Info|Debug|Error)\([^)]*g_device_token/);
    expect(combined).not.toMatch(/MR_AT_Log(?:Info|Debug|Error)\([\s\S]*\+\s*code/);
    expect(combined).not.toMatch(/MR_AT_Log(?:Info|Debug|Error)\([\s\S]*\+\s*activation_code/);
  });

  it("DebugMode bloqueia OrderSend e reporta execução simulada", () => {
    expect(execution).toContain("if(g_debug_mode)");
    expect(execution).toContain("DEBUG_MODE — ordem NÃO enviada");
    expect(execution).toContain("OrderSend(request, result)");
    expect(execution).toContain('MR_AT_ReportExecution(instr.instruction_id, "FILLED", "DEBUG"');
  });

  it("integra config runtime Fibo D1 via site sem inputs de estrategia no executor", () => {
    const fiboConfig = readMql(path.join("includes", "MR_FiboD1_Config.mqh"));
    const fiboGuard = readMql(path.join("includes", "MR_Strategy_FiboD1_Guard.mqh"));
    const fiboCore = readMql(path.join("includes", "MR_Strategy_FiboD1_Guard_Core.mqh"));
    const autonomous = readMql(path.join("includes", "MR_AT_AutonomousStrategy.mqh"));
    expect(fiboConfig).toContain("MR_Fibo_ParseConfigFromEaJson");
    expect(fiboGuard).toContain("MR_Fibo_StrategyOnTick");
    expect(fiboCore).toContain("Can-trade bloqueado");
    expect(autonomous).toContain("/api/v1/ea/autonomous-strategy/can-trade");
    expect(autonomous).not.toContain("MR_AT_ProcessInstruction");
    expect(fiboGuard).not.toContain("input ");
  });

  it("pull instructions usa contrato /api/v1/ea/instructions e ignora ordem não suportada", () => {
    expect(signal).toContain("/api/v1/ea/instructions?login=");
    expect(signal).toContain("instruction_id");
    expect(signal).toContain("idempotency_key");
    expect(signal).toContain("Tipo de ordem não suportado:");
    expect(signal).toContain("ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER");
    expect(signal).toContain("STOP_LOSS_AND_TAKE_PROFIT_REQUIRED");
    expect(signal).toContain("stop_loss_price");
    expect(signal).toContain("management_plan");
    expect(signal).toContain("MR_AT_ParseManagementPlanBlock");
    expect(combinedClient).toContain("MR_AT_ApplyManagementPlanAfterEntry");
    expect(combinedClient).toContain("/api/v1/ea/management-events");
    expect(constants).toContain("order_price");
    expect(signal).not.toContain("strategy");
  });
});

describe("contratos MQL5 — EA Mãe", () => {
  const master = readMql("MR_AutoTrade_Master_Signal.mq5");
  const constants = readMql(path.join("includes", "MR_MS_Constants.mqh"));
  const http = readMql(path.join("includes", "MR_MS_Http.mqh"));
  const ui = readMql(path.join("includes", "MR_MS_UI.mqh"));

  it("mantém emissão manual por padrão e TTL limitado a 300 segundos", () => {
    expect(master).toContain("input string      InpMasterSecret");
    expect(master).toContain("input int         InpExpiresSeconds  = 300");
    expect(master).toContain("input bool        InpSendOnInit      = false");
    expect(master).toContain("input bool        InpSendOnce        = true");
    expect(constants).toContain("#define MR_MS_MIN_EXPIRES       5");
    expect(constants).toContain("#define MR_MS_MAX_EXPIRES       300");
  });

  it("payload MasterSignal contém apenas contrato de sinal, sem estratégia", () => {
    expect(master).toContain('"master_signal_id"');
    expect(master).toContain('"source"');
    expect(master).toContain('"symbol"');
    expect(master).toContain('"side"');
    expect(master).toContain('"order_type"');
    expect(master).toContain('"purpose"');
    expect(master).toContain('"profile"');
    expect(master).toContain('"expires_in_seconds"');
    expect(master).toContain('"idempotency_key"');
    expect(master).not.toContain("OrderSend(");
    expect(master).not.toContain("strategy");
    expect(master).not.toContain("indicator");
  });

  it("Authorization do EA Mãe é redigido em logs e não aparece no painel", () => {
    expect(http).toContain("Authorization: Bearer ***REDACTED***");
    expect(http).toContain("Authorization: Bearer \" + g_ms_master_secret");
    expect(ui).not.toContain("g_ms_master_secret");
    expect(master).not.toMatch(/MR_MS_Log(?:Info|Debug|Error)\([^)]*g_ms_master_secret/);
  });
});
