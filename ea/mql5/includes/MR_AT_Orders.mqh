//+------------------------------------------------------------------+
//| MR_AT_Orders.mqh — ordens pendentes (telemetria)                  |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Constants.mqh"
#include "MR_AT_Json.mqh"

//+------------------------------------------------------------------+
string MR_AT_OrderSideFromType(const long type)
  {
   if(type == ORDER_TYPE_BUY || type == ORDER_TYPE_BUY_LIMIT || type == ORDER_TYPE_BUY_STOP)
      return "BUY";
   return "SELL";
  }

//+------------------------------------------------------------------+
string MR_AT_BuildPendingOrdersJson()
  {
   string json = "[";
   bool first = true;

   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !OrderSelect(ticket))
         continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagicNumber)
         continue;

      if(!first)
         json += ",";
      first = false;

      string sym = OrderGetString(ORDER_SYMBOL);
      long type = OrderGetInteger(ORDER_TYPE);
      double vol = OrderGetDouble(ORDER_VOLUME_CURRENT);
      double price = OrderGetDouble(ORDER_PRICE_OPEN);

      json += "{";
      json += "\"ticket\":" + MR_AT_JsonQuote(IntegerToString((long)ticket)) + ",";
      json += "\"symbol\":" + MR_AT_JsonQuote(sym) + ",";
      json += "\"side\":" + MR_AT_JsonQuote(MR_AT_OrderSideFromType(type)) + ",";
      json += "\"volume\":" + DoubleToString(vol, 2);
      if(price > 0)
         json += ",\"price\":" + DoubleToString(price, _Digits);
      json += "}";
     }

   json += "]";
   return json;
  }
