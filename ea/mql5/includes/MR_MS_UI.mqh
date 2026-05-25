//+------------------------------------------------------------------+
//| MR_MS_UI.mqh — botão e painel no gráfico (sem secret)             |
//+------------------------------------------------------------------+
#property strict

#include "MR_MS_Constants.mqh"

extern string g_ms_api_base_url;
extern string g_ms_symbol;
extern string g_ms_side;
extern string g_ms_profile;
extern string g_ms_last_signal_id;
extern string g_ms_last_http;
extern string g_ms_last_status;
extern datetime g_ms_last_send_time;

//+------------------------------------------------------------------+
bool MR_MS_CreateSendButton()
  {
   long chart_id = ChartID();
   if(ObjectFind(chart_id, MR_MS_BTN_SEND) >= 0)
      ObjectDelete(chart_id, MR_MS_BTN_SEND);

   if(!ObjectCreate(chart_id, MR_MS_BTN_SEND, OBJ_BUTTON, 0, 0, 0))
      return false;

   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_YDISTANCE, 28);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_XSIZE, 170);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_YSIZE, 26);
   ObjectSetString(chart_id, MR_MS_BTN_SEND, OBJPROP_TEXT, "Enviar sinal mestre");
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_BGCOLOR, clrDimGray);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_BORDER_COLOR, clrGold);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, MR_MS_BTN_SEND, OBJPROP_HIDDEN, true);
   ChartRedraw(chart_id);
   return true;
  }

//+------------------------------------------------------------------+
void MR_MS_DeleteSendButton()
  {
   ObjectDelete(ChartID(), MR_MS_BTN_SEND);
   ChartRedraw(ChartID());
  }

//+------------------------------------------------------------------+
string MR_MS_FormatLastSend()
  {
   if(g_ms_last_send_time <= 0)
      return "—";
   return TimeToString(g_ms_last_send_time, TIME_DATE | TIME_SECONDS);
  }

//+------------------------------------------------------------------+
void MR_MS_UpdateChartComment()
  {
   Comment(
      "Mercado da Riqueza AutoTrade\n",
      "EA Mãe — Emissor de sinal\n",
      "API: ", g_ms_api_base_url, "\n",
      "Symbol: ", g_ms_symbol, "\n",
      "Side: ", g_ms_side, "\n",
      "Profile: ", g_ms_profile, "\n",
      "Último envio: ", MR_MS_FormatLastSend(), "\n",
      "Último HTTP: ", g_ms_last_http, "\n",
      "Status: ", g_ms_last_status, "\n",
      "Master Signal ID: ", g_ms_last_signal_id
   );
  }

//+------------------------------------------------------------------+
