//+------------------------------------------------------------------+
//| MR_AT_ManagementPlan.mqh — gestão REAL_MANUAL (T1/T2/BE/TS)       |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_RealTrading.mqh"

extern bool g_debug_mode;

//+------------------------------------------------------------------+
double MR_AT_MgmtNormalizeVolume(const string symbol, const double quantity)
  {
   double min_vol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double max_vol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0) step = min_vol;
   double vol = MathMax(min_vol, quantity);
   vol = MathMin(max_vol, vol);
   vol = MathFloor(vol / step) * step;
   return NormalizeDouble(vol, 2);
  }

//+------------------------------------------------------------------+
bool MR_AT_ParseManagementPlanBlock(const string mp_json, MRInstruction &instr)
  {
   instr.has_management_plan = false;
   if(StringLen(mp_json) < 2)
      return false;

   instr.mp_initial_sl = MR_AT_JsonGetDouble(mp_json, "initial_stop_loss");
   if(instr.mp_initial_sl <= 0)
      return false;

   int takes_pos = StringFind(mp_json, "\"takes\"");
   if(takes_pos >= 0)
     {
      string takes_section = StringSubstr(mp_json, takes_pos, MathMin(800, StringLen(mp_json) - takes_pos));
      instr.mp_t1_enabled = MR_AT_JsonGetBool(takes_section, "enabled", 0);
      instr.mp_t1_price = MR_AT_JsonGetDouble(takes_section, "price", 0);
      instr.mp_t1_qty = MR_AT_JsonGetInt(takes_section, "quantity", 0);

      int t2_pos = StringFind(takes_section, "\"T2\"");
      if(t2_pos < 0)
         t2_pos = StringFind(takes_section, "\"label\"", StringFind(takes_section, "}", 0));
      if(t2_pos >= 0)
        {
         string t2_section = StringSubstr(takes_section, t2_pos, MathMin(400, StringLen(takes_section) - t2_pos));
         instr.mp_t2_enabled = MR_AT_JsonGetBool(t2_section, "enabled", 0);
         instr.mp_t2_price = MR_AT_JsonGetDouble(t2_section, "price", 0);
         instr.mp_t2_qty = MR_AT_JsonGetInt(t2_section, "quantity", 0);
        }
     }

   int be_pos = StringFind(mp_json, "\"break_even\"");
   if(be_pos >= 0)
     {
      string be = StringSubstr(mp_json, be_pos, MathMin(400, StringLen(mp_json) - be_pos));
      instr.mp_be_enabled = MR_AT_JsonGetBool(be, "enabled");
      instr.mp_be_trigger = MR_AT_JsonGetString(be, "trigger");
      instr.mp_be_trigger_price = MR_AT_JsonGetDouble(be, "trigger_price");
      instr.mp_be_offset = MR_AT_JsonGetDouble(be, "offset");
     }

   int ts_pos = StringFind(mp_json, "\"trailing_stop\"");
   if(ts_pos >= 0)
     {
      string ts = StringSubstr(mp_json, ts_pos, MathMin(400, StringLen(mp_json) - ts_pos));
      instr.mp_ts_enabled = MR_AT_JsonGetBool(ts, "enabled");
      instr.mp_ts_trigger_price = MR_AT_JsonGetDouble(ts, "trigger_price");
      instr.mp_ts_distance = MR_AT_JsonGetDouble(ts, "distance");
      instr.mp_ts_step = MR_AT_JsonGetDouble(ts, "step");
     }

   instr.has_management_plan = true;
   if(instr.stop_loss <= 0)
      instr.stop_loss = instr.mp_initial_sl;
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportManagementEvent(
   const string instruction_id,
   const string event_code,
   const string detail = ""
)
  {
   string body = "{";
   body += "\"instruction_id\":" + MR_AT_JsonQuote(instruction_id) + ",";
   body += "\"event\":" + MR_AT_JsonQuote(event_code);
   if(StringLen(detail) > 0)
      body += ",\"detail\":" + MR_AT_JsonQuote(detail);
   body += "}";

   string response = "";
   int http = 0;
   return MR_AT_ApiPostAuth("/api/v1/ea/management-events", body, response, http)
          && http >= 200 && http < 300;
  }

//+------------------------------------------------------------------+
bool MR_AT_PlaceTakeOrder(
   const MRInstruction &instr,
   const double price,
   const double quantity,
   const string comment,
   string &err
)
  {
   err = "";
   ENUM_ORDER_TYPE order_type = (instr.side == "BUY") ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_BUY_LIMIT;
   int magic = MR_AT_ResolveInstructionMagic(instr);
   double volume = MR_AT_MgmtNormalizeVolume(instr.symbol, quantity);
   if(volume <= 0)
     {
      err = "Volume take inválido";
      return false;
     }

   MqlTradeRequest request = {};
   MqlTradeResult  result = {};
   request.action = TRADE_ACTION_PENDING;
   request.symbol = instr.symbol;
   request.volume = volume;
   request.type = order_type;
   request.price = NormalizeDouble(price, (int)SymbolInfoInteger(instr.symbol, SYMBOL_DIGITS));
   request.magic = magic;
   request.comment = comment;
   request.type_time = ORDER_TIME_GTC;

   if(g_debug_mode)
     {
      MR_AT_LogInfo("Management", "DEBUG_MODE — take NÃO enviado " + comment);
      return true;
     }

   if(!OrderSend(request, result))
     {
      err = "Take OrderSend retcode=" + IntegerToString((int)result.retcode);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_ApplyManagementPlanAfterEntry(const MRInstruction &instr)
  {
   if(!instr.has_management_plan)
      return;

   string err = "";
   if(instr.mp_t1_enabled && instr.mp_t1_price > 0 && instr.mp_t1_qty > 0)
     {
      if(MR_AT_PlaceTakeOrder(instr, instr.mp_t1_price, instr.mp_t1_qty, "MR_REAL_T1", err))
         MR_AT_ReportManagementEvent(instr.instruction_id, "TAKE1_ORDER_PLACED");
      else
         MR_AT_ReportManagementEvent(instr.instruction_id, "TAKE_ORDER_REJECTED", err);
     }

   if(instr.mp_t2_enabled && instr.mp_t2_price > 0 && instr.mp_t2_qty > 0)
     {
      if(MR_AT_PlaceTakeOrder(instr, instr.mp_t2_price, instr.mp_t2_qty, "MR_REAL_T2", err))
         MR_AT_ReportManagementEvent(instr.instruction_id, "TAKE2_ORDER_PLACED");
      else
         MR_AT_ReportManagementEvent(instr.instruction_id, "TAKE_ORDER_REJECTED", err);
     }

   if(instr.mp_be_enabled)
      MR_AT_ReportManagementEvent(instr.instruction_id, "BREAKEVEN_ARMED");
   if(instr.mp_ts_enabled)
      MR_AT_ReportManagementEvent(instr.instruction_id, "TRAILING_ARMED");
  }

//+------------------------------------------------------------------+
void MR_AT_ManagementOnTimer()
  {
   // Ciclo BE/TS: aplicado quando posição remanescente existir (fase operacional).
  }
