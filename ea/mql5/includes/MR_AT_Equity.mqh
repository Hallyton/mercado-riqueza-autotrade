//+------------------------------------------------------------------+
//| MR_AT_Equity.mqh — saldo, equity e margem da conta                |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Log.mqh"

extern string g_configured_trade_mode;

//+------------------------------------------------------------------+
double MR_AT_GetEquity()
  {
   return AccountInfoDouble(ACCOUNT_EQUITY);
  }

double MR_AT_GetBalance()
  {
   return AccountInfoDouble(ACCOUNT_BALANCE);
  }

double MR_AT_GetMargin()
  {
   return AccountInfoDouble(ACCOUNT_MARGIN);
  }

string MR_AT_GetTradeMode()
  {
   if(g_configured_trade_mode == "REAL" || g_configured_trade_mode == "DEMO")
      return g_configured_trade_mode;
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_DEMO)
      return "DEMO";
   return "REAL";
  }

string MR_AT_AccountLoginStr()
  {
   return IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN));
  }

string MR_AT_AccountServerStr()
  {
   return AccountInfoString(ACCOUNT_SERVER);
  }
