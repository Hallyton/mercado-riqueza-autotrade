//+------------------------------------------------------------------+
//| MR_AT_AutonomousStrategy.mqh — preflight + execução autorizada   |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Execution.mqh"
#include "MR_AT_ManagementPlan.mqh"
#include "MR_AT_RealTrading.mqh"
#include "MR_Strategy_FiboD1_Guard.mqh"

extern string g_license_id;
extern string g_device_id;
extern bool   g_can_accept_new_entries;
extern bool   g_autonomous_strategy_site_enabled;
extern bool   InpEnableAutonomousStrategy;
extern string InpAutonomousStrategyCode;

static datetime g_last_daily_risk_report = 0;
static datetime g_last_autonomous_preflight_block_log = 0;

//+------------------------------------------------------------------+
string MR_AT_TradeDateIso()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportDailyRisk()
  {
   if(StringLen(g_license_id) < 4)
      return false;
   if(TimeCurrent() - g_last_daily_risk_report < 60)
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
      return false;
   if(status >= 200 && status < 300)
     {
      g_last_daily_risk_report = TimeCurrent();
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
string MR_AT_BuildPlannedManagementPlanJson(const MR_StrategySignal &sig)
  {
   string body = "{";
   body += "\"version\":1,";
   body += "\"initial_stop_loss\":" + DoubleToString(sig.initialStopLoss, _Digits) + ",";
   body += "\"takes\":[";
   body += "{\"label\":\"T1\",\"enabled\":true,\"price\":" + DoubleToString(sig.take1Price, _Digits) +
           ",\"quantity\":" + IntegerToString((int)sig.take1Quantity) + "},";
   body += "{\"label\":\"T2\",\"enabled\":" + (sig.take2Quantity > 0 ? "true" : "false") +
           ",\"price\":" + (sig.take2Quantity > 0 ? DoubleToString(sig.take2Price, _Digits) : "null") +
           ",\"quantity\":" + IntegerToString((int)sig.take2Quantity) + "}";
   body += "],";
   body += "\"break_even\":{\"enabled\":" + (sig.breakEvenEnabled ? "true" : "false") +
           ",\"trigger\":" + MR_AT_JsonQuote(sig.breakEvenTrigger) +
           ",\"trigger_price\":null,\"offset\":" + DoubleToString(sig.breakEvenOffset, _Digits) + "},";
   body += "\"trailing_stop\":{\"enabled\":" + (sig.trailingEnabled ? "true" : "false") +
           ",\"trigger_price\":" + DoubleToString(sig.trailingTriggerPrice, _Digits) +
           ",\"distance\":" + DoubleToString(sig.trailingDistance, _Digits) +
           ",\"step\":" + DoubleToString(sig.trailingStep, _Digits) + "}";
   body += "}";
   return body;
  }

//+------------------------------------------------------------------+
bool MR_AT_AutonomousPreflight(const MR_StrategySignal &sig, MRInstruction &instr, string &block_reason)
  {
   block_reason = "";
   int magic = (int)MR_AT_EA_MAGIC;
   string plan = MR_AT_BuildPlannedManagementPlanJson(sig);

   string body = "{";
   body += "\"strategy_code\":" + MR_AT_JsonQuote(sig.strategyName) + ",";
   body += "\"strategy_version\":" + MR_AT_JsonQuote(sig.strategyVersion) + ",";
   body += "\"license_id\":" + MR_AT_JsonQuote(g_license_id) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"symbol\":" + MR_AT_JsonQuote(_Symbol) + ",";
   body += "\"trade_mode\":" + MR_AT_JsonQuote(MR_AT_GetTradeMode()) + ",";
   body += "\"magic_number\":" + IntegerToString(magic) + ",";
   body += "\"side\":" + MR_AT_JsonQuote(sig.side) + ",";
   body += "\"order_type\":" + MR_AT_JsonQuote(sig.orderType) + ",";
   body += "\"order_price\":null,";
   body += "\"requested_contracts\":" + IntegerToString((int)MR_FIBO_LOTE_TOTAL) + ",";
   body += "\"planned_management_plan\":" + plan + ",";
   body += "\"signal_reason\":" + MR_AT_JsonQuote(sig.reasonCode);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/autonomous-strategy/preflight", body, response, status))
     {
      block_reason = "AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED";
      return false;
     }

   if(status < 200 || status >= 300)
     {
      block_reason = "AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED";
      return false;
     }

   bool allowed = MR_AT_JsonGetBool(response, "allowed");
   if(!allowed)
     {
      block_reason = MR_AT_JsonGetString(response, "reason_code");
      if(StringLen(block_reason) == 0)
         block_reason = MR_AT_JsonGetString(response, "decision");
      return false;
     }

   string instruction_id = MR_AT_JsonGetString(response, "instruction_id");
   if(StringLen(instruction_id) == 0)
      instruction_id = MR_AT_JsonGetString(response, "strategy_execution_id");

   instr.instruction_id = instruction_id;
   instr.purpose = "ENTRY";
   instr.symbol = _Symbol;
   instr.side = sig.side;
   instr.order_type = sig.orderType;
   instr.order_price = 0;
   instr.quantity = MR_FIBO_LOTE_TOTAL;
   instr.stop_loss = sig.initialStopLoss;
   instr.take_profit = sig.take1Price;
   instr.magic_number = magic;
   instr.account_login = MR_AT_AccountLoginStr();
   instr.account_server = MR_AT_AccountServerStr();
   instr.trade_mode = MR_AT_GetTradeMode();
   instr.source = "AUTONOMOUS_STRATEGY";
   instr.protection_required = true;
   instr.requires_protection_confirmation = true;
   instr.requested_contracts = MR_FIBO_LOTE_TOTAL;
   instr.has_management_plan = true;
   instr.mp_initial_sl = sig.initialStopLoss;
   instr.mp_t1_enabled = true;
   instr.mp_t1_price = sig.take1Price;
   instr.mp_t1_qty = (int)sig.take1Quantity;
   instr.mp_t2_enabled = (sig.take2Quantity > 0);
   instr.mp_t2_price = sig.take2Price;
   instr.mp_t2_qty = (int)sig.take2Quantity;
   instr.mp_be_enabled = sig.breakEvenEnabled;
   instr.mp_be_trigger = sig.breakEvenTrigger;
   instr.mp_be_offset = sig.breakEvenOffset;
   instr.mp_ts_enabled = sig.trailingEnabled;
   instr.mp_ts_trigger_price = sig.trailingTriggerPrice;
   instr.mp_ts_distance = sig.trailingDistance;
   instr.mp_ts_step = sig.trailingStep;
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
   if(!g_can_accept_new_entries)
      return;

   MR_AT_ReportDailyRisk();

   int magic = (int)MR_AT_EA_MAGIC;
   MR_StrategySignal sig;
   if(!MR_Fibo_EvaluateSignal(magic, sig))
      return;

   MRInstruction instr;
   string block = "";
   if(!MR_AT_AutonomousPreflight(sig, instr, block))
     {
      if(TimeCurrent() - g_last_autonomous_preflight_block_log > 120)
        {
         MR_AT_LogInfo("Autonomous", "Preflight bloqueado: " + block);
         g_last_autonomous_preflight_block_log = TimeCurrent();
        }
      return;
     }

   MR_AT_LogInfo("Autonomous", "Preflight OK — executando instruction " + instr.instruction_id);
   MR_AT_ProcessInstruction(instr);
  }
