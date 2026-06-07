#ifndef MR_AT_DAILY_RISK_MQH
#define MR_AT_DAILY_RISK_MQH
//+------------------------------------------------------------------+
//| MR_AT_DailyRisk.mqh — infraestrutura contínua de risco diário     |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Equity.mqh"

#define MR_AT_DAILY_RISK_STRATEGY_CODE "MR_FIBO_D1_GUARD"

extern string g_license_id;
extern string g_device_id;

#define MR_AT_DAILY_RISK_INTERVAL_SEC 60

datetime g_lastDailyRiskSentAt = 0;
string   g_lastDailyRiskStatus = "";
string   g_lastDailyRiskStateId = "";
string   g_lastDailyRiskErrorCode = "";
string   g_lastDailyRiskErrorMessage = "";

//+------------------------------------------------------------------+
string MR_AT_TradeDateIso()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
  }

//+------------------------------------------------------------------+
bool MR_AT_ShouldSendDailyRiskReport()
  {
   return StringLen(g_license_id) >= 4;
  }

//+------------------------------------------------------------------+
void MR_AT_ResetDailyRiskTelemetryOnSuccess(const string response)
  {
   g_lastDailyRiskSentAt = TimeCurrent();
   g_lastDailyRiskStatus = "OK";
   g_lastDailyRiskStateId = MR_AT_JsonGetString(response, "state_id");
   g_lastDailyRiskErrorCode = "";
   g_lastDailyRiskErrorMessage = "";
  }

//+------------------------------------------------------------------+
void MR_AT_SetDailyRiskTelemetryFailure(const string code, const string message)
  {
   g_lastDailyRiskStatus = "FAILED";
   g_lastDailyRiskErrorCode = code;
   g_lastDailyRiskErrorMessage = message;
  }

//+------------------------------------------------------------------+
bool MR_AT_ReportDailyRisk(const bool force = false)
  {
   if(!MR_AT_ShouldSendDailyRiskReport())
      return false;

   const int elapsed = (int)(TimeCurrent() - g_lastDailyRiskSentAt);
   if(!force && g_lastDailyRiskSentAt > 0 && elapsed < MR_AT_DAILY_RISK_INTERVAL_SEC)
     {
      MR_AT_LogDebug("DailyRisk",
                     "skip: last report há " + IntegerToString(elapsed) +
                     "s, intervalo " + IntegerToString(MR_AT_DAILY_RISK_INTERVAL_SEC) + "s");
      return true;
     }

   double realized = 0;
   datetime from = MR_AT_DayStart(TimeCurrent());
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
   body += "\"strategy_code\":" + MR_AT_JsonQuote(MR_AT_DAILY_RISK_STRATEGY_CODE) + ",";
   body += "\"trade_date\":" + MR_AT_JsonQuote(MR_AT_TradeDateIso()) + ",";
   body += "\"realized_pnl\":" + DoubleToString(realized, 2) + ",";
   body += "\"open_pnl\":" + DoubleToString(openPnl, 2);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/daily-risk/report", body, response, status))
     {
      MR_AT_SetDailyRiskTelemetryFailure("REQUEST_FAILED", "report request failed");
      MR_AT_LogError("DailyRisk", "report failed code=REQUEST_FAILED message=report request failed");
      return false;
     }

   if(status >= 200 && status < 300)
     {
      MR_AT_ResetDailyRiskTelemetryOnSuccess(response);
      string tradeDate = MR_AT_JsonGetString(response, "trade_date");
      MR_AT_LogInfo("DailyRisk", "report ok stateId=" + g_lastDailyRiskStateId +
                    " tradeDate=" + tradeDate +
                    " strategy=" + MR_AT_DAILY_RISK_STRATEGY_CODE +
                    " symbol=" + _Symbol +
                    " nextIn=" + IntegerToString(MR_AT_DAILY_RISK_INTERVAL_SEC) + "s");
      return true;
     }

   string reason = MR_AT_JsonGetString(response, "code");
   if(StringLen(reason) == 0)
      reason = MR_AT_JsonGetString(response, "detail");
   if(StringLen(reason) == 0)
      reason = "HTTP_" + IntegerToString(status);

   MR_AT_SetDailyRiskTelemetryFailure(reason, MR_AT_JsonSummarize(response, 160));
   MR_AT_LogError("DailyRisk", "report failed code=" + reason +
                  " message=" + g_lastDailyRiskErrorMessage);
   return false;
  }

//+------------------------------------------------------------------+
void MR_AT_DailyRiskOnTimer()
  {
   if(!MR_AT_ShouldSendDailyRiskReport())
      return;
   MR_AT_ReportDailyRisk(false);
  }

//+------------------------------------------------------------------+
string MR_AT_DailyRiskTelemetryJson()
  {
   string sentAt = (g_lastDailyRiskSentAt > 0
                    ? TimeToString(g_lastDailyRiskSentAt, TIME_DATE|TIME_SECONDS)
                    : "");
   string body = "{";
   body += "\"last_daily_risk_sent_at\":" + MR_AT_JsonQuote(sentAt) + ",";
   body += "\"last_daily_risk_status\":" + MR_AT_JsonQuote(g_lastDailyRiskStatus) + ",";
   body += "\"last_daily_risk_state_id\":" + MR_AT_JsonQuote(g_lastDailyRiskStateId) + ",";
   body += "\"last_daily_risk_error_code\":" + MR_AT_JsonQuote(g_lastDailyRiskErrorCode) + ",";
   body += "\"last_daily_risk_error_message\":" + MR_AT_JsonQuote(g_lastDailyRiskErrorMessage);
   body += "}";
   return body;
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
