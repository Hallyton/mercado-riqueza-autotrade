//+------------------------------------------------------------------+
//| MR_AT_Error.mqh — POST /api/v1/ea/errors                          |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"

//+------------------------------------------------------------------+
bool MR_AT_ReportError(const string error_code, const string error_message)
  {
   string body = "{";
   body += "\"error_code\":" + MR_AT_JsonQuote(error_code) + ",";
   body += "\"error_message\":" + MR_AT_JsonQuote(error_message);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPostAuth("/api/v1/ea/errors", body, response, status))
      return false;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("Error", "Falha ao reportar erro HTTP " + IntegerToString(status));
      return false;
     }

   MR_AT_LogInfo("Error", "Erro reportado: " + error_code);
   return true;
  }
