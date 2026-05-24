//+------------------------------------------------------------------+
//| MR_AT_License.mqh — ativação e config (sem estratégia)            |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_Auth.mqh"

extern string g_api_base_url;
extern string g_device_id;
extern string g_device_token;
extern string g_license_id;
extern int      g_heartbeat_interval_sec;
extern bool     g_halt_new_entries;
extern bool     g_halt_all_trading;
extern bool     g_can_accept_new_entries;
extern bool     g_can_manage_open_positions;
extern bool     g_subscription_active;

//+------------------------------------------------------------------+
bool MR_AT_ApplyConfigFromJson(const string json)
  {
   g_halt_new_entries = MR_AT_JsonGetBool(json, "halt_new_entries");
   g_halt_all_trading = MR_AT_JsonGetBool(json, "halt_all_trading");
   g_can_accept_new_entries = MR_AT_JsonGetBool(json, "can_accept_new_entries");
   g_can_manage_open_positions = MR_AT_JsonGetBool(json, "can_manage_open_positions");

   int interval = MR_AT_JsonGetInt(json, "heartbeat_interval_sec");
   if(interval >= 5 && interval <= 300)
      g_heartbeat_interval_sec = interval;

   string lic = MR_AT_JsonGetString(json, "license_id");
   if(StringLen(lic) > 0)
      g_license_id = lic;

   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_Activate(const string activation_code)
  {
   string code = activation_code;
   StringTrimLeft(code);
   StringTrimRight(code);
   if(StringLen(code) < 4)
     {
      MR_AT_LogError("License", "Código de ativação vazio ou inválido.");
      return false;
     }

   MR_AT_LogInfo("License", "Ativando EA com código de ativação informado...");

   string body = "{";
   body += "\"activation_code\":" + MR_AT_JsonQuote(code) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"ea_version\":" + MR_AT_JsonQuote(MR_AT_EA_VERSION);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPost("/api/v1/ea/activate", body, false, response, status))
      return false;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("License", "Ativação HTTP " + IntegerToString(status) + " " +
                     MR_AT_JsonSummarize(response, 200));
      return false;
     }

   g_device_token = MR_AT_JsonGetString(response, "device_token");
   g_license_id = MR_AT_JsonGetString(response, "license_id");

   if(StringLen(g_device_token) < 8)
     {
      MR_AT_LogError("License", "Resposta de ativação sem device_token");
      return false;
     }

   int cfg_pos = StringFind(response, "\"config\"");
   if(cfg_pos >= 0)
      MR_AT_ApplyConfigFromJson(response);

   MR_AT_SaveCredentials();
   MR_AT_ClearTokenRecoveryExhausted();
   MR_AT_LogInfo("License", "Ativação OK — licença " + g_license_id);
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_TryRecoverFromInvalidToken()
  {
   if(MR_AT_IsTokenRecoveryExhausted())
     {
      MR_AT_LogError("License",
         "Reativação falhou. Gere novo código de ativação no dashboard.");
      return false;
     }

   MR_AT_ClearCredentials();

   if(StringLen(InpActivationCode) < 4)
     {
      MR_AT_LogError("License",
         "Token revogado. Preencha InpActivationCode com o novo código do dashboard.");
      MR_AT_MarkTokenRecoveryExhausted();
      return false;
     }

   MR_AT_MarkTokenRecoveryExhausted();
   MR_AT_LogInfo("License", "Tentando reativar com InpActivationCode (uma vez)...");

   if(MR_AT_Activate(InpActivationCode))
     {
      MR_AT_ClearTokenRecoveryExhausted();
      MR_AT_LogInfo("License", "Reativação OK após token revogado.");
      return true;
     }

   MR_AT_LogError("License",
      "Reativação falhou. Gere novo código de ativação no dashboard.");
   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_ApiGetAuth(const string path, string &body, int &status)
  {
   if(!MR_AT_ApiGet(path, true, body, status))
      return false;

   if(status >= 200 && status < 300)
      return true;

   if(MR_AT_IsInvalidTokenResponse(status, body) && MR_AT_TryRecoverFromInvalidToken())
     {
      if(!MR_AT_ApiGet(path, true, body, status))
         return false;
      return (status >= 200 && status < 300);
     }

   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_ApiPostAuth(const string path, const string json_body, string &body, int &status)
  {
   if(!MR_AT_ApiPost(path, json_body, true, body, status))
      return false;

   if(status >= 200 && status < 300)
      return true;

   if(MR_AT_IsInvalidTokenResponse(status, body) && MR_AT_TryRecoverFromInvalidToken())
     {
      if(!MR_AT_ApiPost(path, json_body, true, body, status))
         return false;
      return (status >= 200 && status < 300);
     }

   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_FetchConfig()
  {
   if(StringLen(g_device_token) < 8)
      return false;

   string response = "";
   int status = 0;
   if(!MR_AT_ApiGetAuth("/api/v1/ea/config", response, status))
      return false;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("License", "Config HTTP " + IntegerToString(status));
      return false;
     }

   MR_AT_ApplyConfigFromJson(response);
   MR_AT_LogDebug("License", "Config: halt_new=" + (g_halt_new_entries ? "true" : "false") +
                  " halt_all=" + (g_halt_all_trading ? "true" : "false"));
   return true;
  }
