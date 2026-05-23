//+------------------------------------------------------------------+
//| MR_AT_Json.mqh — helpers JSON mínimos (sem dependências externas)|
//+------------------------------------------------------------------+
#property strict

//+------------------------------------------------------------------+
string MR_AT_JsonEscape(const string value)
  {
   string s = value;
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "");
   return s;
  }

//+------------------------------------------------------------------+
string MR_AT_JsonQuote(const string value)
  {
   return "\"" + MR_AT_JsonEscape(value) + "\"";
  }

//+------------------------------------------------------------------+
int MR_AT_JsonFindKey(const string json, const string key, const int start = 0)
  {
   string needle = "\"" + key + "\"";
   return StringFind(json, needle, start);
  }

//+------------------------------------------------------------------+
string MR_AT_JsonGetString(const string json, const string key, const int start = 0)
  {
   int p = MR_AT_JsonFindKey(json, key, start);
   if(p < 0)
      return "";
   int colon = StringFind(json, ":", p);
   if(colon < 0)
      return "";
   int q1 = StringFind(json, "\"", colon);
   if(q1 < 0)
      return "";
   int q2 = StringFind(json, "\"", q1 + 1);
   if(q2 < 0)
      return "";
   return StringSubstr(json, q1 + 1, q2 - q1 - 1);
  }

//+------------------------------------------------------------------+
bool MR_AT_JsonGetBool(const string json, const string key, const int start = 0)
  {
   int p = MR_AT_JsonFindKey(json, key, start);
   if(p < 0)
      return false;
   int colon = StringFind(json, ":", p);
   if(colon < 0)
      return false;
   string tail = StringSubstr(json, colon + 1, 12);
   StringTrimLeft(tail);
   return (StringFind(tail, "true") == 0);
  }

//+------------------------------------------------------------------+
double MR_AT_JsonGetDouble(const string json, const string key, const int start = 0)
  {
   int p = MR_AT_JsonFindKey(json, key, start);
   if(p < 0)
      return 0.0;
   int colon = StringFind(json, ":", p);
   if(colon < 0)
      return 0.0;
   string tail = StringSubstr(json, colon + 1, 32);
   StringReplace(tail, ",", ".");
   StringTrimLeft(tail);
   if(StringGetCharacter(tail, 0) == '"')
     {
      int q2 = StringFind(tail, "\"", 1);
      if(q2 > 0)
         tail = StringSubstr(tail, 1, q2 - 1);
     }
   int comma = StringFind(tail, ",");
   if(comma >= 0)
      tail = StringSubstr(tail, 0, comma);
   int brace = StringFind(tail, "}");
   if(brace >= 0)
      tail = StringSubstr(tail, 0, brace);
   return StringToDouble(tail);
  }

//+------------------------------------------------------------------+
int MR_AT_JsonGetInt(const string json, const string key, const int start = 0)
  {
   return (int)MR_AT_JsonGetDouble(json, key, start);
  }

//+------------------------------------------------------------------+
//| Trecho resumido do JSON para log (sem vazar token)                |
//+------------------------------------------------------------------+
string MR_AT_JsonSummarize(const string json, const int max_len = 480)
  {
   string s = json;
   StringReplace(s, "\r", "");
   StringReplace(s, "\n", "");
   if(StringLen(s) <= max_len)
      return s;
   return StringSubstr(s, 0, max_len) + "...";
  }

//+------------------------------------------------------------------+
//| Extrai objeto JSON que contém "instruction_id" a partir de cursor |
//+------------------------------------------------------------------+
bool MR_AT_JsonExtractInstructionObject(
   const string json,
   const int search_from,
   int &cursor,
   string &obj_out
)
  {
   obj_out = "";
   int id_pos = StringFind(json, "\"instruction_id\"", search_from);
   if(id_pos < 0)
      return false;

   int obj_start = id_pos;
   while(obj_start > search_from)
     {
      if(StringGetCharacter(json, obj_start) == '{')
         break;
      obj_start--;
     }
   if(obj_start <= search_from || StringGetCharacter(json, obj_start) != '{')
      return false;

   int depth = 0;
   int obj_end = -1;
   int len = StringLen(json);
   for(int i = obj_start; i < len; i++)
     {
      ushort ch = StringGetCharacter(json, i);
      if(ch == '{')
         depth++;
      else if(ch == '}')
        {
         depth--;
         if(depth == 0)
           {
            obj_end = i;
            break;
           }
        }
     }
   if(obj_end < 0)
      return false;

   obj_out = StringSubstr(json, obj_start, obj_end - obj_start + 1);
   cursor = obj_end + 1;
   return true;
  }

//+------------------------------------------------------------------+
//| ISO 8601 UTC para POST /executions (executed_at)                  |
//+------------------------------------------------------------------+
string MR_AT_FormatExecutedAtIsoUtc()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
  }
