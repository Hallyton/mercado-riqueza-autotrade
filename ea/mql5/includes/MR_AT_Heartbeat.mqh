//+------------------------------------------------------------------+
//| MR_AT_Heartbeat.mqh — POST /api/v1/ea/heartbeat                   |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Equity.mqh"
#include "MR_AT_Position.mqh"
#include "MR_AT_Orders.mqh"
#include "MR_FiboD1_Config.mqh"

extern bool g_autonomous_strategy_site_enabled;
extern bool g_debug_mode;
extern bool g_halt_new_entries;
extern bool g_halt_all_trading;
extern bool g_can_accept_new_entries;
extern bool g_can_manage_open_positions;
extern int  g_heartbeat_interval_sec;

datetime g_lastHeartbeatSentAt = 0;

//+------------------------------------------------------------------+
bool MR_AT_HeartbeatOnTimer()
  {
   if(g_lastHeartbeatSentAt > 0 &&
      TimeCurrent() - g_lastHeartbeatSentAt < g_heartbeat_interval_sec)
      return true;
   return MR_AT_SendHeartbeat();
  }

//+------------------------------------------------------------------+
string MR_AT_HeartbeatEaReadyJson()
  {
   string body = "{";
   body += "\"strategy_code\":\"MR_FIBO_D1_GUARD\",";
   body += "\"autonomous_strategy_enabled\":" + (g_autonomous_strategy_site_enabled ? "true" : "false") + ",";
   body += "\"strategy_config_hash\":" + MR_AT_JsonQuote(g_mr_fibo_config.configHash) + ",";
   body += "\"terminal_connected\":" + (TerminalInfoInteger(TERMINAL_CONNECTED) ? "true" : "false") + ",";
   body += "\"auto_trading_allowed\":" + (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ? "true" : "false") + ",";
   body += "\"real_orders_enabled\":" + (g_debug_mode ? "false" : "true") + ",";
   body += "\"has_open_position\":" + (PositionsTotal() > 0 ? "true" : "false") + ",";
   body += "\"has_pending_orders\":" + (OrdersTotal() > 0 ? "true" : "false");
   body += "}";
   return body;
  }

//+------------------------------------------------------------------+
bool MR_AT_SendHeartbeat()
  {
   string pending = MR_AT_BuildPendingOrdersJson();
   string positions = MR_AT_BuildOpenPositionsJson();
   string pos_hash = MR_AT_ComputePositionsHash();

   string autonomous = MR_AT_HeartbeatEaReadyJson();

   string body = "{";
   body += "\"login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"trade_mode\":" + MR_AT_JsonQuote(MR_AT_GetTradeMode()) + ",";
   body += "\"ea_status\":" + MR_AT_JsonQuote("ONLINE") + ",";
   body += "\"ea_version\":" + MR_AT_JsonQuote(MR_AT_EA_VERSION) + ",";
   body += "\"equity\":" + DoubleToString(MR_AT_GetEquity(), 2) + ",";
   body += "\"balance\":" + DoubleToString(MR_AT_GetBalance(), 2) + ",";
   body += "\"margin\":" + DoubleToString(MR_AT_GetMargin(), 2) + ",";
   body += "\"positions_hash\":" + MR_AT_JsonQuote(pos_hash) + ",";
   body += "\"pending_orders\":" + pending + ",";
   body += "\"open_positions\":" + positions + ",";
   body += "\"autonomous_strategy\":" + autonomous;
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/heartbeat", body, response, status))
      return false;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("Heartbeat", "HTTP " + IntegerToString(status) + " " +
                     MR_AT_JsonSummarize(response, 160));
      return false;
     }

   g_halt_new_entries = MR_AT_JsonGetBool(response, "halt_new_entries");
   g_halt_all_trading = MR_AT_JsonGetBool(response, "halt_all_trading");
   g_can_accept_new_entries = MR_AT_JsonGetBool(response, "can_accept_new_entries");
   g_can_manage_open_positions = MR_AT_JsonGetBool(response, "can_manage_open_positions");

   int interval = MR_AT_JsonGetInt(response, "heartbeat_interval_sec");
   if(interval >= 5 && interval <= 300)
      g_heartbeat_interval_sec = interval;

   int pending_instr = MR_AT_JsonGetInt(response, "pending_instructions");
   MR_AT_LogInfo("Heartbeat", "ok nextIn=" + IntegerToString(g_heartbeat_interval_sec) + "s");
   g_lastHeartbeatSentAt = TimeCurrent();
   return true;
  }
