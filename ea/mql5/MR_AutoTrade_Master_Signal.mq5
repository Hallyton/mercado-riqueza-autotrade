//+------------------------------------------------------------------+
//| MR_AutoTrade_Master_Signal.mq5                                   |
//| Mercado da Riqueza AutoTrade — EA Mãe emissor manual de sinal     |
//|                                                                   |
//| Apenas POST /api/master/signals — sem estratégia, sem ordens MT5. |
//| Dispatch para clientes continua manual no painel admin.            |
//+------------------------------------------------------------------+
#property copyright "Mercado da Riqueza"
#property link      "https://mercadodariqueza.com.br"
#property version   "1.00"
#property description "EA Mãe v1 — emissor manual de MasterSignal (sem estratégia)"
#property strict

enum ENUM_MS_SIDE
  {
   MS_SIDE_BUY = 0,
   MS_SIDE_SELL = 1
  };

//--- Inputs (whitelist — sem parâmetros estratégicos)
input string      InpApiBaseUrl      = "https://autotrade-staging.mercadodariqueza.com.br"; // URL base da API
input string      InpMasterSecret    = "";                                                    // MASTER_EA_API_SECRET (não logar)
input string      InpMasterSignalId  = "";                                                    // vazio = master-mt5-YYYYMMDD-HHMMSS
input string      InpSymbol          = "WDOM26";                                              // Símbolo do sinal
input ENUM_MS_SIDE InpSide           = MS_SIDE_BUY;                                           // BUY / SELL
input string      InpOrderType       = "MARKET";                                              // MARKET, LIMIT, etc.
input string      InpPurpose         = "ENTRY";                                               // ENTRY, EXIT, ADJUSTMENT
input string      InpProfile         = "conservador";                                       // Perfil de exposição
input int         InpExpiresSeconds  = 300;                                                   // 5–300 segundos
input bool        InpSendOnInit      = false;                                                 // Enviar ao anexar (desligado por segurança)
input bool        InpSendOnce        = true;                                                  // Bloqueia reenvio após sucesso 201/200
input bool        InpDebugLog        = true;                                                  // Logs detalhados

#include "includes/MR_MS_Constants.mqh"
#include "includes/MR_MS_Log.mqh"
#include "includes/MR_MS_Json.mqh"
#include "includes/MR_MS_Http.mqh"
#include "includes/MR_MS_UI.mqh"

string   g_ms_api_base_url;
string   g_ms_master_secret;
string   g_ms_symbol;
string   g_ms_side;
string   g_ms_profile;
string   g_ms_last_signal_id;
string   g_ms_last_http;
string   g_ms_last_status;
datetime g_ms_last_send_time;
int      g_ms_log_level;
bool     g_ms_send_locked;

//+------------------------------------------------------------------+
string MR_MS_SideToString(const ENUM_MS_SIDE side)
  {
   return (side == MS_SIDE_SELL ? "SELL" : "BUY");
  }

//+------------------------------------------------------------------+
string MR_MS_GenerateSignalId()
  {
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   return StringFormat(
      "master-mt5-%04d%02d%02d-%02d%02d%02d",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec
   );
  }

//+------------------------------------------------------------------+
string MR_MS_ResolveMasterSignalId()
  {
   string id = InpMasterSignalId;
   StringTrimLeft(id);
   StringTrimRight(id);
   if(StringLen(id) > 0)
      return id;
   return MR_MS_GenerateSignalId();
  }

//+------------------------------------------------------------------+
bool MR_MS_ValidateInputs(string &error_message)
  {
   if(StringLen(g_ms_api_base_url) < 8)
     {
      error_message = "InpApiBaseUrl inválida ou vazia";
      return false;
     }
   if(StringLen(g_ms_master_secret) < 4)
     {
      error_message = "InpMasterSecret vazio — informe MASTER_EA_API_SECRET";
      return false;
     }
   if(StringLen(InpSymbol) < 1)
     {
      error_message = "InpSymbol obrigatório";
      return false;
     }
   if(InpExpiresSeconds < MR_MS_MIN_EXPIRES || InpExpiresSeconds > MR_MS_MAX_EXPIRES)
     {
      error_message = "InpExpiresSeconds deve estar entre 5 e 300";
      return false;
     }
   string order_type = InpOrderType;
   StringToUpper(order_type);
   if(order_type != "MARKET" && order_type != "LIMIT" && order_type != "STOP" && order_type != "STOP_LIMIT")
     {
      error_message = "InpOrderType inválido";
      return false;
     }
   string purpose = InpPurpose;
   StringToUpper(purpose);
   if(purpose != "ENTRY" && purpose != "EXIT" && purpose != "ADJUSTMENT")
     {
      error_message = "InpPurpose inválido";
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
string MR_MS_BuildPayload(const string master_signal_id)
  {
   string side = MR_MS_SideToString(InpSide);
   string order_type = InpOrderType;
   StringToUpper(order_type);
   string purpose = InpPurpose;
   StringToUpper(purpose);
   string profile = InpProfile;
   StringTrimLeft(profile);
   StringTrimRight(profile);

   string idem = master_signal_id + "-key";

   string json = "{";
   json += MR_MS_JsonStringField("master_signal_id", master_signal_id) + ",";
   json += MR_MS_JsonStringField("source", MR_MS_SOURCE) + ",";
   json += MR_MS_JsonStringField("symbol", InpSymbol) + ",";
   json += MR_MS_JsonStringField("side", side) + ",";
   json += MR_MS_JsonStringField("order_type", order_type) + ",";
   json += MR_MS_JsonStringField("purpose", purpose) + ",";
   if(StringLen(profile) > 0)
     {
      json += MR_MS_JsonStringField("profile", profile) + ",";
     }
   json += MR_MS_JsonIntField("expires_in_seconds", InpExpiresSeconds) + ",";
   json += MR_MS_JsonStringField("idempotency_key", idem);
   json += "}";
   return json;
  }

//+------------------------------------------------------------------+
bool MR_MS_SendMasterSignal(const string reason_tag)
  {
   string err = "";
   if(!MR_MS_ValidateInputs(err))
     {
      MR_MS_LogError("Send", err);
      g_ms_last_status = err;
      MR_MS_UpdateChartComment();
      return false;
     }

   if(InpSendOnce && g_ms_send_locked)
     {
      MR_MS_LogInfo("Send", "Envio bloqueado (InpSendOnce=true) — use novo MasterSignalId ou reanexe o EA");
      g_ms_last_status = "Bloqueado (SendOnce)";
      MR_MS_UpdateChartComment();
      return false;
     }

   string master_signal_id = MR_MS_ResolveMasterSignalId();
   string payload = MR_MS_BuildPayload(master_signal_id);

   MR_MS_LogInfo("Send", "Disparo manual (" + reason_tag + ") master_signal_id=" + master_signal_id);
   MR_MS_LogInfo("Send", "POST /api/master/signals");
   if(InpDebugLog)
      MR_MS_LogDebug("Send", "Payload: " + payload);

   string response_body = "";
   int http_status = -1;
   if(!MR_MS_WebRequestPost("/api/master/signals", payload, response_body, http_status))
     {
      g_ms_last_http = "ERRO";
      g_ms_last_status = "Falha WebRequest";
      MR_MS_UpdateChartComment();
      return false;
     }

   g_ms_last_signal_id = master_signal_id;
   g_ms_last_send_time = TimeCurrent();
   g_ms_last_http = IntegerToString(http_status);
   MR_MS_LogHttpOutcome(http_status, response_body);

   if(http_status == 201 || (http_status == 200 && StringFind(response_body, "idempotent") >= 0))
     {
      g_ms_last_status = (http_status == 201 ? "Criado VALIDATED" : "Idempotente OK");
      if(InpSendOnce)
         g_ms_send_locked = true;
      MR_MS_UpdateChartComment();
      return true;
     }

   g_ms_last_status = "HTTP " + IntegerToString(http_status);
   MR_MS_UpdateChartComment();
   return false;
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_ms_api_base_url = MR_MS_NormalizeBaseUrl(InpApiBaseUrl);
   g_ms_master_secret = InpMasterSecret;
   StringTrimLeft(g_ms_master_secret);
   StringTrimRight(g_ms_master_secret);
   g_ms_symbol = InpSymbol;
   g_ms_side = MR_MS_SideToString(InpSide);
   g_ms_profile = InpProfile;
   g_ms_last_signal_id = MR_MS_ResolveMasterSignalId();
   g_ms_last_http = "—";
   g_ms_last_status = "Aguardando envio";
   g_ms_last_send_time = 0;
   g_ms_send_locked = false;
   g_ms_log_level = (InpDebugLog ? MR_MS_LOG_DEBUG : MR_MS_LOG_INFO);

   MR_MS_LogInfo("Init", MR_MS_EA_NAME + " v" + MR_MS_EA_VERSION);
   MR_MS_LogInfo("Init", "API: " + g_ms_api_base_url);
   MR_MS_LogInfo("Init", "Sem estratégia — apenas intake de MasterSignal");

   if(StringLen(g_ms_api_base_url) < 8)
     {
      MR_MS_LogError("Init", "InpApiBaseUrl inválida");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(!MR_MS_CreateSendButton())
      MR_MS_LogError("Init", "Não foi possível criar botão no gráfico");

   MR_MS_UpdateChartComment();

   if(InpSendOnInit)
     {
      MR_MS_LogInfo("Init", "InpSendOnInit=true — enviando sinal na inicialização");
      MR_MS_SendMasterSignal("OnInit");
     }
   else
     {
      MR_MS_LogInfo("Init", "Clique em 'Enviar sinal mestre' ou defina InpSendOnInit=true");
     }

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   MR_MS_DeleteSendButton();
   Comment("");
  }

//+------------------------------------------------------------------+
void OnChartEvent(
   const int id,
   const long &lparam,
   const double &dparam,
   const string &sparam
)
  {
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == MR_MS_BTN_SEND)
     {
      MR_MS_SendMasterSignal("Botao");
     }
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   // EA Mãe não opera mercado — sem lógica em OnTick.
  }

//+------------------------------------------------------------------+
