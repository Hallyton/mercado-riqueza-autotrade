//+------------------------------------------------------------------+
//| MR_MS_Log.mqh — logs do EA Mãe (nunca logar secret)               |
//+------------------------------------------------------------------+
#property strict

#include "MR_MS_Constants.mqh"

extern int g_ms_log_level;

//+------------------------------------------------------------------+
void MR_MS_Log(const int level, const string tag, const string message)
  {
   if(level > g_ms_log_level)
      return;
   string prefix = "[MR Master Signal]";
   if(level == MR_MS_LOG_ERROR)
      Print(prefix, " [ERRO] ", tag, ": ", message);
   else if(level == MR_MS_LOG_INFO)
      Print(prefix, " [INFO] ", tag, ": ", message);
   else
      Print(prefix, " [DEBUG] ", tag, ": ", message);
  }

void MR_MS_LogError(const string tag, const string message)
  {
   MR_MS_Log(MR_MS_LOG_ERROR, tag, message);
  }

void MR_MS_LogInfo(const string tag, const string message)
  {
   MR_MS_Log(MR_MS_LOG_INFO, tag, message);
  }

void MR_MS_LogDebug(const string tag, const string message)
  {
   MR_MS_Log(MR_MS_LOG_DEBUG, tag, message);
  }

//+------------------------------------------------------------------+
