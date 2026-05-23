//+------------------------------------------------------------------+
//| MR_AT_Log.mqh — logs no terminal Experts                          |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"

// Nível configurável via input do .mq5 (g_log_level)
extern int g_log_level;

//+------------------------------------------------------------------+
void MR_AT_Log(const int level, const string tag, const string message)
  {
   if(level > g_log_level)
      return;
   string prefix = "[MR AutoTrade]";
   if(level == MR_AT_LOG_ERROR)
      Print(prefix, " [ERRO] ", tag, ": ", message);
   else if(level == MR_AT_LOG_INFO)
      Print(prefix, " [INFO] ", tag, ": ", message);
   else
      Print(prefix, " [DEBUG] ", tag, ": ", message);
  }

void MR_AT_LogError(const string tag, const string message)
  {
   MR_AT_Log(MR_AT_LOG_ERROR, tag, message);
  }

void MR_AT_LogInfo(const string tag, const string message)
  {
   MR_AT_Log(MR_AT_LOG_INFO, tag, message);
  }

void MR_AT_LogDebug(const string tag, const string message)
  {
   MR_AT_Log(MR_AT_LOG_DEBUG, tag, message);
  }

//+------------------------------------------------------------------+
bool MR_AT_IsVerboseLog()
  {
   return g_log_level >= MR_AT_LOG_DEBUG;
  }
