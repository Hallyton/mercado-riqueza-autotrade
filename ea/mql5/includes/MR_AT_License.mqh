//+------------------------------------------------------------------+
//| MR_AT_License.mqh — ativação, token e config (sem estratégia)     |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"

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
string MR_AT_GvTokenKey()
  {
   return MR_AT_GV_TOKEN_PREFIX + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) +
          "_" + AccountInfoString(ACCOUNT_SERVER);
  }

string MR_AT_GvLicenseKey()
  {
   return MR_AT_GV_LICENSE_PREFIX + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) +
          "_" + AccountInfoString(ACCOUNT_SERVER);
  }

//+------------------------------------------------------------------+
void MR_AT_SaveCredentials()
  {
   GlobalVariableSet(MR_AT_GvTokenKey(), 1.0);
   GlobalVariableSet(MR_AT_GvLicenseKey(), 1.0);
   // Tokens em GV string não existem — persistir em arquivo local seguro
   string fname = "mr_at_" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + ".dat";
   int h = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_COMMON);
   if(h != INVALID_HANDLE)
     {
      FileWriteString(h, g_device_token + "\n" + g_license_id);
      FileClose(h);
     }
  }

//+------------------------------------------------------------------+
bool MR_AT_LoadCredentials()
  {
   string fname = "mr_at_" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + ".dat";
   if(!FileIsExist(fname, FILE_COMMON))
      return false;
   int h = FileOpen(fname, FILE_READ | FILE_TXT | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return false;
   g_device_token = FileReadString(h);
   g_license_id = FileReadString(h);
   FileClose(h);
   StringTrimRight(g_device_token);
   StringTrimRight(g_license_id);
   return (StringLen(g_device_token) > 8 && StringLen(g_license_id) > 0);
  }

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
   string body = "{";
   body += "\"activation_code\":" + MR_AT_JsonQuote(activation_code) + ",";
   body += "\"device_id\":" + MR_AT_JsonQuote(g_device_id) + ",";
   body += "\"ea_version\":" + MR_AT_JsonQuote(MR_AT_EA_VERSION);
   body += "}";

   string response = "";
   int status = 0;
   if(!MR_AT_ApiPost("/api/v1/ea/activate", body, false, response, status))
      return false;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("License", "Ativação HTTP " + IntegerToString(status) + " " + response);
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
   MR_AT_LogInfo("License", "Ativação OK — licença " + g_license_id);
   return true;
  }

//+------------------------------------------------------------------+
bool MR_AT_FetchConfig()
  {
   if(StringLen(g_device_token) < 8)
      return false;

   string response = "";
   int status = 0;
   if(!MR_AT_ApiGet("/api/v1/ea/config", true, response, status))
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

//+------------------------------------------------------------------+
bool MR_AT_IsLicensed()
  {
   return (StringLen(g_device_token) >= 8 && StringLen(g_license_id) > 0);
  }
