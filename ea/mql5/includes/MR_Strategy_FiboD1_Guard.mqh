//+------------------------------------------------------------------+
//| MR_Strategy_FiboD1_Guard.mqh — wrapper v2 Simple License Guard     |
//+------------------------------------------------------------------+
#property strict

#define MR_FIBO_GUARD_CODE      "MR_FIBO_D1_GUARD"
#define MR_FIBO_GUARD_VERSION   "2.0.0"

#include "MR_Strategy_FiboD1_Guard_Core.mqh"

bool MR_Fibo_InitStrategy()
  {
   if(!g_mr_fibo_config.loaded && MR_AT_GetTradeMode() == "REAL")
      return false;
   return MR_Fibo_StrategyInit();
  }

void MR_Fibo_OnTickStrategy()
  {
   if(!g_mr_fibo_config.loaded)
      return;
   MR_Fibo_StrategyOnTick();
  }

void MR_Fibo_OnTradeTransactionStrategy(
   const MqlTradeTransaction &trans,
   const MqlTradeRequest &request,
   const MqlTradeResult &result
)
  {
   if(!g_mr_fibo_config.loaded)
      return;
   MR_Fibo_StrategyOnTradeTransaction(trans, request, result);
  }

void MR_Fibo_DeinitStrategy(const int reason)
  {
   MR_Fibo_StrategyDeinit(reason);
  }

double MR_Fibo_GetLoteTotal()
  {
   if(g_mr_fibo_config.loaded && g_mr_fibo_config.loteTotal > 0)
      return g_mr_fibo_config.loteTotal;
   return 1.0;
  }

datetime MR_Fibo_DayStart(datetime when)
  {
   MqlDateTime dt;
   TimeToStruct(when, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
  }

bool MR_Fibo_IsConfigReadyForReal()
  {
   return g_mr_fibo_config.loaded;
  }
