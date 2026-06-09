//+------------------------------------------------------------------+
//| MR_AT_Position.mqh — posições abertas (telemetria)                 |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Json.mqh"

//+------------------------------------------------------------------+
string MR_AT_BuildOpenPositionsJson()
  {
   string json = "[";
   int total = PositionsTotal();
   bool first = true;

   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagicNumber)
         continue;

      if(!first)
         json += ",";
      first = false;

      string sym = PositionGetString(POSITION_SYMBOL);
      double vol = PositionGetDouble(POSITION_VOLUME);
      double price = PositionGetDouble(POSITION_PRICE_OPEN);
      double pnl = PositionGetDouble(POSITION_PROFIT);

      json += "{";
      json += "\"symbol\":" + MR_AT_JsonQuote(sym) + ",";
      json += "\"quantity\":" + DoubleToString(vol, 2) + ",";
      json += "\"avg_price\":" + DoubleToString(price, _Digits) + ",";
      json += "\"unrealized_pnl\":" + DoubleToString(pnl, 2);
      json += "}";
     }

   json += "]";
   return json;
  }

//+------------------------------------------------------------------+
string MR_AT_ComputePositionsHash()
  {
   string hash = "";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagicNumber)
         continue;
      hash += PositionGetString(POSITION_SYMBOL) + ":" +
              DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ";";
     }
   if(StringLen(hash) == 0)
      return "empty";
   return hash;
  }
