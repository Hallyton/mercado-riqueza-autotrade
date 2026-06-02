//+------------------------------------------------------------------+
//| BBX_Strategy.mqh — D-1 / Fibonacci / cenário por preço atual     |
//+------------------------------------------------------------------+
#ifndef BBX_STRATEGY_MQH
#define BBX_STRATEGY_MQH

void BBX_StrategyCalcularReferenciasD1()
  {
   g_strat.maxD1Prev = iHigh(g_symbol, TimeframeReferencia, 1);
   g_strat.minD1Prev = iLow(g_symbol, TimeframeReferencia, 1);
   if(g_strat.maxD1Prev <= 0.0 || g_strat.minD1Prev <= 0.0)
      BBX_LogErro("Não foi possível obter máxima/mínima D-1");
  }

void BBX_StrategyAtualizarPrecoAtual()
  {
   MqlTick tick;
   string motivo = "";
   if(BBX_ObterTickMercado(tick, motivo))
      g_strat.precoAtual = BBX_NormalizePrice((tick.bid + tick.ask) * 0.5);
   else
      g_strat.precoAtual = 0.0;
  }

void BBX_StrategyCalcularNiveisFibo()
  {
   g_strat.amplitude = g_strat.maxD1Prev - g_strat.minD1Prev;
   if(g_strat.amplitude <= 0.0)
     {
      BBX_LogErro("Amplitude D-1 inválida");
      g_strat.fiboDist = g_strat.compra = g_strat.venda = 0.0;
      return;
     }
   g_strat.fiboDist = g_strat.amplitude * PercentualFibo;
   g_strat.compra = BBX_NormalizePrice(g_strat.minD1Prev + g_strat.fiboDist);
   g_strat.venda  = BBX_NormalizePrice(g_strat.maxD1Prev - g_strat.fiboDist);
  }

ENUM_BBX_SCENARIO BBX_StrategyDetectarCenario()
  {
   BBX_StrategyAtualizarPrecoAtual();
   if(g_strat.compra <= 0.0 || g_strat.venda <= 0.0 || g_strat.precoAtual <= 0.0)
      return BBX_SCENARIO_NONE;
   if(g_strat.compra >= g_strat.venda)
     {
      BBX_LogUnico("niveis_invertidos", "Níveis inválidos: compra >= venda", true);
      return BBX_SCENARIO_NONE;
     }

   double tol = BBX_ToleranciaPrecoOrdem();
   double px = g_strat.precoAtual;

   if(px > g_strat.venda + tol)
      return BBX_CENARIO_ACIMA_VENDA;
   if(px < g_strat.compra - tol)
      return BBX_CENARIO_ABAIXO_COMPRA;
   return BBX_CENARIO_ENTRE_NIVEIS;
  }

bool BBX_StrategyCenarioOperacional(const ENUM_BBX_SCENARIO cen)
  {
   return (cen == BBX_CENARIO_ENTRE_NIVEIS);
  }

string BBX_StrategyCenarioTexto(const ENUM_BBX_SCENARIO cen)
  {
   switch(cen)
     {
      case BBX_CENARIO_ENTRE_NIVEIS:
         return "Preço entre compra e venda — operacional";
      case BBX_CENARIO_ABAIXO_COMPRA:
         return "Preço abaixo de compra — sem operação";
      case BBX_CENARIO_ACIMA_VENDA:
         return "Preço acima de venda — sem operação";
      default:
         return "indefinido";
     }
  }

void BBX_StrategyLogSemOperacao(const ENUM_BBX_SCENARIO cen)
  {
   string chaveDia = IntegerToString((int)g_state.dayKey);
   if(cen == BBX_CENARIO_ABAIXO_COMPRA)
      BBX_LogUnico("sem_op_abaixo_" + chaveDia,
                   "Sem operação: preço abaixo da região de compra.", false);
   else if(cen == BBX_CENARIO_ACIMA_VENDA)
      BBX_LogUnico("sem_op_acima_" + chaveDia,
                   "Sem operação: preço acima da região de venda.", false);
  }

void BBX_StrategyRecalcular()
  {
   BBX_StrategyCalcularReferenciasD1();
   BBX_StrategyCalcularNiveisFibo();
   g_strat.scenario = BBX_StrategyDetectarCenario();
  }

#endif
