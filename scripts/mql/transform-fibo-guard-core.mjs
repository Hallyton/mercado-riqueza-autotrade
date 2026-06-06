/**
 * Transforma EA_FIBO_D1_DOLAR_B3.mq5 copiado em MR_Strategy_FiboD1_Guard_Core.mqh
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const corePath = join(
  process.cwd(),
  "ea/mql5/includes/MR_Strategy_FiboD1_Guard_Core.mqh"
);

let src = readFileSync(corePath, "utf8");

const header = `//+------------------------------------------------------------------+
//| MR_Strategy_FiboD1_Guard_Core.mqh — lógica completa Fibo D1 B3   |
//| Mercado da Riqueza — v2 Simple License Guard                      |
//+------------------------------------------------------------------+
#property strict

#include <Trade/Trade.mqh>
#include "MR_FiboD1_Config.mqh"
#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"

extern bool g_debug_mode;

CTrade g_fibo_trade;

#define trade g_fibo_trade
#define MagicNumber ((ulong)MR_AT_EA_MAGIC)
#define NomeRobo "MR_FIBO_D1_GUARD"
#define PercentualFibo g_mr_fibo_config.percentualFibo
#define LoteTotal g_mr_fibo_config.loteTotal
#define StopPontos g_mr_fibo_config.stopPontos
#define Alvo1Pontos g_mr_fibo_config.alvo1Pontos
#define Alvo2Pontos g_mr_fibo_config.alvo2Pontos
#define LoteAlvo1 g_mr_fibo_config.loteAlvo1
#define LoteAlvo2 g_mr_fibo_config.loteAlvo2
#define LoteFinal g_mr_fibo_config.loteFinal
#define TrailStepPontos g_mr_fibo_config.trailStepPontos
#define TrailOffsetPontos g_mr_fibo_config.trailOffsetPontos
#define HorarioInicio g_mr_fibo_config.horarioInicio
#define HorarioFimEntradas g_mr_fibo_config.horarioFimEntradas
#define HorarioZeragem g_mr_fibo_config.horarioZeragem
#define ZerarNoFimDoDia g_mr_fibo_config.zerarNoFimDoDia
#define PrepararNiveisAntesDaAbertura g_mr_fibo_config.prepararNiveisAntesDaAbertura
#define MinutosAntesParaPreparar g_mr_fibo_config.minutosAntesParaPreparar
#define SlippagePoints g_mr_fibo_config.slippagePoints
#define MaxSpreadPontos g_mr_fibo_config.maxSpreadPontos
#define ForcarTickDolarB3 g_mr_fibo_config.forcarTickDolarB3
#define TickOperacionalDolar g_mr_fibo_config.tickOperacionalDolar
#define DigitosPrecoOperacional g_mr_fibo_config.digitosPrecoOperacional
#define MostrarLinhasNoGrafico g_mr_fibo_config.mostrarLinhasNoGrafico
#define RemoverObjetosAntigos g_mr_fibo_config.removerObjetosAntigos
#define MostrarPainelAdmin g_mr_fibo_config.mostrarPainelAdmin
#define PainelX g_mr_fibo_config.painelX
#define PainelY g_mr_fibo_config.painelY
#define CorFundoPainel clrDarkBlue

string g_fibo_trade_action = "ENTRY";

bool MR_AT_CanTradeAutonomousStrategy(
   const string side,
   const string action,
   const double requested_contracts,
   const double estimated_stop_points,
   string &block_reason
);

`;

// Remove original header through first input block until operouCompraHoje
src = src.replace(/^[\s\S]*?bool operouCompraHoje/m, "bool operouCompraHoje");

src = header + src;

src = src.replace(/\bint OnInit\(\)/g, "bool MR_Fibo_StrategyInit()");
src = src.replace(/\bvoid OnDeinit\(/g, "void MR_Fibo_StrategyDeinit(");
src = src.replace(/\bvoid OnTick\(\)/g, "void MR_Fibo_StrategyOnTick()");
src = src.replace(
  /\bvoid OnTradeTransaction\(/g,
  "void MR_Fibo_StrategyOnTradeTransaction("
);

// OnInit return codes
src = src.replace(/return INIT_PARAMETERS_INCORRECT;/g, "return false;");
src = src.replace(/return INIT_FAILED;/g, "return false;");
src = src.replace(/return INIT_SUCCEEDED;/g, "return true;");

// Init trade magic
src = src.replace(
  /trade\.SetExpertMagicNumber\(MagicNumber\);/,
  "g_fibo_trade.SetExpertMagicNumber((ulong)MR_AT_EA_MAGIC);"
);

// Guard before entry limit send
const guardSnippet = `
   if(!g_debug_mode)
     {
      string guard_side = (type == POSITION_TYPE_BUY ? "BUY" : "SELL");
      string guard_block = "";
      if(!MR_AT_CanTradeAutonomousStrategy(guard_side, g_fibo_trade_action, LoteTotal, StopPontos, guard_block))
        {
         static datetime g_last_can_trade_log = 0;
         if(TimeCurrent() - g_last_can_trade_log > 120)
           {
            MR_AT_LogInfo("FiboGuard", "Can-trade bloqueado: " + guard_block + " action=" + g_fibo_trade_action);
            g_last_can_trade_log = TimeCurrent();
           }
         return false;
        }
     }

`;

if (!src.includes("Can-trade bloqueado")) {
  src = src.replace(
    /(\s+)ResetLastError\(\);\s+bool ok = false;\s+if\(type == POSITION_TYPE_BUY\)/,
    `$1${guardSnippet}$1ResetLastError();\n$1bool ok = false;\n$1if(type == POSITION_TYPE_BUY)`
  );
}

// Reversal action flag
src = src.replace(
  /if\(direcaoReversaoPendente == -1\)\s+enviada = EnviarVendaReversaoMercado\(\);/,
  `g_fibo_trade_action = "REVERSAL";\n   if(direcaoReversaoPendente == -1)\n      enviada = EnviarVendaReversaoMercado();`
);
src = src.replace(
  /else if\(direcaoReversaoPendente == 1\)\s+enviada = EnviarCompraReversaoMercado\(\);/,
  `else if(direcaoReversaoPendente == 1)\n      enviada = EnviarCompraReversaoMercado();`
);

// Default ENTRY flag only in implementation (not forward declaration)
src = src.replace(
  /void CheckMarketEntries\(\)\s*\{\s*\n(\s*)if\(HasOurPosition\(\)\)/,
  `void CheckMarketEntries()\n{\n$1g_fibo_trade_action = "ENTRY";\n\n$1if(HasOurPosition())`
);

writeFileSync(corePath, src, "utf8");
console.log("MR_Strategy_FiboD1_Guard_Core.mqh transformed");
