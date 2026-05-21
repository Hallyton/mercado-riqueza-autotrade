//+------------------------------------------------------------------+
//| MR_AT_Signal.mqh — GET /api/v1/ea/instructions (pull de sinais)   |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_Json.mqh"
#include "MR_AT_Http.mqh"
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
int MR_AT_ExtractInstructions(const string response, MRInstruction &instructions[])
  {
   ArrayResize(instructions, 0);
   int arr_start = StringFind(response, "\"instructions\"");
   if(arr_start < 0)
      return 0;

   int cursor = arr_start;
   int count = 0;

   while(count < MR_AT_MAX_INSTRUCTIONS)
     {
      int id_pos = StringFind(response, "\"instruction_id\"", cursor);
      if(id_pos < 0)
         break;

      int obj_start = StringFind(response, "{", id_pos);
      int obj_end = StringFind(response, "}", id_pos);
      if(obj_start < 0 || obj_end < 0)
         break;

      string obj = StringSubstr(response, obj_start, obj_end - obj_start + 1);
      MRInstruction instr;
      if(MR_AT_ParseInstructionObject(obj, instr))
        {
         ArrayResize(instructions, count + 1);
         instructions[count] = instr;
         count++;
        }
      cursor = obj_end + 1;
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
   if(!MR_AT_ApiGet(path, true, response, status))
      return 0;

   if(status < 200 || status >= 300)
     {
      MR_AT_LogError("Signal", "Pull HTTP " + IntegerToString(status));
      return 0;
     }

   g_subscription_active = MR_AT_JsonGetBool(response, "subscription_active");
   if(!g_subscription_active)
      MR_AT_LogInfo("Signal", "Assinatura inativa — apenas gestão de posição permitida");

   MRInstruction instructions[];
   int n = MR_AT_ExtractInstructions(response, instructions);
   if(n == 0)
     {
      MR_AT_LogDebug("Signal", "Nenhuma instrução pendente");
      return 0;
     }

   MR_AT_LogInfo("Signal", IntegerToString(n) + " instrução(ões) recebida(s)");
   for(int i = 0; i < n; i++)
     {
      if(instructions[i].order_type != "MARKET")
        {
         MR_AT_ReportIgnored(instructions[i].instruction_id, "Tipo de ordem não suportado no MVP");
         continue;
        }
      MR_AT_ProcessInstruction(instructions[i]);
     }

   return n;
  }
