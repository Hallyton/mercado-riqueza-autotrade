//+------------------------------------------------------------------+
//| BBX_Log.mqh — logs com throttle e retcode                         |
//+------------------------------------------------------------------+
#ifndef BBX_LOG_MQH
#define BBX_LOG_MQH

string   g_ultimoErro = "";
string   g_ultimoLogChave = "";
datetime g_ultimoLogTime = 0;

void BBX_LogInfo(const string msg)
  {
   if(MostrarLogs)
      Print(BBX_LOG_PREFIX, msg);
  }

void BBX_LogErro(const string msg)
  {
   g_ultimoErro = msg;
   Print(BBX_LOG_PREFIX, "ERRO ", msg);
  }

void BBX_LogCritico(const string msg)
  {
   g_ultimoErro = msg;
   Print(BBX_LOG_PREFIX, "CRÍTICO ", msg);
   Alert(BBX_LOG_PREFIX, msg);
  }

void BBX_LogUnico(const string chave, const string msg, const bool isErro)
  {
   datetime now = TimeCurrent();
   if(chave == g_ultimoLogChave && (now - g_ultimoLogTime) < 60)
      return;
   g_ultimoLogChave = chave;
   g_ultimoLogTime = now;
   if(isErro)
      BBX_LogErro(msg);
   else
      BBX_LogInfo(msg);
  }

void BBX_LogRetcode(const string acao, const uint retcode, const string desc)
  {
   BBX_LogErro(acao + " retcode=" + IntegerToString((int)retcode) + " " + desc);
  }

bool BBX_RetcodeSucesso(const uint retcode)
  {
   return (retcode == TRADE_RETCODE_DONE ||
           retcode == TRADE_RETCODE_PLACED ||
           retcode == TRADE_RETCODE_DONE_PARTIAL);
  }

#endif
