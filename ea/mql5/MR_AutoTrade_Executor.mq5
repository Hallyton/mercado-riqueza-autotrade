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
#property description "Executor licenciado com Fibo D1 local"
#property strict

input group "01 Identificacao"
input string InpApiBaseUrl      = "https://autotrade-staging.mercadodariqueza.com.br";
input string InpActivationCode  = "";
input string InpDeviceId        = "";
input string InpTradeMode       = "DEMO";
input string InpStrategyCode    = "MR_FIBO_D1_GUARD";
input ulong  InpMagicNumber     = 20260520;
input string InpSymbolOverride  = "";
input int    InpLogLevel        = 1;

input group "02 Licenca diaria"
input bool   InpRequireDailyLicenseCheck = true;
input int    InpLicenseCheckHour = 8;
input bool   InpAllowContinueIfApiFailsAfterAuthorization = true;

input group "03 Fibo D1"
input double InpPercentualFibo = 0.20;
input bool   InpPrepararNiveisAntesDaAbertura = true;
input int    InpMinutosAntesParaPreparar = 1;
input string InpHorarioApregoamento = "09:15";
input bool   InpPermitirCompra = true;
input bool   InpPermitirVenda = true;
input bool   InpPermitirReversao = false;

input group "04 Volume"
input double InpLoteTotal = 5.0;
input double InpLoteTake1 = 3.0;
input double InpLoteTake2 = 1.0;
input double InpLoteFinal = 1.0;

input group "05 Stop e alvos"
input double InpStopPontos = 7.0;
input double InpTake1Pontos = 5.0;
input double InpTake2Pontos = 10.0;
input bool   InpHabilitarBreakeven = true;
input bool   InpBreakevenAposTake1 = true;
input double InpBreakevenOffsetPontos = 0.0;
input bool   InpHabilitarTrailing = true;
input double InpTrailingTrigger = 10.0;
input double InpTrailingDistancePontos = 3.0;
input double InpTrailingStepPontos = 3.0;
input double InpTrailingOffsetPontos = 3.0;

input group "06 Horarios"
input string InpHorarioInicio = "09:15";
input string InpHorarioFimEntradas = "17:30";
input string InpHorarioZeragem = "17:30";
input bool   InpZerarNoFimDoDia = true;

input group "07 Apregoamento dinamico"
input bool   InpUsarOrdensPendentes = true;
input int    InpToleranciaEntradaTicks = 1;
input bool   InpReapregoarOrdemRejeitada = true;
input int    InpMaxTentativasPorLado = 10;
input int    InpCooldownReenvioMs = 250;
input bool   InpCancelarPontaOpostaAposEntrada = true;

input group "08 Stop financeiro local"
input bool   InpHabilitarStopFinanceiroDiario = false;
input double InpLimitePerdaDiariaReais = 0.0;
input bool   InpConsiderarPnLAberto = true;
input bool   InpBloquearNovasEntradasNoLimite = true;
input bool   InpCancelarPendentesNoLimite = true;
input bool   InpFecharPosicaoNoLimite = false;

input group "09 Seguranca local"
input int    InpMaxOperacoesDia = 2;
input int    InpMaxPerdasConsecutivas = 0;
input double InpMaxSpreadPontos = 0.0;
input int    InpSlippagePoints = 30;
input bool   InpPermitirOrdensReais = false;
input bool   InpDebugMode = true;

input group "10 Normalizacao B3"
input bool   InpForcarTickDolarB3 = true;
input double InpTickOperacionalDolar = 0.5;
input int    InpDigitosPrecoOperacional = 1;

input group "11 Visual e painel"
input bool   InpMostrarLinhas = true;
input bool   InpMostrarPainel = true;
input bool   InpMostrarStatusLicenca = true;
input bool   InpMostrarTipoOrdemCompra = true;
input bool   InpMostrarTipoOrdemVenda = true;
input bool   InpMostrarPnLDiario = true;

input group "12 Telemetria"
input bool   InpSendPreMarketOnInit = true;
input bool   InpSendPostMarketOnDeinit = false;

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
#include "includes/MR_AT_DailyRisk.mqh"
#include "includes/MR_AT_AutonomousStrategy.mqh"
#include "includes/MR_AT_OperationalCommands.mqh"

//--- Globais (compartilhadas com includes via extern)
bool   g_autonomous_strategy_site_enabled = false;
string g_api_base_url;
string g_device_id;
string g_device_token;
string g_license_id;
int    g_log_level;
bool   g_debug_mode;
#define MR_AT_BASE_TIMER_SEC 15

int    g_heartbeat_interval_sec = 30;
bool   g_halt_new_entries = true;
bool   g_halt_all_trading = false;
bool   g_can_accept_new_entries = false;
bool   g_can_manage_open_positions = false;
bool   g_subscription_active = true;
string g_configured_trade_mode = "DEMO";
datetime g_last_timer_run = 0;

bool     g_license_authorized_today = false;
string   g_authorized_trade_date = "";
datetime g_license_valid_until = 0;
datetime g_last_daily_license_check = 0;
string   g_last_daily_license_status = "PENDENTE";
string   g_last_daily_license_error = "";

//+------------------------------------------------------------------+
bool MR_AT_IsLocalFiboMode()
  {
   string code = InpStrategyCode;
   StringTrimLeft(code);
   StringTrimRight(code);
   StringToUpper(code);
   return (code == "MR_FIBO_D1_GUARD");
  }

//+------------------------------------------------------------------+
string MR_AT_ResolveDeviceId()
  {
   if(StringLen(InpDeviceId) > 0)
      return InpDeviceId;
   return "mt5-" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "-" +
          AccountInfoString(ACCOUNT_SERVER);
  }

//+------------------------------------------------------------------+
datetime MR_AT_LocalDayStart(datetime when)
  {
   MqlDateTime dt;
   TimeToStruct(when, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
  }

//+------------------------------------------------------------------+
string MR_AT_LocalTradeDate()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
  }

//+------------------------------------------------------------------+
datetime MR_AT_EndOfLocalTradeDate()
  {
   return (datetime)(MR_AT_LocalDayStart(TimeCurrent()) + 86400 - 1);
  }

//+------------------------------------------------------------------+
string MR_AT_DailyLicenseFileName()
  {
   return "mr_at_daily_license_" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + ".dat";
  }

//+------------------------------------------------------------------+
void MR_AT_SaveDailyLicenseAuthorization()
  {
   int h = FileOpen(MR_AT_DailyLicenseFileName(), FILE_WRITE | FILE_TXT | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileWriteString(h, g_authorized_trade_date + "\n" + IntegerToString((long)g_license_valid_until));
   FileClose(h);
  }

//+------------------------------------------------------------------+
void MR_AT_LoadDailyLicenseAuthorization()
  {
   if(!FileIsExist(MR_AT_DailyLicenseFileName(), FILE_COMMON))
      return;

   int h = FileOpen(MR_AT_DailyLicenseFileName(), FILE_READ | FILE_TXT | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;

   string trade_date = FileReadString(h);
   string valid_until = FileReadString(h);
   FileClose(h);
   StringTrimRight(trade_date);
   StringTrimRight(valid_until);

   string today = MR_AT_LocalTradeDate();
   datetime until = (datetime)StringToInteger(valid_until);
   if(trade_date == today && until >= TimeCurrent())
     {
      g_license_authorized_today = true;
      g_authorized_trade_date = trade_date;
      g_license_valid_until = until;
      g_last_daily_license_status = "AUTORIZADA_LOCAL";
     }
  }

//+------------------------------------------------------------------+
void MR_AT_InvalidateDailyLicenseIfTradeDateChanged()
  {
   string today = MR_AT_LocalTradeDate();
   if(g_license_authorized_today && g_authorized_trade_date != today)
     {
      g_license_authorized_today = false;
      g_license_valid_until = 0;
      g_last_daily_license_status = "PENDENTE_NOVO_PREGAO";
      g_last_daily_license_error = "";
     }
  }

//+------------------------------------------------------------------+
bool MR_AT_IsDailyLicenseAuthorizedForLocalTrading()
  {
   if(!InpRequireDailyLicenseCheck)
      return true;

   MR_AT_InvalidateDailyLicenseIfTradeDateChanged();
   return (g_license_authorized_today &&
           g_authorized_trade_date == MR_AT_LocalTradeDate() &&
           g_license_valid_until >= TimeCurrent());
  }

//+------------------------------------------------------------------+
bool MR_AT_ShouldAttemptDailyLicenseCheck(const bool force)
  {
   if(force)
      return true;
   if(g_last_daily_license_check > 0 && TimeCurrent() - g_last_daily_license_check < 60)
      return false;

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return (dt.hour >= InpLicenseCheckHour);
  }

//+------------------------------------------------------------------+
bool MR_AT_EnsureDailyLicenseAuthorization(const bool force = false)
  {
   if(!InpRequireDailyLicenseCheck)
     {
      g_license_authorized_today = true;
      g_authorized_trade_date = MR_AT_LocalTradeDate();
      g_license_valid_until = MR_AT_EndOfLocalTradeDate();
      g_last_daily_license_status = "DESABILITADA";
      return true;
     }

   MR_AT_InvalidateDailyLicenseIfTradeDateChanged();
   if(MR_AT_IsDailyLicenseAuthorizedForLocalTrading())
      return true;

   if(!MR_AT_ShouldAttemptDailyLicenseCheck(force))
      return false;

   g_last_daily_license_check = TimeCurrent();

   string response = "";
   int status = 0;
   bool ok = MR_AT_ApiGetAuth("/api/v1/ea/config", response, status);
   if(!ok || status < 200 || status >= 300)
     {
      g_last_daily_license_status = "API_INDISPONIVEL";
      g_last_daily_license_error = "HTTP=" + IntegerToString(status);
      if(InpAllowContinueIfApiFailsAfterAuthorization &&
         g_authorized_trade_date == MR_AT_LocalTradeDate() &&
         g_license_valid_until >= TimeCurrent())
        {
         g_license_authorized_today = true;
         MR_AT_LogInfo("License", "API indisponivel, mantendo autorizacao local do pregao " + g_authorized_trade_date);
         return true;
        }
      MR_AT_LogError("License", "Licenca diaria nao autorizada. " + g_last_daily_license_error);
      return false;
     }

   string license_status = MR_AT_JsonGetString(response, "license_status");
   string license_id = MR_AT_JsonGetString(response, "license_id");
   if(StringLen(license_id) > 0)
      g_license_id = license_id;

   if(license_status != "ACTIVE")
     {
      g_license_authorized_today = false;
      g_last_daily_license_status = "BLOQUEADA_" + license_status;
      g_last_daily_license_error = "license_status=" + license_status;
      MR_AT_LogError("License", "Licenca diaria bloqueada: " + g_last_daily_license_error);
      return false;
     }

   g_license_authorized_today = true;
   g_authorized_trade_date = MR_AT_LocalTradeDate();
   g_license_valid_until = MR_AT_EndOfLocalTradeDate();
   g_last_daily_license_status = "AUTORIZADA";
   g_last_daily_license_error = "";
   MR_AT_SaveDailyLicenseAuthorization();
   MR_AT_LogInfo("License", "Licenca diaria autorizada para tradeDate=" + g_authorized_trade_date);
   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_ApplyLocalFiboInputs()
  {
   MR_Fibo_ApplyDefaults(g_mr_fibo_config);
   g_mr_fibo_config.loaded = true;
   g_mr_fibo_config.version = 0;
   g_mr_fibo_config.configHash = "LOCAL_INPUTS";
   g_mr_fibo_config.percentualFibo = InpPercentualFibo;
   g_mr_fibo_config.loteTotal = InpLoteTotal;
   g_mr_fibo_config.stopPontos = InpStopPontos;
   g_mr_fibo_config.alvo1Pontos = InpTake1Pontos;
   g_mr_fibo_config.alvo2Pontos = InpTake2Pontos;
   g_mr_fibo_config.loteAlvo1 = InpLoteTake1;
   g_mr_fibo_config.loteAlvo2 = InpLoteTake2;
   g_mr_fibo_config.loteFinal = InpLoteFinal;
   g_mr_fibo_config.trailStepPontos = InpTrailingStepPontos;
   g_mr_fibo_config.trailOffsetPontos = InpTrailingOffsetPontos;
   string horario_inicio_local = InpHorarioInicio;
   StringTrimLeft(horario_inicio_local);
   StringTrimRight(horario_inicio_local);
   if(StringLen(horario_inicio_local) == 0)
      horario_inicio_local = InpHorarioApregoamento;
   g_mr_fibo_config.horarioInicio = horario_inicio_local;
   g_mr_fibo_config.horarioFimEntradas = InpHorarioFimEntradas;
   g_mr_fibo_config.horarioZeragem = InpHorarioZeragem;
   g_mr_fibo_config.zerarNoFimDoDia = InpZerarNoFimDoDia;
   g_mr_fibo_config.prepararNiveisAntesDaAbertura = InpPrepararNiveisAntesDaAbertura;
   g_mr_fibo_config.minutosAntesParaPreparar = InpMinutosAntesParaPreparar;
   g_mr_fibo_config.slippagePoints = InpSlippagePoints;
   g_mr_fibo_config.maxSpreadPontos = InpMaxSpreadPontos;
   g_mr_fibo_config.forcarTickDolarB3 = InpForcarTickDolarB3;
   g_mr_fibo_config.tickOperacionalDolar = InpTickOperacionalDolar;
   g_mr_fibo_config.digitosPrecoOperacional = InpDigitosPrecoOperacional;
   g_mr_fibo_config.bloquearTesterSeLastZero = false;
   g_mr_fibo_config.mostrarLinhasNoGrafico = InpMostrarLinhas;
   g_mr_fibo_config.mostrarPainelAdmin = InpMostrarPainel;
   g_mr_fibo_config.removerObjetosAntigos = true;
  }

//+------------------------------------------------------------------+
bool MR_AT_ValidateLocalExecutorInputs()
  {
   if(MR_AT_IsLocalFiboMode() && StringLen(InpSymbolOverride) > 0 && InpSymbolOverride != _Symbol)
     {
      MR_AT_LogError("Init", "InpSymbolOverride deve ser vazio ou igual ao simbolo do grafico neste build local.");
      return false;
     }

   if(MR_AT_IsLocalFiboMode() && InpMagicNumber == 0)
     {
      MR_AT_LogError("Init", "InpMagicNumber deve ser maior que zero.");
      return false;
     }

   if(MR_AT_GetTradeMode() == "REAL" && !InpPermitirOrdensReais)
     {
      MR_AT_LogError("Init", "REAL bloqueado: habilite InpPermitirOrdensReais conscientemente.");
      return false;
     }

   if(InpLicenseCheckHour < 0 || InpLicenseCheckHour > 23)
     {
      MR_AT_LogError("Init", "InpLicenseCheckHour deve estar entre 0 e 23.");
      return false;
     }

   if(InpMaxTentativasPorLado < 1 || InpCooldownReenvioMs < 0 || InpToleranciaEntradaTicks < 1)
     {
      MR_AT_LogError("Init", "Parametros de apregoamento dinamico invalidos.");
      return false;
     }

   if(InpHabilitarStopFinanceiroDiario && InpLimitePerdaDiariaReais <= 0.0)
     {
      MR_AT_LogError("Init", "InpLimitePerdaDiariaReais deve ser maior que zero quando stop financeiro estiver ativo.");
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
void MR_AT_UpdatePanel()
  {
   if(!InpMostrarPainel)
      return;
   string lic = (MR_AT_IsLicensed() ? "ATIVA" : "PENDENTE");
   string daily = (MR_AT_IsDailyLicenseAuthorizedForLocalTrading() ? "AUTORIZADA" : g_last_daily_license_status);
   string mode = (InpDebugMode ? "DEBUG" : "LIVE");
   string panel = "Mercado da Riqueza AutoTrade\n";
   panel += "Licenca: " + lic + " | Modo: " + mode + "\n";
   if(InpMostrarStatusLicenca)
      panel += "Licenca diaria: " + daily + " | TradeDate: " + MR_AT_LocalTradeDate() + "\n";
   panel += "Halt entradas remoto: " + (g_halt_new_entries ? "SIM" : "NAO") + "\n";
   if(MR_AT_IsLocalFiboMode())
     {
      if(InpMostrarTipoOrdemCompra)
         panel += "Compra: " + OrderTypeToText(ultimoTipoOrdemCompra) +
                  " ret=" + IntegerToString((int)ultimoRetcodeCompra) + "\n";
      if(InpMostrarTipoOrdemVenda)
         panel += "Venda: " + OrderTypeToText(ultimoTipoOrdemVenda) +
                  " ret=" + IntegerToString((int)ultimoRetcodeVenda) + "\n";
      if(InpMostrarPnLDiario)
         panel += "PnL diario local: " + DoubleToString(g_pnl_diario_local, 2) +
                  " | Stop diario: " + (g_stop_financeiro_diario_acionado ? "ACIONADO" : "OK") + "\n";
     }
   panel += "Equity: " + DoubleToString(MR_AT_GetEquity(), 2) + "\n";
   panel += "Heartbeat: " + IntegerToString(g_heartbeat_interval_sec) + "s";
   Comment(panel);
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_api_base_url = MR_AT_NormalizeBaseUrl(InpApiBaseUrl);
   g_device_id = MR_AT_ResolveDeviceId();
   g_log_level = InpLogLevel;
   g_debug_mode = InpDebugMode;

   string tm = InpTradeMode;
   StringTrimLeft(tm);
   StringTrimRight(tm);
   StringToUpper(tm);
   if(tm != "REAL")
      tm = "DEMO";
   g_configured_trade_mode = tm;
   MR_AT_LogInfo("Init", "TradeMode configurado: " + g_configured_trade_mode);

   if(!MR_AT_ValidateLocalExecutorInputs())
      return INIT_PARAMETERS_INCORRECT;

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

   MR_AT_LoadDailyLicenseAuthorization();

   if(MR_AT_IsLocalFiboMode())
     {
      MR_AT_ApplyLocalFiboInputs();
      if(!MR_AT_EnsureDailyLicenseAuthorization(true))
         MR_AT_LogInfo("Init", "Licenca diaria ainda nao autorizada; entradas ficarao bloqueadas ate validacao.");
     }
   else if(!MR_AT_FetchConfig())
      MR_AT_LogInfo("Init", "Config inicial indisponivel — tentara no proximo ciclo");

   if(MR_AT_IsLocalFiboMode())
      MR_Fibo_InitStrategy();

   EventSetTimer(MR_AT_BASE_TIMER_SEC);
   MR_AT_UpdatePanel();

   if(InpDebugMode)
      MR_AT_LogInfo("Init", "DEBUG_MODE ativo para telemetria; REAL exige InpPermitirOrdensReais=true");

   if(MR_AT_IsLicensed())
      MR_AT_ReportDailyRisk(true);

   if(InpSendPreMarketOnInit && MR_AT_GetTradeMode() == "REAL")
      MR_AT_EnsurePreMarketSnapshot();

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(MR_AT_IsLocalFiboMode())
      MR_Fibo_DeinitStrategy(reason);

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
            if(MR_AT_IsLocalFiboMode())
              {
               MR_AT_ApplyLocalFiboInputs();
               MR_AT_EnsureDailyLicenseAuthorization(true);
              }
            else
               MR_AT_FetchConfig();
            EventSetTimer(MR_AT_BASE_TIMER_SEC);
           }
         }
      if(!MR_AT_IsLicensed())
        {
         MR_AT_LogError("Timer", "Sem licença válida — gere novo código e InpActivationCode");
         return;
        }
     }

   if(!MR_AT_HeartbeatOnTimer())
     {
      MR_AT_LogError("Timer", "Heartbeat falhou");
     }

   if(MR_AT_IsLocalFiboMode())
     {
      MR_AT_EnsureDailyLicenseAuthorization(false);

      if(MR_AT_GetTradeMode() == "REAL")
         MR_AT_EnsurePreMarketSnapshot();

      MR_AT_DailyRiskOnTimer();
      MR_AT_SendOperationSnapshot(false);
      MR_AT_UpdatePanel();
      EventSetTimer(MR_AT_BASE_TIMER_SEC);
      return;
     }

   MR_AT_FetchConfig();

   if(MR_AT_GetTradeMode() == "REAL")
      MR_AT_EnsurePreMarketSnapshot();

   MR_AT_DailyRiskOnTimer();
   MR_AT_FetchAndProcessSignals();
   MR_AT_ProcessAutonomousStrategy();
   MR_AT_ManagementOnTimer();
   MR_AT_PollOperationalCommands();
   MR_AT_SendOperationSnapshot(false);
   MR_AT_UpdatePanel();

   EventSetTimer(MR_AT_BASE_TIMER_SEC);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   if(MR_AT_IsLocalFiboMode())
     {
      MR_AT_InvalidateDailyLicenseIfTradeDateChanged();
      MR_Fibo_OnTickStrategy();
     }

   if(InpMostrarPainel)
      MR_AT_UpdatePanel();
  }

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(MR_AT_IsLocalFiboMode())
      MR_Fibo_OnTradeTransactionStrategy(trans, request, result);
  }

//+------------------------------------------------------------------+
