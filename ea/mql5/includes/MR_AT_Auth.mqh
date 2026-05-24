//+------------------------------------------------------------------+
//| MR_AT_Auth.mqh — credenciais locais e detecção INVALID_TOKEN      |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"

extern string g_device_token;
extern string g_license_id;

static bool g_invalid_token_recovery_exhausted = false;

//+------------------------------------------------------------------+
string MR_AT_CredentialsFileName()
  {
   return "mr_at_" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + ".dat";
  }

//+------------------------------------------------------------------+
string MR_AT_GvTokenKey()
  {
   return MR_AT_GV_TOKEN_PREFIX + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) +
          "_" + AccountInfoString(ACCOUNT_SERVER);
  }

//+------------------------------------------------------------------+
string MR_AT_GvLicenseKey()
  {
   return MR_AT_GV_LICENSE_PREFIX + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) +
          "_" + AccountInfoString(ACCOUNT_SERVER);
  }

//+------------------------------------------------------------------+
void MR_AT_ResetTokenRecoveryState()
  {
   g_invalid_token_recovery_exhausted = false;
  }

//+------------------------------------------------------------------+
bool MR_AT_IsTokenRecoveryExhausted()
  {
   return g_invalid_token_recovery_exhausted;
  }

//+------------------------------------------------------------------+
void MR_AT_MarkTokenRecoveryExhausted()
  {
   g_invalid_token_recovery_exhausted = true;
  }

//+------------------------------------------------------------------+
void MR_AT_ClearTokenRecoveryExhausted()
  {
   g_invalid_token_recovery_exhausted = false;
  }

//+------------------------------------------------------------------+
void MR_AT_ClearCredentials()
  {
   g_device_token = "";
   g_license_id = "";

   string fname = MR_AT_CredentialsFileName();
   if(FileIsExist(fname, FILE_COMMON))
      FileDelete(fname, FILE_COMMON);

   if(GlobalVariableCheck(MR_AT_GvTokenKey()))
      GlobalVariableDel(MR_AT_GvTokenKey());
   if(GlobalVariableCheck(MR_AT_GvLicenseKey()))
      GlobalVariableDel(MR_AT_GvLicenseKey());

   MR_AT_LogInfo("License", "Token inválido/revogado. Limpando credenciais locais.");
  }

//+------------------------------------------------------------------+
void MR_AT_SaveCredentials()
  {
   GlobalVariableSet(MR_AT_GvTokenKey(), 1.0);
   GlobalVariableSet(MR_AT_GvLicenseKey(), 1.0);

   string fname = MR_AT_CredentialsFileName();
   int h = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_COMMON);
   if(h != INVALID_HANDLE)
     {
      FileWriteString(h, g_device_token + "\n" + g_license_id);
      FileClose(h);
     }
   MR_AT_LogInfo("License", "Credenciais salvas localmente (licença " + g_license_id + ").");
  }

//+------------------------------------------------------------------+
bool MR_AT_LoadCredentials()
  {
   string fname = MR_AT_CredentialsFileName();
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

   if(StringLen(g_device_token) > 8 && StringLen(g_license_id) > 0)
     {
      MR_AT_LogInfo("License", "Usando credenciais salvas localmente (licença " + g_license_id + ").");
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
bool MR_AT_IsLicensed()
  {
   return (StringLen(g_device_token) >= 8 && StringLen(g_license_id) > 0);
  }

//+------------------------------------------------------------------+
bool MR_AT_IsInvalidTokenResponse(const int status, const string body)
  {
   if(status != 401)
      return false;

   string code = MR_AT_JsonGetString(body, "code");
   if(code == "INVALID_TOKEN")
      return true;

   if(StringFind(body, "INVALID_TOKEN") >= 0)
      return true;
   if(StringFind(body, "invalid_token") >= 0)
      return true;

   return false;
  }
