//+------------------------------------------------------------------+
//| MR_AT_RealTrading.mqh — snapshots PRE_MARKET / PRE_TRADE / POST_MARKET |
//| e proteção SL/TP (REAL)                                                |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Equity.mqh"
#include "MR_AT_Position.mqh"
#include "MR_AT_Orders.mqh"

extern bool g_debug_mode;

#define MR_AT_GV_PREMARKET_DATE   "MR_AT_PREMARKET_UTC_DATE"
#define MR_AT_GV_BLOCKED_MAGICS   "MR_AT_BLOCKED_MAGICS"

//+------------------------------------------------------------------+
bool MR_AT_InstructionIsReal(const MRInstruction &instr)
  {
   if(instr.trade_mode == "REAL")
      return true;
   return (MR_AT_GetTradeMode() == "REAL");
  }

//+------------------------------------------------------------------+
int MR_AT_ResolveInstructionMagic(const MRInstruction &instr)
  {
   if(instr.magic_number > 0)
      return instr.magic_number;
   return MR_AT_EA_MAGIC;
  }

//+------------------------------------------------------------------+
bool MR_AT_IsMagicBlocked(const int magic)
  {
   if(magic <= 0)
      return false;
   string list = "";
   if(GlobalVariableCheck(MR_AT_GV_BLOCKED_MAGICS))
      list = DoubleToString(GlobalVariableGet(MR_AT_GV_BLOCKED_MAGICS), 0);
   else
     {
      // armazenamos lista como string em arquivo seria melhor; usamos GV numérico apenas como flag simples
      // lista real: variável terminal string via comentário — fallback: checar magic único bloqueado
     }
   string token = IntegerToString(magic);
   string needle = "," + token + ",";
   string hay = "," + list + ",";
   if(StringFind(hay, needle) >= 0)
      return true;
   // flag por magic: MR_AT_BLOCK_910001
   string gv_name = "MR_AT_BLOCK_" + token;
   return GlobalVariableCheck(gv_name) && GlobalVariableGet(gv_name) > 0;
  }

//+------------------------------------------------------------------+
void MR_AT_BlockMagicNumber(const int magic)
  {
   if(magic <= 0)
      return;
   string gv_name = "MR_AT_BLOCK_" + IntegerToString(magic);
   GlobalVariableSet(gv_name, (double)TimeCurrent());
   MR_AT_LogError("RealTrading", "Magic bloqueado após falha de proteção: " + IntegerToString(magic));
  }

//+------------------------------------------------------------------+
int MR_AT_TodayUtcYyyymmdd()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   return dt.year * 10000 + dt.mon * 100 + dt.day;
  }

//+------------------------------------------------------------------+
bool MR_AT_PreMarketSentToday()
  {
   if(!GlobalVariableCheck(MR_AT_GV_PREMARKET_DATE))
      return false;
   int stored = (int)GlobalVariableGet(MR_AT_GV_PREMARKET_DATE);
   return stored == MR_AT_TodayUtcYyyymmdd();
  }

//+------------------------------------------------------------------+
void MR_AT_MarkPreMarketSent()
  {
   GlobalVariableSet(MR_AT_GV_PREMARKET_DATE, (double)MR_AT_TodayUtcYyyymmdd());
  }

//+------------------------------------------------------------------+
string MR_AT_BuildActiveMagicNumbersJson()
  {
   int magics[];
   ArrayResize(magics, 0);

   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      int m = (int)PositionGetInteger(POSITION_MAGIC);
      if(m <= 0)
         continue;
      bool found = false;
      for(int j = 0; j < ArraySize(magics); j++)
        {
         if(magics[j] == m) { found = true; break; }
        }
      if(!found)
        {
         int n = ArraySize(magics);
         ArrayResize(magics, n + 1);
         magics[n] = m;
        }
     }

   for(int i = 0; i < OrdersTotal(); i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !OrderSelect(ticket))
         continue;
      int m = (int)OrderGetInteger(ORDER_MAGIC);
      if(m <= 0)
         continue;
      bool found = false;
      for(int j = 0; j < ArraySize(magics); j++)
        {
         if(magics[j] == m) { found = true; break; }
        }
      if(!found)
        {
         int n = ArraySize(magics);
         ArrayResize(magics, n + 1);
         magics[n] = m;
        }
     }

   string json = "[";
   for(int k = 0; k < ArraySize(magics); k++)
     {
      if(k > 0)
         json += ",";
      json += IntegerToString(magics[k]);
     }
   json += "]";
   return json;
  }

//+------------------------------------------------------------------+
string MR_AT_BuildSnapshotOpenPositionsJson()
  {
   string json = "[";
   bool first = true;
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(!first)
         json += ",";
      first = false;
      json += "{";
      json += "\"symbol\":" + MR_AT_JsonQuote(PositionGetString(POSITION_SYMBOL)) + ",";
      json += "\"quantity\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
      json += "\"magic\":" + IntegerToString((int)PositionGetInteger(POSITION_MAGIC));
      json += "}";
     }
   json += "]";
   return json;
  }

//+------------------------------------------------------------------+
string MR_AT_BuildSnapshotPendingOrdersJson()
  {
   string json = "[";
   bool first = true;
   for(int i = 0; i < OrdersTotal(); i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !OrderSelect(ticket))
         continue;
      if(!first)
         json += ",";
      first = false;
      json += "{";
      json += "\"ticket\":" + MR_AT_JsonQuote(IntegerToString((long)ticket)) + ",";
      json += "\"symbol\":" + MR_AT_JsonQuote(OrderGetString(ORDER_SYMBOL)) + ",";
      json += "\"magic\":" + IntegerToString((int)OrderGetInteger(ORDER_MAGIC));
      json += "}";
     }
   json += "]";
   return json;
  }

//+------------------------------------------------------------------+
bool MR_AT_SendAccountSnapshot(const string snapshot_type)
  {
   string env = MR_AT_GetTradeMode();
   string body = "{";
   body += "\"snapshot_type\":" + MR_AT_JsonQuote(snapshot_type) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"environment\":" + MR_AT_JsonQuote(env) + ",";
   body += "\"currency\":" + MR_AT_JsonQuote(AccountInfoString(ACCOUNT_CURRENCY)) + ",";
   body += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   body += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   body += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   body += "\"free_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   body += "\"margin_level\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) + ",";
   body += "\"open_positions\":" + MR_AT_BuildSnapshotOpenPositionsJson() + ",";
   body += "\"pending_orders\":" + MR_AT_BuildSnapshotPendingOrdersJson() + ",";
   body += "\"active_magic_numbers\":" + MR_AT_BuildActiveMagicNumbersJson() + ",";
   body += "\"captured_at\":" + MR_AT_JsonQuote(MR_AT_FormatExecutedAtIsoUtc());
   body += "}";

   string response = "";
   int http = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/account-snapshots", body, response, http))
     {
      MR_AT_LogError("Snapshot", snapshot_type + " — falha de rede");
      return false;
     }
   if(http < 200 || http >= 300)
     {
      MR_AT_LogError("Snapshot", snapshot_type + " HTTP=" + IntegerToString(http) +
                     " " + MR_AT_JsonSummarize(response, 160));
      return false;
     }

   if(snapshot_type == "PRE_MARKET")
      MR_AT_MarkPreMarketSent();

   MR_AT_LogInfo("Snapshot", snapshot_type + " enviado OK");
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_EnsurePreMarketSnapshot()
  {
   if(MR_AT_GetTradeMode() != "REAL")
      return true;
   if(MR_AT_PreMarketSentToday())
      return true;
   return MR_AT_SendAccountSnapshot("PRE_MARKET");
  }

//+------------------------------------------------------------------+
bool MR_AT_EnsurePreTradeSnapshot()
  {
   return MR_AT_SendAccountSnapshot("PRE_TRADE");
  }

//+------------------------------------------------------------------+
bool MR_AT_ValidateInstructionContext(const MRInstruction &instr, string &err_msg)
  {
   err_msg = "";
   if(!MR_AT_InstructionIsReal(instr))
      return true;

   if(instr.magic_number <= 0)
     {
      err_msg = "magic_number ausente em instrução REAL";
      return false;
     }

   if(MR_AT_IsMagicBlocked(instr.magic_number))
     {
      err_msg = "magic_number bloqueado por falha de proteção anterior";
      return false;
     }

   if(StringLen(instr.account_login) > 0 &&
      instr.account_login != MR_AT_AccountLoginStr())
     {
      err_msg = "account_login divergente da conta MT5";
      return false;
     }

   if(StringLen(instr.account_server) > 0 &&
      instr.account_server != MR_AT_AccountServerStr())
     {
      err_msg = "account_server divergente da conta MT5";
      return false;
     }

   if(StringLen(instr.symbol) == 0)
     {
      err_msg = "symbol ausente na instrução";
      return false;
     }
   if(!SymbolInfoInteger(instr.symbol, SYMBOL_EXIST))
     {
      if(!SymbolSelect(instr.symbol, true))
        {
         err_msg = "symbol indisponível: " + instr.symbol;
         return false;
        }
     }

   if(!MR_AT_PreMarketSentToday())
     {
      if(!MR_AT_EnsurePreMarketSnapshot())
        {
         err_msg = "PRE_MARKET obrigatório antes de operação REAL";
         return false;
        }
     }

   if(!MR_AT_EnsurePreTradeSnapshot())
     {
      err_msg = "PRE_TRADE snapshot falhou";
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportExecutionProtection(
   const MRInstruction &instr,
   const string protection_mode,
   const string protection_status,
   const bool stop_present,
   const bool take_present,
   const double stop_price,
   const double take_price,
   const string entry_ticket,
   const string error_code = "",
   const string error_message = ""
)
  {
   int magic = MR_AT_ResolveInstructionMagic(instr);
   string body = "{";
   body += "\"instruction_id\":" + MR_AT_JsonQuote(instr.instruction_id) + ",";
   body += "\"account_login\":" + MR_AT_JsonQuote(MR_AT_AccountLoginStr()) + ",";
   body += "\"account_server\":" + MR_AT_JsonQuote(MR_AT_AccountServerStr()) + ",";
   body += "\"symbol\":" + MR_AT_JsonQuote(instr.symbol) + ",";
   body += "\"magic_number\":" + IntegerToString(magic) + ",";
   if(StringLen(entry_ticket) > 0)
      body += "\"entry_order_ticket\":" + MR_AT_JsonQuote(entry_ticket) + ",";
   body += "\"stop_loss_present\":" + (stop_present ? "true" : "false") + ",";
   body += "\"take_profit_present\":" + (take_present ? "true" : "false") + ",";
   if(stop_price > 0)
      body += "\"stop_loss_price\":" + DoubleToString(stop_price, _Digits) + ",";
   if(take_price > 0)
      body += "\"take_profit_price\":" + DoubleToString(take_price, _Digits) + ",";
   body += "\"protection_mode\":" + MR_AT_JsonQuote(protection_mode) + ",";
   body += "\"protection_status\":" + MR_AT_JsonQuote(protection_status) + ",";
   if(StringLen(error_code) > 0)
      body += "\"error_code\":" + MR_AT_JsonQuote(error_code) + ",";
   if(StringLen(error_message) > 0)
      body += "\"error_message\":" + MR_AT_JsonQuote(error_message) + ",";
   body += "\"reported_at\":" + MR_AT_JsonQuote(MR_AT_FormatExecutedAtIsoUtc());
   body += "}";

   string response = "";
   int http = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/execution-protection", body, response, http))
     {
      MR_AT_LogError("Protection", "POST execution-protection falhou (rede)");
      return false;
     }
   if(http < 200 || http >= 300)
     {
      MR_AT_LogError("Protection", "HTTP=" + IntegerToString(http) + " " +
                     MR_AT_JsonSummarize(response, 160));
      return false;
     }

   MR_AT_LogInfo("Protection", "Relatório " + protection_status + " magic=" + IntegerToString(magic));
   if(protection_status == "PROTECTION_FAILED")
      MR_AT_BlockMagicNumber(magic);
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_VerifyAndReportProtection(
   const MRInstruction &instr,
   const ulong entry_ticket,
   string &err_msg
)
  {
   err_msg = "";
   if(!MR_AT_InstructionIsReal(instr))
      return true;
   if(g_debug_mode)
     {
      return MR_AT_ReportExecutionProtection(
         instr, "ATTACHED_SL_TP", "NOT_REQUIRED_FOR_DEBUG", true, true, 0, 0,
         IntegerToString((long)entry_ticket));
     }

   if(!instr.protection_required && !instr.requires_protection_confirmation)
     {
      err_msg = "protection_required ausente em instrução REAL";
      return MR_AT_ReportExecutionProtection(
         instr, "UNKNOWN", "PROTECTION_FAILED", false, false, 0, 0,
         IntegerToString((long)entry_ticket), "PROTECTION_REQUIRED", err_msg);
     }

   int magic = MR_AT_ResolveInstructionMagic(instr);
   bool sl_ok = false;
   bool tp_ok = false;
   double sl_price = 0;
   double tp_price = 0;

   if(PositionSelect(instr.symbol))
     {
      if((int)PositionGetInteger(POSITION_MAGIC) == magic)
        {
         sl_price = PositionGetDouble(POSITION_SL);
         tp_price = PositionGetDouble(POSITION_TP);
         sl_ok = (sl_price > 0);
         tp_ok = (tp_price > 0);
        }
     }

   if(sl_ok && tp_ok)
     {
      return MR_AT_ReportExecutionProtection(
         instr, "ATTACHED_SL_TP", "PROTECTION_CONFIRMED", true, true,
         sl_price, tp_price, IntegerToString((long)entry_ticket));
     }

   string fail_msg = "Stop/take não confirmados após entrada";
   if(!sl_ok)
      fail_msg += " SL ausente";
   if(!tp_ok)
      fail_msg += " TP ausente";

   MR_AT_ReportExecutionProtection(
      instr, "ATTACHED_SL_TP", "PROTECTION_FAILED", sl_ok, tp_ok,
      sl_price, tp_price, IntegerToString((long)entry_ticket),
      "PROTECTION_VERIFY_FAILED", fail_msg);
   err_msg = fail_msg;
   return false;
  }

//+------------------------------------------------------------------+
