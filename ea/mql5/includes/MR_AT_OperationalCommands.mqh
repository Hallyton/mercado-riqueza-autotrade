#ifndef MR_AT_OPERATIONAL_COMMANDS_MQH
#define MR_AT_OPERATIONAL_COMMANDS_MQH
//+------------------------------------------------------------------+
//| MR_AT_OperationalCommands.mqh — comandos operacionais remotos     |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Equity.mqh"
#include "MR_AT_Orders.mqh"
#include "MR_AT_Position.mqh"
#include "MR_AT_DailyRisk.mqh"
#include "MR_FiboD1_Config.mqh"

extern string g_license_id;
extern string g_device_id;
extern bool   g_debug_mode;
extern bool   g_autonomous_strategy_site_enabled;

bool   g_admin_paused = false;
string g_admin_pause_reason = "";

static datetime g_lastCommandsPollAt = 0;
static datetime g_lastOperationSnapshotSentAt = 0;

#define MR_AT_COMMANDS_POLL_INTERVAL_SEC 15
#define MR_AT_OPERATION_SNAPSHOT_INTERVAL_SEC 30

//+------------------------------------------------------------------+
void MR_AT_ApplyOperationControlFromConfig(const string json)
  {
   int p = MR_AT_JsonFindKey(json, "operation_control");
   if(p < 0)
      return;

   string obj = "";
   if(!MR_AT_JsonExtractObject(json, "operation_control", obj))
      return;

   g_admin_paused = MR_AT_JsonGetBool(obj, "paused");
   g_admin_pause_reason = MR_AT_JsonGetString(obj, "reason");
  }

//+------------------------------------------------------------------+
bool MR_AT_IsAdminPaused()
  {
   return g_admin_paused;
  }

//+------------------------------------------------------------------+
int MR_AT_OperationalMagic()
  {
   return (int)MR_AT_EA_MAGIC;
  }

//+------------------------------------------------------------------+
int MR_AT_CancelPendingOrdersForSymbol(const string symbol, const int magic)
  {
   if(g_debug_mode)
     {
      MR_AT_LogInfo("OpCmd", "DEBUG — simulando cancelamento de pendentes");
      return OrdersTotal();
     }

   int cancelled = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !OrderSelect(ticket))
         continue;
      if(OrderGetString(ORDER_SYMBOL) != symbol)
         continue;
      if((int)OrderGetInteger(ORDER_MAGIC) != magic)
         continue;

      MqlTradeRequest req = {};
      MqlTradeResult res = {};
      req.action = TRADE_ACTION_REMOVE;
      req.order = ticket;
      if(OrderSend(req, res))
         cancelled++;
     }
   return cancelled;
  }

//+------------------------------------------------------------------+
int MR_AT_ClosePositionsForSymbol(const string symbol, const int magic)
  {
   if(g_debug_mode)
     {
      MR_AT_LogInfo("OpCmd", "DEBUG — simulando fechamento de posições");
      return PositionsTotal();
     }

   int closed = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic)
         continue;

      MqlTradeRequest req = {};
      MqlTradeResult res = {};
      req.action = TRADE_ACTION_DEAL;
      req.position = ticket;
      req.symbol = symbol;
      req.volume = PositionGetDouble(POSITION_VOLUME);
      req.deviation = 20;
      req.magic = magic;
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
        {
         req.type = ORDER_TYPE_SELL;
         req.price = SymbolInfoDouble(symbol, SYMBOL_BID);
        }
      else
        {
         req.type = ORDER_TYPE_BUY;
         req.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
        }
      if(OrderSend(req, res))
         closed++;
     }
   return closed;
  }

//+------------------------------------------------------------------+
bool MR_AT_PostCommandAck(const string command_id, string &err)
  {
   string body = "{";
   body += "\"status\":\"ACKED\",";
   body += "\"ea_time\":" + MR_AT_JsonQuote(TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) + ",";
   body += "\"message\":" + MR_AT_JsonQuote("Comando recebido");
   body += "}";

   string response = "";
   int status = 0;
   string path = "/api/v1/ea/commands/" + command_id + "/ack";
   if(!MR_AT_ApiPostAuth(path, body, response, status))
     {
      err = "ack request failed";
      return false;
     }
   if(status < 200 || status >= 300)
     {
      err = "ack HTTP " + IntegerToString(status);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_PostCommandResult(
   const string command_id,
   const string result_status,
   const string result_code,
   const string result_message,
   const string details_json,
   string &err
)
  {
   string body = "{";
   body += "\"status\":" + MR_AT_JsonQuote(result_status) + ",";
   body += "\"result_code\":" + MR_AT_JsonQuote(result_code) + ",";
   body += "\"result_message\":" + MR_AT_JsonQuote(result_message);
   if(StringLen(details_json) > 0)
      body += ",\"details\":" + details_json;
   body += "}";

   string response = "";
   int status = 0;
   string path = "/api/v1/ea/commands/" + command_id + "/result";
   if(!MR_AT_ApiPostAuth(path, body, response, status))
     {
      err = "result request failed";
      return false;
     }
   if(status < 200 || status >= 300)
     {
      err = "result HTTP " + IntegerToString(status);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ExecuteOperationalCommand(
   const string command_id,
   const string command_type,
   string &result_code,
   string &result_message,
   string &details_json
)
  {
   result_code = "OK";
   result_message = "Comando executado";
   details_json = "{}";
   const string symbol = _Symbol;
   const int magic = MR_AT_OperationalMagic();

   if(command_type == "PAUSE_NEW_ENTRIES")
     {
      g_admin_paused = true;
      result_message = "Novas entradas pausadas pelo admin";
      return true;
     }

   if(command_type == "RESUME_TRADING")
     {
      g_admin_paused = false;
      g_admin_pause_reason = "";
      result_message = "Operações retomadas";
      return true;
     }

   if(command_type == "CANCEL_PENDING_ORDERS")
     {
      int cancelled = MR_AT_CancelPendingOrdersForSymbol(symbol, magic);
      details_json = "{\"cancelled_orders\":" + IntegerToString(cancelled) + "}";
      result_message = "Ordens pendentes canceladas: " + IntegerToString(cancelled);
      return true;
     }

   if(command_type == "CLOSE_OPEN_POSITION" || command_type == "CLOSE_ALL_POSITIONS")
     {
      int closed = MR_AT_ClosePositionsForSymbol(symbol, magic);
      if(closed == 0 && !g_debug_mode)
        {
         result_code = "NO_OPEN_POSITION";
         result_message = "Nenhuma posição aberta encontrada";
         return false;
        }
      details_json = "{\"closed_positions\":" + IntegerToString(closed) + "}";
      result_message = "Posições encerradas: " + IntegerToString(closed);
      return true;
     }

   if(command_type == "FLATTEN_AND_PAUSE")
     {
      g_admin_paused = true;
      int cancelled = MR_AT_CancelPendingOrdersForSymbol(symbol, magic);
      int closed = MR_AT_ClosePositionsForSymbol(symbol, magic);
      details_json = "{\"cancelled_orders\":" + IntegerToString(cancelled) +
                     ",\"closed_positions\":" + IntegerToString(closed) + "}";
      result_message = "Flatten concluído e pausa ativada";
      return true;
     }

   if(command_type == "REFRESH_STATUS")
     {
      MR_AT_LogInfo("OpCmd", "REFRESH_STATUS: sending operation snapshot and daily risk now");
      const bool snapshotOk = MR_AT_SendOperationSnapshot(true);
      const bool dailyRiskOk = MR_AT_ReportDailyRisk(true);
      details_json = "{";
      details_json += "\"snapshot_sent\":" + (snapshotOk ? "true" : "false") + ",";
      details_json += "\"daily_risk_sent\":" + (dailyRiskOk ? "true" : "false") + ",";
      details_json += "\"daily_risk_status\":" + MR_AT_JsonQuote(g_lastDailyRiskStatus) + ",";
      details_json += "\"daily_risk_state_id\":" + MR_AT_JsonQuote(g_lastDailyRiskStateId) + ",";
      details_json += "\"daily_risk_error_code\":" + MR_AT_JsonQuote(g_lastDailyRiskErrorCode);
      details_json += "}";
      if(!snapshotOk)
        {
         result_code = "SNAPSHOT_FAILED";
         result_message = "Snapshot operacional falhou";
         return false;
        }
      result_message = dailyRiskOk
         ? "Snapshot e DailyRisk enviados"
         : "Snapshot enviado; DailyRisk falhou";
      return true;
     }

   result_code = "UNKNOWN_COMMAND";
   result_message = "Tipo de comando desconhecido";
   return false;
  }

//+------------------------------------------------------------------+
double MR_AT_CalcRealizedPnlSince(datetime from_time, const string symbol)
  {
   double realized = 0;
   if(!HistorySelect(from_time, TimeCurrent()))
      return 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0)
         continue;
      if(HistoryDealGetString(ticket, DEAL_SYMBOL) != symbol)
         continue;
      if((int)HistoryDealGetInteger(ticket, DEAL_MAGIC) != MR_AT_OperationalMagic())
         continue;
      realized += HistoryDealGetDouble(ticket, DEAL_PROFIT);
     }
   return realized;
  }

//+------------------------------------------------------------------+
bool MR_AT_SendOperationSnapshot(const bool force = false)
  {
   if(StringLen(g_license_id) < 4)
      return false;
   if(!force && g_lastOperationSnapshotSentAt > 0 &&
      TimeCurrent() - g_lastOperationSnapshotSentAt < MR_AT_OPERATION_SNAPSHOT_INTERVAL_SEC)
      return true;

   const string symbol = _Symbol;
   const int magic = MR_AT_OperationalMagic();
   double open_pnl = 0;
   double pos_volume = 0;
   double pos_avg = 0;
   double pos_current = 0;
   string pos_side = "";
   bool has_position = false;

   for(int p = PositionsTotal() - 1; p >= 0; p--)
     {
      ulong t = PositionGetTicket(p);
      if(t == 0 || !PositionSelectByTicket(t))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic)
         continue;
      has_position = true;
      pos_volume = PositionGetDouble(POSITION_VOLUME);
      pos_avg = PositionGetDouble(POSITION_PRICE_OPEN);
      pos_current = PositionGetDouble(POSITION_PRICE_CURRENT);
      open_pnl += PositionGetDouble(POSITION_PROFIT);
      pos_side = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL");
      break;
     }

   datetime day_start = MR_AT_DayStart(TimeCurrent());
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.day = 1;
   datetime month_start = StructToTime(dt);

   double realized_day = MR_AT_CalcRealizedPnlSince(day_start, symbol);
   double realized_month = MR_AT_CalcRealizedPnlSince(month_start, symbol);

   string pending = MR_AT_BuildPendingOrdersJson();

   string body = "{";
   body += "\"license_id\":" + MR_AT_JsonQuote(g_license_id) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"symbol\":" + MR_AT_JsonQuote(symbol) + ",";
   body += "\"strategy_code\":" + MR_AT_JsonQuote("MR_FIBO_D1_GUARD") + ",";
   body += "\"magic_number\":" + IntegerToString(magic) + ",";
   body += "\"trade_mode\":" + MR_AT_JsonQuote(MR_AT_GetTradeMode()) + ",";
   body += "\"ea_version\":" + MR_AT_JsonQuote(MR_AT_EA_VERSION) + ",";
   body += "\"terminal_connected\":" + (TerminalInfoInteger(TERMINAL_CONNECTED) ? "true" : "false") + ",";
   body += "\"auto_trading_allowed\":" + (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ? "true" : "false") + ",";
   body += "\"real_orders_enabled\":" + (g_debug_mode ? "false" : "true") + ",";
   body += "\"autonomous_strategy_enabled\":" + (g_autonomous_strategy_site_enabled ? "true" : "false") + ",";
   body += "\"paused_by_admin\":" + (g_admin_paused ? "true" : "false") + ",";
   body += "\"has_open_position\":" + (has_position ? "true" : "false") + ",";
   body += "\"position_side\":" + MR_AT_JsonQuote(pos_side) + ",";
   body += "\"position_volume\":" + DoubleToString(pos_volume, 2) + ",";
   body += "\"position_average_price\":" + DoubleToString(pos_avg, _Digits) + ",";
   body += "\"position_current_price\":" + DoubleToString(pos_current, _Digits) + ",";
   body += "\"position_open_pnl\":" + DoubleToString(open_pnl, 2) + ",";
   body += "\"pending_orders\":" + pending + ",";
   body += "\"realized_pnl_day\":" + DoubleToString(realized_day, 2) + ",";
   body += "\"realized_pnl_month\":" + DoubleToString(realized_month, 2) + ",";
   body += "\"open_pnl\":" + DoubleToString(open_pnl, 2) + ",";
   body += "\"last_tick_time\":" + MR_AT_JsonQuote(TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)) + ",";
   body += "\"last_daily_risk_sent_at\":" + MR_AT_JsonQuote(
      g_lastDailyRiskSentAt > 0
         ? TimeToString(g_lastDailyRiskSentAt, TIME_DATE|TIME_SECONDS)
         : ""
   ) + ",";
   body += "\"last_daily_risk_status\":" + MR_AT_JsonQuote(g_lastDailyRiskStatus) + ",";
   body += "\"last_daily_risk_state_id\":" + MR_AT_JsonQuote(g_lastDailyRiskStateId) + ",";
   body += "\"last_daily_risk_error_code\":" + MR_AT_JsonQuote(g_lastDailyRiskErrorCode) + ",";
   body += "\"last_daily_risk_error_message\":" + MR_AT_JsonQuote(g_lastDailyRiskErrorMessage);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/operation-snapshot", body, response, status))
      return false;
   if(status >= 200 && status < 300)
     {
      g_lastOperationSnapshotSentAt = TimeCurrent();
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
void MR_AT_PollOperationalCommands()
  {
   if(StringLen(g_license_id) < 4)
      return;
   if(TimeCurrent() - g_lastCommandsPollAt < MR_AT_COMMANDS_POLL_INTERVAL_SEC)
      return;

   string response = "";
   int status = 0;
   if(!MR_AT_ApiGetAuth("/api/v1/ea/commands", response, status))
      return;
   if(status < 200 || status >= 300)
      return;

   g_lastCommandsPollAt = TimeCurrent();

   int idx = 0;
   while(true)
     {
      string cmd_obj = "";
      if(!MR_AT_JsonGetArrayObject(response, "commands", idx, cmd_obj))
         break;

      string command_id = MR_AT_JsonGetString(cmd_obj, "command_id");
      string command_type = MR_AT_JsonGetString(cmd_obj, "command_type");
      if(StringLen(command_id) == 0 || StringLen(command_type) == 0)
        {
         idx++;
         continue;
        }

      string ack_err = "";
      if(!MR_AT_PostCommandAck(command_id, ack_err))
        {
         MR_AT_LogError("OpCmd", "ACK falhou " + command_id + " " + ack_err);
         idx++;
         continue;
        }

      string result_code = "OK";
      string result_message = "";
      string details_json = "{}";
      bool ok = MR_AT_ExecuteOperationalCommand(
         command_id,
         command_type,
         result_code,
         result_message,
         details_json
      );

      string result_err = "";
      string final_status = ok ? "EXECUTED" : "FAILED";
      if(!MR_AT_PostCommandResult(
            command_id,
            final_status,
            result_code,
            result_message,
            details_json,
            result_err
         ))
        {
         MR_AT_LogError("OpCmd", "RESULT falhou " + command_id + " " + result_err);
        }
      else
        {
         MR_AT_LogInfo("OpCmd", command_type + " " + final_status + " " + result_message);
        }

      idx++;
     }
  }

//+------------------------------------------------------------------+
void MR_AT_OperationalCommandsOnTimer()
  {
   MR_AT_PollOperationalCommands();
   MR_AT_SendOperationSnapshot(false);
  }

//+------------------------------------------------------------------+
bool MR_AT_JsonExtractObject(const string json, const string key, string &obj_out)
  {
   obj_out = "";
   int p = MR_AT_JsonFindKey(json, key);
   if(p < 0)
      return false;
   int colon = StringFind(json, ":", p);
   if(colon < 0)
      return false;
   int start = colon + 1;
   while(start < StringLen(json))
     {
      ushort ch = StringGetCharacter(json, start);
      if(ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t')
        {
         start++;
         continue;
        }
      if(ch != '{')
         return false;
      break;
     }

   int depth = 0;
   int len = StringLen(json);
   for(int i = start; i < len; i++)
     {
      ushort ch = StringGetCharacter(json, i);
      if(ch == '{')
         depth++;
      else if(ch == '}')
        {
         depth--;
         if(depth == 0)
           {
            obj_out = StringSubstr(json, start, i - start + 1);
            return true;
           }
        }
     }
   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_JsonGetArrayObject(const string json, const string key, const int index, string &obj_out)
  {
   obj_out = "";
   int p = MR_AT_JsonFindKey(json, key);
   if(p < 0)
      return false;
   int bracket = StringFind(json, "[", p);
   if(bracket < 0)
      return false;

   int depth = 0;
   int current = -1;
   int len = StringLen(json);
   for(int i = bracket + 1; i < len; i++)
     {
      ushort ch = StringGetCharacter(json, i);
      if(ch == '{')
        {
         if(depth == 0)
            current++;
         depth++;
         if(current == index && depth == 1)
           {
            int start = i;
            for(int j = i; j < len; j++)
              {
               ushort c2 = StringGetCharacter(json, j);
               if(c2 == '{')
                  depth++;
               else if(c2 == '}')
                 {
                  depth--;
                  if(depth == 0)
                    {
                     obj_out = StringSubstr(json, start, j - start + 1);
                     return true;
                    }
                 }
              }
            return false;
           }
        }
      else if(ch == '}')
        {
         if(depth > 0)
            depth--;
        }
      else if(ch == ']' && depth == 0)
         return false;
     }
   return false;
  }

//+------------------------------------------------------------------+
datetime MR_AT_DayStart(datetime when)
  {
   MqlDateTime dt;
   TimeToStruct(when, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
  }

//+------------------------------------------------------------------+
#endif
