//+------------------------------------------------------------------+
//| MR_AT_AutonomousStrategy.mqh — can-trade guard + ciclo estratégia |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_OperationalCommands.mqh"
#include "MR_AT_Equity.mqh"
#include "MR_Strategy_FiboD1_Guard.mqh"

extern string g_license_id;
extern string g_device_id;
extern bool   g_can_accept_new_entries;
extern bool   g_autonomous_strategy_site_enabled;
extern bool   g_debug_mode;

static datetime g_last_daily_risk_report = 0;
static string   g_last_can_trade_reason = "";

//+------------------------------------------------------------------+
string MR_AT_TradeDateIso()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
  }

//+------------------------------------------------------------------+
string MR_AT_BuildEaReadyJson()
  {
   string body = "{";
   body += "\"strategy_code\":" + MR_AT_JsonQuote(MR_FIBO_GUARD_CODE) + ",";
   body += "\"autonomous_strategy_enabled\":" + (g_autonomous_strategy_site_enabled ? "true" : "false") + ",";
   body += "\"strategy_config_hash\":" + MR_AT_JsonQuote(g_mr_fibo_config.configHash) + ",";
   body += "\"terminal_connected\":" + (TerminalInfoInteger(TERMINAL_CONNECTED) ? "true" : "false") + ",";
   body += "\"auto_trading_allowed\":" + (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ? "true" : "false") + ",";
   body += "\"real_orders_enabled\":" + (g_debug_mode ? "false" : "true") + ",";
   body += "\"has_open_position\":" + (PositionsTotal() > 0 ? "true" : "false") + ",";
   body += "\"has_pending_orders\":" + (OrdersTotal() > 0 ? "true" : "false") + ",";
   body += "\"last_strategy_decision_reason\":" + MR_AT_JsonQuote(g_last_can_trade_reason);
   body += "}";
   return body;
  }

//+------------------------------------------------------------------+
bool MR_AT_ShouldSendDailyRiskReport()
  {
   if(!InpEnableAutonomousStrategy)
      return false;
   if(StringLen(InpAutonomousStrategyCode) == 0 ||
      InpAutonomousStrategyCode != MR_FIBO_GUARD_CODE)
      return false;
   if(StringLen(g_license_id) < 4)
      return false;
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportDailyRisk(const bool force = false)
  {
   if(!MR_AT_ShouldSendDailyRiskReport())
      return false;
   if(!force && TimeCurrent() - g_last_daily_risk_report < 60)
      return true;

   double realized = 0;
   datetime from = MR_Fibo_DayStart(TimeCurrent());
   if(HistorySelect(from, TimeCurrent()))
     {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
        {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0)
            continue;
         if(HistoryDealGetString(ticket, DEAL_SYMBOL) != _Symbol)
            continue;
         realized += HistoryDealGetDouble(ticket, DEAL_PROFIT);
        }
     }

   double openPnl = 0;
   for(int p = PositionsTotal() - 1; p >= 0; p--)
     {
      ulong t = PositionGetTicket(p);
      if(t == 0 || !PositionSelectByTicket(t))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      openPnl += PositionGetDouble(POSITION_PROFIT);
     }

   string body = "{";
   body += "\"license_id\":" + MR_AT_JsonQuote(g_license_id) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"symbol\":" + MR_AT_JsonQuote(_Symbol) + ",";
   body += "\"strategy_code\":" + MR_AT_JsonQuote(MR_FIBO_GUARD_CODE) + ",";
   body += "\"trade_date\":" + MR_AT_JsonQuote(MR_AT_TradeDateIso()) + ",";
   body += "\"realized_pnl\":" + DoubleToString(realized, 2) + ",";
   body += "\"open_pnl\":" + DoubleToString(openPnl, 2);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/daily-risk/report", body, response, status))
     {
      MR_AT_LogError("DailyRisk", "report request failed");
      return false;
     }
   if(status >= 200 && status < 300)
     {
      g_last_daily_risk_report = TimeCurrent();
      string stateId = MR_AT_JsonGetString(response, "state_id");
      string tradeDate = MR_AT_JsonGetString(response, "trade_date");
      MR_AT_LogInfo("DailyRisk", "report ok stateId=" + stateId +
                    " tradeDate=" + tradeDate +
                    " strategy=" + MR_FIBO_GUARD_CODE +
                    " symbol=" + _Symbol);
      return true;
     }

   string reason = MR_AT_JsonGetString(response, "code");
   if(StringLen(reason) == 0)
      reason = MR_AT_JsonGetString(response, "detail");
   MR_AT_LogError("DailyRisk", "report rejected status=" + IntegerToString(status) +
                  " reason=" + reason);
   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_CanTradeAutonomousStrategy(
   const string side,
   const string action,
   const double requested_contracts,
   const double estimated_stop_points,
   string &block_reason
)
  {
   block_reason = "";
   if(MR_AT_IsAdminPaused())
     {
      block_reason = "ADMIN_OPERATION_PAUSED";
      return false;
     }
   if(StringLen(g_license_id) < 4)
     {
      block_reason = "LICENSE_NOT_ACTIVE";
      return false;
     }

   if(g_last_daily_risk_report == 0 || TimeCurrent() - g_last_daily_risk_report >= 60)
      MR_AT_ReportDailyRisk(true);

   string ea_ready = MR_AT_BuildEaReadyJson();
   string body = "{";
   body += "\"strategy_code\":" + MR_AT_JsonQuote(MR_FIBO_GUARD_CODE) + ",";
   body += "\"license_id\":" + MR_AT_JsonQuote(g_license_id) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"symbol\":" + MR_AT_JsonQuote(_Symbol) + ",";
   body += "\"trade_mode\":" + MR_AT_JsonQuote(MR_AT_GetTradeMode()) + ",";
   body += "\"magic_number\":" + IntegerToString((int)MR_AT_EA_MAGIC) + ",";
   body += "\"side\":" + MR_AT_JsonQuote(side) + ",";
   body += "\"action\":" + MR_AT_JsonQuote(action) + ",";
   body += "\"requested_contracts\":" + IntegerToString((int)requested_contracts) + ",";
   body += "\"estimated_stop_points\":" + DoubleToString(estimated_stop_points, 2) + ",";
   body += "\"strategy_config_hash\":" + MR_AT_JsonQuote(g_mr_fibo_config.configHash) + ",";
   body += "\"ea_ready\":" + ea_ready;
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/autonomous-strategy/can-trade", body, response, status))
     {
      block_reason = "AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED";
      g_last_can_trade_reason = block_reason;
      return false;
     }

   if(status < 200 || status >= 300)
     {
      block_reason = "UNKNOWN_BLOCK";
      g_last_can_trade_reason = block_reason;
      return false;
     }

   bool allowed = MR_AT_JsonGetBool(response, "allowed");
   if(!allowed)
     {
      block_reason = MR_AT_JsonGetString(response, "reason_code");
      if(StringLen(block_reason) == 0)
         block_reason = MR_AT_JsonGetString(response, "detail");
      g_last_can_trade_reason = block_reason;
      return false;
     }

   g_last_can_trade_reason = "OK";
   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_ProcessAutonomousStrategy()
  {
   if(!InpEnableAutonomousStrategy)
      return;
   if(!g_autonomous_strategy_site_enabled)
      return;
   if(StringLen(InpAutonomousStrategyCode) == 0 ||
      InpAutonomousStrategyCode != MR_FIBO_GUARD_CODE)
      return;
   if(MR_AT_GetTradeMode() == "REAL" && !MR_Fibo_IsConfigReadyForReal())
     {
      static datetime g_last_config_missing_log = 0;
      if(TimeCurrent() - g_last_config_missing_log > 300)
        {
         MR_AT_LogInfo("Autonomous", "STRATEGY_CONFIG_MISSING — aguardando config publicada.");
         g_last_config_missing_log = TimeCurrent();
        }
      return;
     }

   MR_Fibo_OnTickStrategy();
  }
