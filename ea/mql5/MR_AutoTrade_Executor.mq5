//+------------------------------------------------------------------+
//| MR_AutoTrade_Executor.mq5                                        |
//| Mercado da Riqueza AutoTrade — EA executor licenciado (MQL5)       |
//|                                                                   |
//| Modelo caixa preta: sem lógica estratégica no cliente.            |
//| Comunicação HTTPS com a plataforma via WebRequest.                |
//|                                                                   |
//| Instalação: copie esta pasta para MetaTrader 5/Experts/           |
//| e adicione a URL da API em Ferramentas > Opções > Expert Advisors |
//+------------------------------------------------------------------+
#property copyright "Mercado da Riqueza"
#property link      "https://mercadodariqueza.com.br"
#property version   "1.00"
#property description "Executor licenciado — não parametriza estratégia"
#property strict

//--- Inputs permitidos (whitelist — sem parâmetros estratégicos)
input string InpApiBaseUrl      = "https://api.mercadodariqueza.com.br"; // URL base da API
input string InpActivationCode  = "";                                    // Código de ativação (primeira vez)
input string InpDeviceId        = "";                                    // ID do dispositivo/VPS (vazio = auto)
input bool   InpShowPanel       = true;                                  // Painel mínimo no gráfico
input int    InpLogLevel        = 1;                                     // 0=erro 1=info 2=debug
input bool   InpDebugMode       = true;                                  // true = não envia ordens reais
input bool   InpSendPreMarketOnInit = true;                              // REAL: enviar PRE_MARKET no OnInit
input bool   InpSendPostMarketOnDeinit = false;                          // REAL: enviar POST_MARKET no OnDeinit

//--- Includes modulares
#include "includes/MR_AT_Constants.mqh"
#include "includes/MR_AT_Log.mqh"
#include "includes/MR_AT_Json.mqh"
#include "includes/MR_AT_Http.mqh"
#include "includes/MR_AT_Auth.mqh"
#include "includes/MR_AT_Equity.mqh"
#include "includes/MR_AT_Position.mqh"
#include "includes/MR_AT_Orders.mqh"
#include "includes/MR_AT_Error.mqh"
#include "includes/MR_AT_License.mqh"
#include "includes/MR_AT_Heartbeat.mqh"
#include "includes/MR_AT_Execution.mqh"
#include "includes/MR_AT_Signal.mqh"
#include "includes/MR_AT_RealTrading.mqh"

//--- Globais (compartilhadas com includes via extern)
string g_api_base_url;
string g_device_id;
string g_device_token;
string g_license_id;
int    g_log_level;
bool   g_debug_mode;
int    g_heartbeat_interval_sec = 30;
bool   g_halt_new_entries = true;
bool   g_halt_all_trading = false;
bool   g_can_accept_new_entries = false;
bool   g_can_manage_open_positions = false;
bool   g_subscription_active = true;
datetime g_last_timer_run = 0;

//+------------------------------------------------------------------+
string MR_AT_ResolveDeviceId()
  {
   if(StringLen(InpDeviceId) > 0)
      return InpDeviceId;
   return "mt5-" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "-" +
          AccountInfoString(ACCOUNT_SERVER);
  }

//+------------------------------------------------------------------+
void MR_AT_UpdatePanel()
  {
   if(!InpShowPanel)
      return;
   string lic = (MR_AT_IsLicensed() ? "ATIVA" : "PENDENTE");
   string mode = (InpDebugMode ? "DEBUG" : "LIVE");
   Comment(
      "Mercado da Riqueza AutoTrade\n",
      "Licença: ", lic, " | Modo: ", mode, "\n",
      "Halt entradas: ", (g_halt_new_entries ? "SIM" : "NAO"), "\n",
      "Equity: ", DoubleToString(MR_AT_GetEquity(), 2), "\n",
      "Heartbeat: ", IntegerToString(g_heartbeat_interval_sec), "s"
   );
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_api_base_url = MR_AT_NormalizeBaseUrl(InpApiBaseUrl);
   g_device_id = MR_AT_ResolveDeviceId();
   g_log_level = InpLogLevel;
   g_debug_mode = InpDebugMode;

   MR_AT_ResetTokenRecoveryState();
   MR_AT_LogInfo("Init", MR_AT_EA_NAME + " v" + MR_AT_EA_VERSION + " iniciando");
   MR_AT_LogInfo("Init", "API base: " + g_api_base_url);

   if(StringLen(g_api_base_url) < 8)
     {
      MR_AT_LogError("Init", "InpApiBaseUrl inválida");
      return INIT_PARAMETERS_INCORRECT;
     }

   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED))
     {
      MR_AT_LogError("Init", "Permita WebRequest para URL da API nas opções do terminal");
     }

   bool has_token = MR_AT_LoadCredentials();

   if(!has_token)
     {
      if(StringLen(InpActivationCode) < 4)
        {
         MR_AT_LogError("Init", "Informe InpActivationCode (novo código do dashboard)");
         return INIT_PARAMETERS_INCORRECT;
        }
      if(!MR_AT_Activate(InpActivationCode))
        {
         MR_AT_LogError("Init", "Falha na ativação — verifique o código");
         return INIT_FAILED;
        }
     }

   if(!MR_AT_FetchConfig())
      MR_AT_LogInfo("Init", "Config inicial indisponível — tentará no próximo ciclo");

   EventSetTimer(g_heartbeat_interval_sec);
   MR_AT_UpdatePanel();

   if(InpDebugMode)
      MR_AT_LogInfo("Init", "DEBUG_MODE ativo — nenhuma ordem real será enviada");

   if(InpSendPreMarketOnInit && MR_AT_GetTradeMode() == "REAL")
      MR_AT_EnsurePreMarketSnapshot();

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(InpSendPostMarketOnDeinit && MR_AT_GetTradeMode() == "REAL")
      MR_AT_SendAccountSnapshot("POST_MARKET");

   EventKillTimer();
   Comment("");
   MR_AT_LogInfo("Deinit", "EA finalizado motivo=" + IntegerToString(reason));
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   g_last_timer_run = TimeCurrent();

   if(!MR_AT_IsLicensed())
     {
      if(StringLen(InpActivationCode) >= 4 && !MR_AT_IsTokenRecoveryExhausted())
        {
         if(MR_AT_Activate(InpActivationCode))
           {
            MR_AT_FetchConfig();
            EventSetTimer(g_heartbeat_interval_sec);
           }
         }
      if(!MR_AT_IsLicensed())
        {
         MR_AT_LogError("Timer", "Sem licença válida — gere novo código e InpActivationCode");
         return;
        }
     }

   if(!MR_AT_SendHeartbeat())
     {
      MR_AT_LogError("Timer", "Heartbeat falhou");
     }

   MR_AT_FetchConfig();
   EventSetTimer(g_heartbeat_interval_sec);

   if(MR_AT_GetTradeMode() == "REAL")
      MR_AT_EnsurePreMarketSnapshot();

   MR_AT_FetchAndProcessSignals();
   MR_AT_UpdatePanel();
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   // Ciclo principal via OnTimer (heartbeat + sinais). OnTick apenas atualiza painel.
   if(InpShowPanel)
      MR_AT_UpdatePanel();
  }

//+------------------------------------------------------------------+
