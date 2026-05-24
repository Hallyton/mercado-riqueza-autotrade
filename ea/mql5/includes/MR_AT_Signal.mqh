//+------------------------------------------------------------------+
//| MR_AT_Signal.mqh — GET /api/v1/ea/instructions (pull de sinais)   |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
#include "MR_AT_ApiAuth.mqh"
#include "MR_AT_Equity.mqh"
#include "MR_AT_Execution.mqh"

extern bool g_subscription_active;

//+------------------------------------------------------------------+
bool MR_AT_ParseInstructionObject(const string obj, MRInstruction &instr)
  {
   instr.instruction_id = MR_AT_JsonGetString(obj, "instruction_id");
   instr.purpose = MR_AT_JsonGetString(obj, "purpose");
   instr.symbol = MR_AT_JsonGetString(obj, "symbol");
   instr.side = MR_AT_JsonGetString(obj, "side");
   instr.order_type = MR_AT_JsonGetString(obj, "order_type");
   instr.quantity = MR_AT_JsonGetDouble(obj, "quantity");
   instr.stop_loss = MR_AT_JsonGetDouble(obj, "stop_loss");
   instr.take_profit = MR_AT_JsonGetDouble(obj, "take_profit");
   instr.expires_at = MR_AT_JsonGetString(obj, "expires_at");
   instr.idempotency_key = MR_AT_JsonGetString(obj, "idempotency_key");

   if(StringLen(instr.instruction_id) == 0 || StringLen(instr.symbol) == 0)
      return false;
   if(instr.order_type == "")
      instr.order_type = "MARKET";
   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_LogInstructionParsed(const MRInstruction &instr, const int index)
  {
   MR_AT_LogDebug("Signal",
      "#" + IntegerToString(index) + " id=" + instr.instruction_id +
      " symbol=" + instr.symbol +
      " side=" + instr.side +
      " order_type=" + instr.order_type +
      " purpose=" + instr.purpose +
      " quantity=" + DoubleToString(instr.quantity, 8));
  }

//+------------------------------------------------------------------+
int MR_AT_ExtractInstructions(const string response, MRInstruction &instructions[])
  {
   ArrayResize(instructions, 0);

   int arr_key = StringFind(response, "\"instructions\"");
   if(arr_key < 0)
     {
      if(MR_AT_IsVerboseLog())
         MR_AT_LogDebug("Signal", "Parse: chave \"instructions\" ausente no JSON");
      return 0;
     }

   int arr_open = StringFind(response, "[", arr_key);
   if(arr_open < 0)
     {
      if(MR_AT_IsVerboseLog())
         MR_AT_LogDebug("Signal", "Parse: array \"instructions\" não encontrado");
      return 0;
     }

   int cursor = arr_open;
   int count = 0;

   while(count < MR_AT_MAX_INSTRUCTIONS)
     {
      string obj = "";
      if(!MR_AT_JsonExtractInstructionObject(response, cursor, cursor, obj))
         break;

      MRInstruction instr;
      if(MR_AT_ParseInstructionObject(obj, instr))
        {
         ArrayResize(instructions, count + 1);
         instructions[count] = instr;
         if(MR_AT_IsVerboseLog())
            MR_AT_LogInstructionParsed(instr, count);
         count++;
        }
      else if(MR_AT_IsVerboseLog())
        {
         MR_AT_LogDebug("Signal",
            "Parse: objeto inválido trecho=" + MR_AT_JsonSummarize(obj, 200));
        }
     }

   return count;
  }

//+------------------------------------------------------------------+
int MR_AT_FetchAndProcessSignals()
  {
   string login = MR_AT_AccountLoginStr();
   string server = MR_AT_AccountServerStr();
   StringReplace(server, " ", "%20");
   string path = "/api/v1/ea/instructions?login=" + login + "&server=" + server;

   string response = "";
   int status = 0;
   if(!MR_AT_ApiGetAuth(path, response, status))
     {
      MR_AT_LogError("Signal", "Pull falhou (WebRequest) path=" + path);
      return 0;
     }

   if(MR_AT_IsVerboseLog())
     {
      MR_AT_LogDebug("Signal", "GET /instructions HTTP=" + IntegerToString(status));
      MR_AT_LogDebug("Signal", "GET body=" + MR_AT_JsonSummarize(response));
     }

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("Signal", "Pull HTTP " + IntegerToString(status) +
                     " body=" + MR_AT_JsonSummarize(response, 200));
      return 0;
     }

   g_subscription_active = MR_AT_JsonGetBool(response, "subscription_active");
   if(!g_subscription_active)
      MR_AT_LogInfo("Signal", "Assinatura inativa — apenas gestão de posição permitida");

   MRInstruction instructions[];
   int n = MR_AT_ExtractInstructions(response, instructions);

   if(MR_AT_IsVerboseLog())
      MR_AT_LogDebug("Signal", "Instruções parseadas: " + IntegerToString(n));

   if(n == 0)
     {
      MR_AT_LogDebug("Signal", "Nenhuma instrução pendente no payload");
      return 0;
     }

   MR_AT_LogInfo("Signal", IntegerToString(n) + " instrução(ões) recebida(s)");
   for(int i = 0; i < n; i++)
     {
      if(instructions[i].order_type != "MARKET")
        {
         string reason = "Tipo de ordem não suportado no MVP: " + instructions[i].order_type;
         MR_AT_LogInfo("Signal", "Ignorada id=" + instructions[i].instruction_id + " — " + reason);
         MR_AT_ReportIgnored(instructions[i].instruction_id, reason);
         continue;
        }
      if(instructions[i].purpose == "ENTRY" && !g_can_accept_new_entries)
        {
         string reason = "ENTRY bloqueada (halt/assinatura)";
         MR_AT_LogInfo("Signal", "Ignorada id=" + instructions[i].instruction_id + " — " + reason);
         MR_AT_ReportIgnored(instructions[i].instruction_id, reason);
         continue;
        }
      if((instructions[i].purpose == "EXIT" || instructions[i].purpose == "ADJUSTMENT") &&
         !g_can_manage_open_positions)
        {
         string reason = "Gestão de posição bloqueada";
         MR_AT_LogInfo("Signal", "Ignorada id=" + instructions[i].instruction_id + " — " + reason);
         MR_AT_ReportIgnored(instructions[i].instruction_id, reason);
         continue;
        }

      MR_AT_ProcessInstruction(instructions[i]);
     }

   return n;
  }
