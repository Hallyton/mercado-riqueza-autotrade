//+------------------------------------------------------------------+
//| MR_MS_Json.mqh — escape mínimo para payload master signal         |
//+------------------------------------------------------------------+
#property strict

//+------------------------------------------------------------------+
string MR_MS_JsonEscape(const string value)
  {
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\n", "\\n");
   StringReplace(out, "\r", "\\r");
   StringReplace(out, "\t", "\\t");
   return out;
  }

//+------------------------------------------------------------------+
string MR_MS_JsonStringField(const string key, const string value)
  {
   return "\"" + key + "\":\"" + MR_MS_JsonEscape(value) + "\"";
  }

//+------------------------------------------------------------------+
string MR_MS_JsonIntField(const string key, const int value)
  {
   return "\"" + key + "\":" + IntegerToString(value);
  }

//+------------------------------------------------------------------+
