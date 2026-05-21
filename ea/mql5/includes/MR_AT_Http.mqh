//+------------------------------------------------------------------+
//| MR_AT_Http.mqh — WebRequest HTTPS                                 |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"

extern string g_api_base_url;
extern string g_device_id;
extern string g_device_token;
extern int      g_log_level;

//+------------------------------------------------------------------+
string MR_AT_NormalizeBaseUrl(const string base)
  {
   string url = base;
   StringTrimRight(url);
   while(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   return url;
  }

//+------------------------------------------------------------------+
string MR_AT_BuildHeaders(const bool with_auth, const string request_id)
  {
   string headers = "Content-Type: application/json\r\n";
   headers += "Accept: application/json\r\n";
   headers += "X-Device-Id: " + g_device_id + "\r\n";
   headers += "X-EA-Version: " + MR_AT_EA_VERSION + "\r\n";
   if(StringLen(request_id) > 0)
      headers += "X-Request-Id: " + request_id + "\r\n";
   if(with_auth && StringLen(g_device_token) > 0)
      headers += "Authorization: Bearer " + g_device_token + "\r\n";
   return headers;
  }

//+------------------------------------------------------------------+
string MR_AT_GenerateRequestId()
  {
   return "ea-" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "-" +
          IntegerToString(GetTickCount());
  }

//+------------------------------------------------------------------+
bool MR_AT_WebRequest(
   const string method,
   const string path,
   const string body,
   const bool with_auth,
   string &response_body,
   int &http_status,
   string &response_headers
)
  {
   string url = MR_AT_NormalizeBaseUrl(g_api_base_url) + path;
   string request_id = MR_AT_GenerateRequestId();
   string headers = MR_AT_BuildHeaders(with_auth, request_id);

   char data[];
   char result[];
   string result_headers;

   ArrayResize(data, 0);
   if(StringLen(body) > 0)
     {
      int n = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      if(n > 0)
         ArrayResize(data, n - 1);
     }

   ResetLastError();
   http_status = WebRequest(
      method,
      url,
      headers,
      MR_AT_HTTP_TIMEOUT_MS,
      data,
      result,
      result_headers
   );

   response_headers = result_headers;

   if(http_status == -1)
     {
      int err = GetLastError();
      MR_AT_LogError("HTTP", "WebRequest falhou err=" + IntegerToString(err) +
                     " url=" + url + " (adicione URL em Ferramentas > Opções > Expert Advisors)");
      return false;
     }

   response_body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ApiGet(const string path, const bool with_auth, string &body, int &status)
  {
   string headers = "";
   return MR_AT_WebRequest("GET", path, "", with_auth, body, status, headers);
  }

//+------------------------------------------------------------------+
bool MR_AT_ApiPost(const string path, const string json_body, const bool with_auth, string &body, int &status)
  {
   string headers = "";
   return MR_AT_WebRequest("POST", path, json_body, with_auth, body, status, headers);
  }
