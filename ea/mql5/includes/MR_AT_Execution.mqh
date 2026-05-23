//+------------------------------------------------------------------+
//| MR_AT_Execution.mqh — execução de instruções e reporte            |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_Error.mqh"

extern bool g_debug_mode;
extern bool g_halt_all_trading;
extern bool g_halt_new_entries;
extern bool g_can_accept_new_entries;
extern bool g_can_manage_open_positions;

//+------------------------------------------------------------------+
bool MR_AT_SymbolReady(const string symbol)
  {
   if(!SymbolInfoInteger(symbol, SYMBOL_EXIST))
     {
      if(!SymbolSelect(symbol, true))
         return false;
     }
   return SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_DISABLED;
  }

//+------------------------------------------------------------------+
double MR_AT_NormalizeVolume(const string symbol, const double quantity)
  {
   double min_vol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double max_vol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0)
      step = min_vol;
   double vol = MathMax(min_vol, quantity);
   vol = MathMin(max_vol, vol);
   vol = MathFloor(vol / step) * step;
   return NormalizeDouble(vol, 2);
  }

//+------------------------------------------------------------------+
bool MR_AT_CanExecuteInstruction(const MRInstruction &instr)
  {
   if(g_halt_all_trading)
      return false;
   if(instr.purpose == "ENTRY" && !g_can_accept_new_entries)
      return false;
   if((instr.purpose == "EXIT" || instr.purpose == "ADJUSTMENT") && !g_can_manage_open_positions)
      return false;
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportExecution(
   const string instruction_id,
   const string status,
   const string broker_ticket = "",
   const double fill_price = 0.0,
   const double fill_quantity = 0.0,
   const string error_code = "",
   const string error_message = ""
)
  {
   string body = "{";
   body += "\"instruction_id\":" + MR_AT_JsonQuote(instruction_id) + ",";
   body += "\"status\":" + MR_AT_JsonQuote(status) + ",";
   if(StringLen(broker_ticket) > 0)
      body += "\"broker_ticket\":" + MR_AT_JsonQuote(broker_ticket) + ",";
   if(fill_price > 0)
      body += "\"fill_price\":" + DoubleToString(fill_price, _Digits) + ",";
   if(fill_quantity > 0)
      body += "\"fill_quantity\":" + DoubleToString(fill_quantity, 2) + ",";
   if(StringLen(error_code) > 0)
      body += "\"error_code\":" + MR_AT_JsonQuote(error_code) + ",";
   if(StringLen(error_message) > 0)
      body += "\"error_message\":" + MR_AT_JsonQuote(error_message) + ",";
   body += "\"executed_at\":" + MR_AT_JsonQuote(MR_AT_FormatExecutedAtIsoUtc());
   body += "}";

   string response = "";
   int http = 0;
   MR_AT_LogInfo("Execution", "POST /api/v1/ea/executions payload=" + body);

   bool sent = MR_AT_ApiPost("/api/v1/ea/executions", body, true, response, http);
   if(!sent || http < 200 || http >= 300)
     {
      MR_AT_LogError("Execution",
         "POST /api/v1/ea/executions falhou HTTP=" + IntegerToString(http) +
         " response=" + response);
      return false;
     }

   MR_AT_LogInfo("Execution",
      "POST /api/v1/ea/executions OK HTTP=" + IntegerToString(http) +
      " response=" + response);
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportIgnored(const string instruction_id, const string reason)
  {
   string body = "{";
   body += "\"instruction_id\":" + MR_AT_JsonQuote(instruction_id) + ",";
   body += "\"reason\":" + MR_AT_JsonQuote(reason);
   body += "}";

   string response = "";
   int http = 0;
   return MR_AT_ApiPost("/api/v1/ea/instructions/ignore", body, true, response, http) && http >= 200 && http < 300;
  }

//+------------------------------------------------------------------+
bool MR_AT_ClosePositionBySymbol(const string symbol, const double volume_req, ulong &ticket, string &err_msg)
  {
   ticket = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong pos_ticket = PositionGetTicket(i);
      if(pos_ticket == 0 || !PositionSelectByTicket(pos_ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if(PositionGetInteger(POSITION_MAGIC) != MR_AT_EA_MAGIC)
         continue;

      double vol = PositionGetDouble(POSITION_VOLUME);
      if(volume_req > 0 && volume_req < vol)
         vol = volume_req;

      ENUM_POSITION_TYPE ptype = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      ENUM_ORDER_TYPE close_type = (ptype == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;

      MqlTradeRequest request = {};
      MqlTradeResult  result = {};
      request.action   = TRADE_ACTION_DEAL;
      request.position = pos_ticket;
      request.symbol   = symbol;
      request.volume   = vol;
      request.type     = close_type;
      request.price    = (close_type == ORDER_TYPE_SELL) ?
                         SymbolInfoDouble(symbol, SYMBOL_BID) :
                         SymbolInfoDouble(symbol, SYMBOL_ASK);
      request.deviation = 20;
      request.magic    = MR_AT_EA_MAGIC;
      request.comment  = "MR_AT:EXIT";

      if(g_debug_mode)
        {
         MR_AT_LogInfo("Execution", "DEBUG_MODE — fechamento NÃO enviado: " + symbol);
         return true;
        }

      if(!OrderSend(request, result))
        {
         err_msg = "Fechamento falhou retcode=" + IntegerToString((int)result.retcode);
         return false;
        }
      ticket = result.deal;
      return true;
     }
   err_msg = "Nenhuma posição aberta para " + symbol;
   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_ExecuteMarketOrder(const MRInstruction &instr, ulong &ticket, string &err_msg)
  {
   ticket = 0;
   err_msg = "";

   if(!MR_AT_SymbolReady(instr.symbol))
     {
      err_msg = "Símbolo indisponível: " + instr.symbol;
      return false;
     }

   if(!MR_AT_CanExecuteInstruction(instr))
     {
      err_msg = "Execução bloqueada pelo servidor (licença/assinatura)";
      return false;
     }

   if(instr.purpose == "EXIT")
      return MR_AT_ClosePositionBySymbol(instr.symbol, instr.quantity, ticket, err_msg);

   double volume = MR_AT_NormalizeVolume(instr.symbol, instr.quantity);
   if(volume <= 0)
     {
      err_msg = "Volume inválido";
      return false;
     }

   ENUM_ORDER_TYPE order_type = (instr.side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double price = (order_type == ORDER_TYPE_BUY) ?
                  SymbolInfoDouble(instr.symbol, SYMBOL_ASK) :
                  SymbolInfoDouble(instr.symbol, SYMBOL_BID);

   MqlTradeRequest request = {};
   MqlTradeResult  result = {};

   request.action       = TRADE_ACTION_DEAL;
   request.symbol       = instr.symbol;
   request.volume       = volume;
   request.type         = order_type;
   request.price        = price;
   request.deviation    = 20;
   request.magic        = MR_AT_EA_MAGIC;
   request.comment      = "MR_AT:" + instr.instruction_id;
   request.type_filling = ORDER_FILLING_IOC;

   if(instr.stop_loss > 0)
      request.sl = NormalizeDouble(instr.stop_loss, (int)SymbolInfoInteger(instr.symbol, SYMBOL_DIGITS));
   if(instr.take_profit > 0)
      request.tp = NormalizeDouble(instr.take_profit, (int)SymbolInfoInteger(instr.symbol, SYMBOL_DIGITS));

   if(g_debug_mode)
     {
      MR_AT_LogInfo("Execution",
         "DEBUG_MODE — ordem NÃO enviada: " + instr.side + " " + instr.symbol +
         " vol=" + DoubleToString(volume, 2) + " id=" + instr.instruction_id);
      ticket = 0;
      return true;
     }

   if(!OrderSend(request, result))
     {
      err_msg = "OrderSend falhou retcode=" + IntegerToString((int)result.retcode) +
                " " + result.comment;
      return false;
     }

   if(result.retcode != TRADE_RETCODE_DONE && result.retcode != TRADE_RETCODE_PLACED)
     {
      err_msg = "Retcode=" + IntegerToString((int)result.retcode) + " " + result.comment;
      return false;
     }

   ticket = result.order;
   if(ticket == 0)
      ticket = result.deal;
   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_ProcessInstruction(const MRInstruction &instr)
  {
   MR_AT_LogInfo("Execution", "Processando " + instr.instruction_id + " " +
                 instr.purpose + " " + instr.side + " " + instr.symbol +
                 " qty=" + DoubleToString(instr.quantity, 8));

   ulong ticket = 0;
   string err = "";
   bool ok = MR_AT_ExecuteMarketOrder(instr, ticket, err);

   if(g_debug_mode)
     {
      double sim_price = (instr.side == "BUY") ?
                         SymbolInfoDouble(instr.symbol, SYMBOL_ASK) :
                         SymbolInfoDouble(instr.symbol, SYMBOL_BID);
      if(sim_price <= 0)
         sim_price = SymbolInfoDouble(instr.symbol, SYMBOL_LAST);
      if(MR_AT_IsVerboseLog())
         MR_AT_LogDebug("Execution",
            "DEBUG_MODE — POST /executions FILLED id=" + instr.instruction_id);
      if(!MR_AT_ReportExecution(instr.instruction_id, "FILLED", "DEBUG",
                            sim_price, instr.quantity))
         MR_AT_LogError("Execution",
            "DEBUG_MODE — falha ao reportar FILLED id=" + instr.instruction_id);
      return;
     }

   if(ok && ticket > 0)
     {
      double fill_price = 0;
      if(PositionSelect(instr.symbol))
         fill_price = PositionGetDouble(POSITION_PRICE_OPEN);
      MR_AT_ReportExecution(instr.instruction_id, "FILLED", IntegerToString((long)ticket),
                            fill_price, instr.quantity);
      MR_AT_LogInfo("Execution", "Executada ticket=" + IntegerToString((long)ticket));
     }
   else
     {
      MR_AT_ReportExecution(instr.instruction_id, "REJECTED", "", 0, 0,
                            "EXECUTION_FAILED", err);
      MR_AT_ReportError("EXECUTION_FAILED", err);
      MR_AT_LogError("Execution", err);
     }
  }
