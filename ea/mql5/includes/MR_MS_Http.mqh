//+------------------------------------------------------------------+
//| MR_MS_Http.mqh — POST /api/master/signals (Bearer MASTER secret)  |
//+------------------------------------------------------------------+
#property strict

#include "MR_MS_Constants.mqh"
#include "MR_MS_Log.mqh"

extern string g_ms_api_base_url;
extern string g_ms_master_secret;

//+------------------------------------------------------------------+
string MR_MS_NormalizeBaseUrl(const string base)
  {
   string url = base;
   StringTrimLeft(url);
   StringTrimRight(url);
   while(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   return url;
  }

//+------------------------------------------------------------------+
bool MR_MS_WebRequestPost(
   const string path,
   const string json_body,
   string &response_body,
   int &http_status
)
  {
   string url = MR_MS_NormalizeBaseUrl(g_ms_api_base_url) + path;
   string headers = "Content-Type: application/json\r\n";
   headers += "Accept: application/json\r\n";
   headers += "Authorization: Bearer " + g_ms_master_secret + "\r\n";

   char data[];
   char result[];
   string result_headers;

   ArrayResize(data, 0);
   if(StringLen(json_body) > 0)
     {
      int n = StringToCharArray(json_body, data, 0, WHOLE_ARRAY, CP_UTF8);
      if(n > 0)
         ArrayResize(data, n - 1);
     }

   ResetLastError();
   http_status = WebRequest(
      "POST",
      url,
      headers,
      MR_MS_HTTP_TIMEOUT_MS,
      data,
      result,
      result_headers
   );

   if(http_status == -1)
     {
      int err = GetLastError();
      MR_MS_LogError("HTTP", "WebRequest falhou err=" + IntegerToString(err) +
                     " url=" + url);
      MR_MS_LogError("HTTP", "Libere a URL em Ferramentas > Opções > Expert Advisors > Permitir WebRequest");
      return false;
     }

   response_body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
  }

//+------------------------------------------------------------------+
void MR_MS_LogHttpOutcome(const int http_status, const string response_body)
  {
   MR_MS_LogInfo("HTTP", "Authorization: Bearer ***REDACTED***");
   MR_MS_LogInfo("HTTP", "Status HTTP: " + IntegerToString(http_status));

   if(http_status == 201)
      MR_MS_LogInfo("HTTP", "Resultado: sinal mestre criado (VALIDATED, dispatch NOT_STARTED)");
   else if(http_status == 200 && StringFind(response_body, "idempotent") >= 0)
      MR_MS_LogInfo("HTTP", "Resultado: retry idempotente — sinal já registrado");
   else if(http_status == 409)
      MR_MS_LogError("HTTP", "Resultado: conflito (MASTER_SIGNAL_CONFLICT)");
   else if(http_status == 400)
      MR_MS_LogError("HTTP", "Resultado: validação rejeitada (400)");
   else if(http_status == 401)
      MR_MS_LogError("HTTP", "Resultado: autenticação inválida ou ausente (401)");
   else if(http_status == 503)
      MR_MS_LogError("HTTP", "Resultado: MASTER_EA_API_SECRET não configurado no servidor (503)");
   else
      MR_MS_LogError("HTTP", "Resultado: resposta inesperada");

   if(StringLen(response_body) > 0)
      MR_MS_LogInfo("HTTP", "Corpo: " + response_body);
  }

//+------------------------------------------------------------------+
