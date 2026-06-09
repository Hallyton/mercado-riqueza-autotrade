//+------------------------------------------------------------------+
//| MR_Strategy_FiboD1_Guard_Core.mqh — lógica completa Fibo D1 B3   |
//| Mercado da Riqueza — v2 Simple License Guard                      |
//+------------------------------------------------------------------+
#property strict

#include <Trade/Trade.mqh>
#include "MR_FiboD1_Config.mqh"
#include "MR_AT_Constants.mqh"
#include "MR_AT_Log.mqh"
#include "MR_AT_DailyRisk.mqh"

extern bool g_debug_mode;
extern bool g_license_authorized_today;
extern string g_authorized_trade_date;
extern datetime g_license_valid_until;

CTrade g_fibo_trade;

#define trade g_fibo_trade
#define MagicNumber ((ulong)InpMagicNumber)
#define NomeRobo "MR_FIBO_D1_GUARD"
#define PercentualFibo g_mr_fibo_config.percentualFibo
#define LoteTotal g_mr_fibo_config.loteTotal
#define StopPontos g_mr_fibo_config.stopPontos
#define Alvo1Pontos g_mr_fibo_config.alvo1Pontos
#define Alvo2Pontos g_mr_fibo_config.alvo2Pontos
#define LoteAlvo1 g_mr_fibo_config.loteAlvo1
#define LoteAlvo2 g_mr_fibo_config.loteAlvo2
#define LoteFinal g_mr_fibo_config.loteFinal
#define TrailStepPontos g_mr_fibo_config.trailStepPontos
#define TrailOffsetPontos g_mr_fibo_config.trailOffsetPontos
#define HorarioInicio g_mr_fibo_config.horarioInicio
#define HorarioFimEntradas g_mr_fibo_config.horarioFimEntradas
#define HorarioZeragem g_mr_fibo_config.horarioZeragem
#define ZerarNoFimDoDia g_mr_fibo_config.zerarNoFimDoDia
#define PrepararNiveisAntesDaAbertura g_mr_fibo_config.prepararNiveisAntesDaAbertura
#define MinutosAntesParaPreparar g_mr_fibo_config.minutosAntesParaPreparar
#define SlippagePoints g_mr_fibo_config.slippagePoints
#define MaxSpreadPontos g_mr_fibo_config.maxSpreadPontos
#define ForcarTickDolarB3 g_mr_fibo_config.forcarTickDolarB3
#define TickOperacionalDolar g_mr_fibo_config.tickOperacionalDolar
#define DigitosPrecoOperacional g_mr_fibo_config.digitosPrecoOperacional
#define MostrarLinhasNoGrafico g_mr_fibo_config.mostrarLinhasNoGrafico
#define RemoverObjetosAntigos g_mr_fibo_config.removerObjetosAntigos
#define MostrarPainelAdmin g_mr_fibo_config.mostrarPainelAdmin
#define PainelX g_mr_fibo_config.painelX
#define PainelY g_mr_fibo_config.painelY
#define CorFundoPainel clrDarkBlue
#define PermitirCompra InpPermitirCompra
#define PermitirVenda InpPermitirVenda
#define PermitirReversao InpPermitirReversao
#define HabilitarBreakeven InpHabilitarBreakeven
#define BreakevenAposTake1 InpBreakevenAposTake1
#define BreakevenOffsetPontos InpBreakevenOffsetPontos
#define HabilitarTrailing InpHabilitarTrailing
#define TrailingTrigger InpTrailingTrigger
#define TrailingDistancePontos InpTrailingDistancePontos
#define UsarOrdensPendentes InpUsarOrdensPendentes
#define ToleranciaEntradaTicks InpToleranciaEntradaTicks
#define ReapregoarOrdemRejeitada InpReapregoarOrdemRejeitada
#define MaxTentativasPorLado InpMaxTentativasPorLado
#define CooldownReenvioMs InpCooldownReenvioMs
#define CancelarPontaOpostaAposEntrada InpCancelarPontaOpostaAposEntrada

string g_fibo_trade_action = "ENTRY";

bool MR_AT_CanTradeAutonomousStrategy(
   const string side,
   const string action,
   const double requested_contracts,
   const double estimated_stop_points,
   string &block_reason
);

bool MR_AT_IsDailyLicenseAuthorizedForLocalTrading();
string MR_AT_LocalTradeDate();

bool operouCompraHoje = false;
bool operouVendaHoje = false;
bool aguardandoExecucao = false;

bool parcial1Feita = false;
bool parcial2Feita = false;
bool trailingAtivo = false;
bool temPrecoAnteriorSessao = false;
bool compraArmada = false;
bool vendaArmada = false;
bool reversaoPendente = false;
bool niveisPreparadosHoje = false;

double maxAnt = 0.0;
double minAnt = 0.0;
double amplitude = 0.0;
double fibo = 0.0;
double nivelCompra = 0.0;
double nivelVenda = 0.0;

double entradaRaw = 0.0;
double entradaOperacional = 0.0;
double bidRaw = 0.0;
double askRaw = 0.0;
double bidOperacional = 0.0;
double askOperacional = 0.0;
double stopAtual = 0.0;
double alvo1 = 0.0;
double alvo2 = 0.0;

double melhorPrecoCompra = 0.0;
double melhorPrecoVenda = 0.0;
double prevAskOp = 0.0;
double prevBidOp = 0.0;
datetime dataUltimoResetEntrada = 0;
ulong ticketTake1 = 0;
ulong ticketTake2 = 0;
ulong ticketEntradaCompra = 0;
ulong ticketEntradaVenda = 0;
int direcaoReversaoPendente = 0;
datetime horarioSolicitacaoReversao = 0;
datetime dataPreparacaoNiveis = 0;

datetime diaOperacional = 0;

double g_tick_size = 0.0;
double g_broker_tick_size = 0.0;
double g_volume_min = 0.0;
double g_volume_step = 0.0;
double g_volume_max = 0.0;

bool g_zeragem_executada_hoje = false;
datetime g_ultima_tentativa_execucao = 0;
datetime g_ultimo_log_linhas = 0;
datetime g_ultimo_log_gestao_saida_bloqueada = 0;
datetime g_ultimo_log_parcial_volume_bloqueada = 0;
long g_id_posicao_gerenciada = 0;
long g_id_execucao_logada = 0;
long g_id_log_gestao_saida_bloqueada = 0;
long g_id_log_parcial_volume_bloqueada = 0;
int g_take_log_parcial_volume_bloqueada = 0;
bool g_trade_levels_valid = false;
datetime horarioEntrada = 0;
ulong ticketEntrada = 0;
bool posicaoInicializada = false;
uint ultimaTentativaCompraMs = 0;
uint ultimaTentativaVendaMs = 0;
int tentativasCompraHoje = 0;
int tentativasVendaHoje = 0;
ENUM_ORDER_TYPE ultimoTipoOrdemCompra = ORDER_TYPE_BUY_LIMIT;
ENUM_ORDER_TYPE ultimoTipoOrdemVenda = ORDER_TYPE_SELL_LIMIT;
uint ultimoRetcodeCompra = 0;
uint ultimoRetcodeVenda = 0;
string ultimaDescricaoCompra = "";
string ultimaDescricaoVenda = "";
bool g_stop_financeiro_diario_acionado = false;
double g_pnl_diario_local = 0.0;
string g_stop_financeiro_motivo = "";

bool IsNewDay();
void ResetDailyState();
bool LoadPreviousDayLevels();
bool CarregarNiveisDiaAnterior();
void RecoverTodayState();

double NormalizarPreco(double preco);
double GetOperationalTickSize();
double GetBidRaw();
double GetAskRaw();
double GetBidOperacional();
double GetAskOperacional();
double NormalizeVolume(double volume);
bool AmbienteTesterValido();

bool IsEntryTime();
bool IsCloseTime();
datetime TodayTimeFromString(string hhmm);
int GetMinutosPreparacao();
datetime GetHorarioPreparacao();
bool IsPreparationTime();
void ExecutarPreparacaoNiveisAntesDaAbertura();
bool GarantirNiveisPreparadosAntesDeOperar();
void MarcarNiveisPreparados();

bool IsSpreadOk(double ask, double bid);

bool HasOurPosition();
bool SelectOurPosition();
bool IsBoughtPosition();
bool IsSoldPosition();

void CheckMarketEntries();
bool CheckReversalSignal();
bool ProcessarReversaoPendente();
bool FecharPosicaoAtualParaReversao();
bool EnviarCompraReversaoMercado();
bool EnviarVendaReversaoMercado();
bool PlaceEntryOrder(ENUM_POSITION_TYPE type);
ENUM_ORDER_TYPE MR_DefinirTipoOrdemCompra(double askAtual, double nivel, double tolerancia);
ENUM_ORDER_TYPE MR_DefinirTipoOrdemVenda(double bidAtual, double nivel, double tolerancia);
bool PendingEntryOrderExists(ENUM_POSITION_TYPE type);
ulong FindPendingEntryOrderTicket(ENUM_POSITION_TYPE type);
string EntryOrderComment(ENUM_POSITION_TYPE type, ENUM_ORDER_TYPE orderType);
bool IsEntryOrderCommentForSide(string comment, ENUM_POSITION_TYPE type);
bool IsOurEntryOrderComment(string comment);
string OrderTypeToText(ENUM_ORDER_TYPE orderType);
bool ShouldAttemptEntrySide(ENUM_POSITION_TYPE type);
void RegisterEntryAttemptResult(ENUM_POSITION_TYPE type, bool accepted, uint retcode, string description);
void CancelPendingEntryOrders();
void CancelPendingEntryOrder(ENUM_POSITION_TYPE type);
void CancelOppositeEntryOrder(ENUM_POSITION_TYPE type);
bool UpdateLocalDailyFinancialStop();
double CalculateLocalDailyPnl();
int CountTodayEntryDeals();
int CountConsecutiveLosingTradesToday();

void ManageOpenPosition();
void ManageBuyPosition();
void ManageSellPosition();

bool ModifyStop(double newSL);
bool PlaceTakeLimitOrders(ENUM_POSITION_TYPE type);
bool PlaceTakeLimitOrder(ENUM_POSITION_TYPE type, int takeIndex);
bool PendingTakeOrderExists(int takeIndex, ENUM_POSITION_TYPE type);
ulong FindPendingTakeOrderTicket(string comment);
string TakeLimitComment(int takeIndex, ENUM_POSITION_TYPE type);
void CancelPendingTakeOrders();
void HandleTakeLimitFill(string comment, ENUM_DEAL_TYPE dealType);

void DrawTodayTradingLevels();
void DrawOpenTradeLines();
void DrawSegmentLine(string name, datetime t1, datetime t2, double price, color clr, int width, ENUM_LINE_STYLE style);
void DrawTextLabel(string name, datetime t, double price, string text, color clr);
void DeleteOldObjects();
void PrintDailyLevels();

bool LoadSymbolProperties();
bool ValidateInputs();
bool ParseHHMM(string hhmm, int &hour, int &minute);
datetime DayStart(datetime when);
string DateStamp();
string MagicString();
bool AreLevelsValid();
bool ValidateTradingEnvironment(ENUM_POSITION_TYPE direction);
bool ValidateInitialStop(ENUM_POSITION_TYPE direction, double sl, double ask, double bid);
double BrokerStopsDistance();
bool IsAcceptedTradeRetcode(uint retcode);
double TickTolerance();
int VolumeDigits();
void SetupStateFromSelectedPosition(bool recovery);
void CalculateTradeTargets(ENUM_POSITION_TYPE type);
bool ValidateTradeTargets(ENUM_POSITION_TYPE type, double calculatedStop);
void LogOperationStarted();
void AuditOpenPosition(ENUM_POSITION_TYPE type, double expectedStop);
bool CanManageExits();
void PrintGestaoSaidasBloqueadaUmaVez();
bool DeveLogarParcialVolumeBloqueada(int takeIndex);
void PrintMarketSnapshot(string contexto);
void InferPartialStateFromVolume(double current_volume);
void ClearOpenTradeState();
bool CloseOurPositionAtMarket(string reason);
string ObjectScopeNeedle();

bool MR_Fibo_StrategyInit()
{
   g_fibo_trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(SlippagePoints);
   trade.SetTypeFillingBySymbol(_Symbol);

   if(ForcarTickDolarB3 && TickOperacionalDolar <= 0.0)
   {
      Print("TickOperacionalDolar invalido. EA bloqueado.");
      return false;
   }

   if(!LoadSymbolProperties())
      return false;

   if(!ValidateInputs())
      return false;

   Print("EA_FIBO_D1_DOLAR_B3 iniciado");
   Print("NomeRobo = ", NomeRobo);
   Print("Simbolo = ", _Symbol);
   Print("MagicNumber = ", MagicString());
   Print("Tick size operacional = ", DoubleToString(g_tick_size, DigitosPrecoOperacional));
   Print("Tick size broker = ", DoubleToString(g_broker_tick_size, 6));
   PrintFormat("CONFIG TICK: simbolo=%s tickBroker=%.6f point=%.6f tickOperacional=%.3f ForcarTickDolarB3=%s",
               _Symbol,
               SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE),
               SymbolInfoDouble(_Symbol, SYMBOL_POINT),
               GetOperationalTickSize(),
               ForcarTickDolarB3 ? "true" : "false");
   Print("Volume minimo = ", DoubleToString(g_volume_min, VolumeDigits()));
   Print("Volume step = ", DoubleToString(g_volume_step, VolumeDigits()));
   Print("Volume maximo = ", DoubleToString(g_volume_max, VolumeDigits()));
   Print("StopPontos = ", DoubleToString(StopPontos, 2));
   Print("Alvo1Pontos = ", DoubleToString(Alvo1Pontos, 2));
   Print("Alvo2Pontos = ", DoubleToString(Alvo2Pontos, 2));

   if(StringFind(_Symbol, "WDO$") >= 0 ||
      (StringLen(_Symbol) > 0 && StringSubstr(_Symbol, StringLen(_Symbol) - 1, 1) == "$"))
   {
      Print("ATENCAO: simbolo continuo/sintetico detectado. Para validacao realista, prefira testar tambem no contrato cheio do vencimento, como WDOM26, WDOQ26 etc., conforme disponivel na corretora.");
   }

   ResetDailyState();

   if(!PrepararNiveisAntesDaAbertura)
   {
      if(LoadPreviousDayLevels())
         MarcarNiveisPreparados();
      else
         Print("Nao foi possivel carregar maxima/minima do D1 anterior no OnInit. Nova tentativa sera feita no OnTick.");
   }
   else
   {
      PrintFormat("PREPARACAO: HorarioInicio=%s HorarioPreparacao=%s",
                  HorarioInicio,
                  TimeToString(GetHorarioPreparacao(), TIME_MINUTES));
      Print("PREPARACAO: aguardando primeiro tick no horario de preparacao. Nenhum calculo sera executado no OnInit.");
   }

   RecoverTodayState();

   if(MostrarLinhasNoGrafico)
      DrawTodayTradingLevels();

   PrintDailyLevels();

   return true;
}

void MR_Fibo_StrategyDeinit(const int reason)
{
   if(RemoverObjetosAntigos)
      DeleteOldObjects();

   Print("EA_FIBO_D1_DOLAR_B3 finalizado. Motivo = ", reason);
}

void MR_Fibo_StrategyOnTick()
{
   if(IsNewDay())
   {
      ResetDailyState();

      if(!PrepararNiveisAntesDaAbertura && LoadPreviousDayLevels())
      {
         MarcarNiveisPreparados();
         PrintDailyLevels();

         if(MostrarLinhasNoGrafico)
            DrawTodayTradingLevels();
      }
      else if(PrepararNiveisAntesDaAbertura)
      {
         PrintFormat("Novo dia detectado. Preparacao dos niveis aguardando HorarioPreparacao=%s",
                     TimeToString(GetHorarioPreparacao(), TIME_MINUTES));
      }
      else
      {
         Print("Novo dia detectado, mas os niveis ainda nao ficaram validos.");
      }

      RecoverTodayState();

      if(MostrarLinhasNoGrafico && AreLevelsValid())
         DrawTodayTradingLevels();
   }

   ExecutarPreparacaoNiveisAntesDaAbertura();

   if(!PrepararNiveisAntesDaAbertura && !AreLevelsValid())
   {
      if(LoadPreviousDayLevels())
      {
         MarcarNiveisPreparados();
         PrintDailyLevels();

         if(MostrarLinhasNoGrafico)
            DrawTodayTradingLevels();
      }
   }

   if(ZerarNoFimDoDia && IsCloseTime())
   {
      CancelPendingEntryOrders();

      if(HasOurPosition())
      {
         if(posicaoInicializada && !CanManageExits())
            Print("Zeragem bloqueada no tick/segundo da entrada para evitar saida imediata.");
         else
            CloseOurPositionAtMarket("Horario de zeragem");
      }

      g_zeragem_executada_hoje = true;
      return;
   }

   bool stop_financeiro_ativo = UpdateLocalDailyFinancialStop();

   if(HasOurPosition())
   {
      CancelPendingEntryOrders();

      ManageOpenPosition();

      if(MostrarLinhasNoGrafico)
         DrawOpenTradeLines();

      return;
   }

   ClearOpenTradeState();

   if(!MR_AT_IsDailyLicenseAuthorizedForLocalTrading())
   {
      CancelPendingEntryOrders();
      return;
   }

   if(stop_financeiro_ativo && InpBloquearNovasEntradasNoLimite)
   {
      CancelPendingEntryOrders();
      return;
   }

   CheckMarketEntries();
}

void MR_Fibo_StrategyOnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE && trans.order > 0)
   {
      if(HistoryOrderSelect(trans.order))
      {
         if(HistoryOrderGetString(trans.order, ORDER_SYMBOL) == _Symbol &&
            (ulong)HistoryOrderGetInteger(trans.order, ORDER_MAGIC) == MagicNumber)
         {
            string order_comment = HistoryOrderGetString(trans.order, ORDER_COMMENT);
            if(IsEntryOrderCommentForSide(order_comment, POSITION_TYPE_BUY))
            {
               if(ticketEntradaCompra == trans.order)
                  ticketEntradaCompra = 0;
               Print("Ordem de compra removida/cancelada. Ticket = ", IntegerToString((long)trans.order),
                     " Comentario = ", order_comment);
            }
            else if(IsEntryOrderCommentForSide(order_comment, POSITION_TYPE_SELL))
            {
               if(ticketEntradaVenda == trans.order)
                  ticketEntradaVenda = 0;
               Print("Ordem de venda removida/cancelada. Ticket = ", IntegerToString((long)trans.order),
                     " Comentario = ", order_comment);
            }

            if(!PendingEntryOrderExists(POSITION_TYPE_BUY) &&
               !PendingEntryOrderExists(POSITION_TYPE_SELL))
            {
               aguardandoExecucao = false;
            }
         }
      }
      return;
   }

   if(trans.type != TRADE_TRANSACTION_DEAL_ADD || trans.deal == 0)
      return;

   if(!HistoryDealSelect(trans.deal))
      return;

   if(HistoryDealGetString(trans.deal, DEAL_SYMBOL) != _Symbol)
      return;

   if((ulong)HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != MagicNumber)
      return;

   ENUM_DEAL_ENTRY deal_entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   string comment = HistoryDealGetString(trans.deal, DEAL_COMMENT);
   ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(trans.deal, DEAL_TYPE);
   ENUM_DEAL_REASON deal_reason = (ENUM_DEAL_REASON)HistoryDealGetInteger(trans.deal, DEAL_REASON);
   long position_id = (long)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   string effective_comment = comment;

   if(StringFind(effective_comment, "FIBO_D1_TAKE") < 0 && trans.order > 0 && HistoryOrderSelect(trans.order))
      effective_comment = HistoryOrderGetString(trans.order, ORDER_COMMENT);

   bool is_take_limit_fill = (StringFind(effective_comment, "FIBO_D1_TAKE") >= 0);

   if(deal_entry == DEAL_ENTRY_OUT || deal_entry == DEAL_ENTRY_OUT_BY || is_take_limit_fill)
   {
      PrintMarketSnapshot("SAIDA DETECTADA");
      PrintFormat("SAIDA DETECTADA deal=%s positionId=%s tipoDeal=%d motivo=%d preco=%s volume=%s lucro=%s comentario=%s",
                  IntegerToString((long)trans.deal),
                  IntegerToString(position_id),
                  (int)deal_type,
                  (int)deal_reason,
                  DoubleToString(HistoryDealGetDouble(trans.deal, DEAL_PRICE), _Digits),
                  DoubleToString(HistoryDealGetDouble(trans.deal, DEAL_VOLUME), VolumeDigits()),
                  DoubleToString(HistoryDealGetDouble(trans.deal, DEAL_PROFIT), 2),
                  effective_comment);

      HandleTakeLimitFill(effective_comment, deal_type);
      MR_AT_ForceDailyRiskAfterTradeEvent("exit_or_take");
      return;
   }

   if(deal_entry != DEAL_ENTRY_IN && deal_entry != DEAL_ENTRY_INOUT)
      return;

   if(deal_type == DEAL_TYPE_BUY && IsEntryOrderCommentForSide(effective_comment, POSITION_TYPE_BUY))
   {
      operouCompraHoje = true;
      aguardandoExecucao = false;
      ticketEntradaCompra = 0;
      g_id_execucao_logada = position_id;
      if(CancelarPontaOpostaAposEntrada)
         CancelOppositeEntryOrder(POSITION_TYPE_BUY);
      Print("Compra executada. Comentario = ", effective_comment);
   }

   if(deal_type == DEAL_TYPE_SELL && IsEntryOrderCommentForSide(effective_comment, POSITION_TYPE_SELL))
   {
      operouVendaHoje = true;
      aguardandoExecucao = false;
      ticketEntradaVenda = 0;
      g_id_execucao_logada = position_id;
      if(CancelarPontaOpostaAposEntrada)
         CancelOppositeEntryOrder(POSITION_TYPE_SELL);
      Print("Venda executada. Comentario = ", effective_comment);
   }

   MR_AT_ForceDailyRiskAfterTradeEvent("entry_fill");
}

bool IsNewDay()
{
   datetime hoje = DayStart(TimeCurrent());

   if(diaOperacional == 0)
   {
      diaOperacional = hoje;
      return false;
   }

   return (hoje != diaOperacional);
}

void ResetDailyState()
{
   diaOperacional = DayStart(TimeCurrent());

   if(!HasOurPosition())
   {
      CancelPendingTakeOrders();
      CancelPendingEntryOrders();
   }

   operouCompraHoje = false;
   operouVendaHoje = false;
   aguardandoExecucao = false;
   parcial1Feita = false;
   parcial2Feita = false;
   trailingAtivo = false;
   temPrecoAnteriorSessao = false;
   compraArmada = false;
   vendaArmada = false;
   reversaoPendente = false;
   niveisPreparadosHoje = false;

   maxAnt = 0.0;
   minAnt = 0.0;
   amplitude = 0.0;
   fibo = 0.0;
   nivelCompra = 0.0;
   nivelVenda = 0.0;

   entradaRaw = 0.0;
   entradaOperacional = 0.0;
   bidRaw = 0.0;
   askRaw = 0.0;
   bidOperacional = 0.0;
   askOperacional = 0.0;
   stopAtual = 0.0;
   alvo1 = 0.0;
   alvo2 = 0.0;
   melhorPrecoCompra = 0.0;
   melhorPrecoVenda = 0.0;
   prevAskOp = 0.0;
   prevBidOp = 0.0;
   dataUltimoResetEntrada = diaOperacional;
   ticketTake1 = 0;
   ticketTake2 = 0;
   ticketEntradaCompra = 0;
   ticketEntradaVenda = 0;
   ultimaTentativaCompraMs = 0;
   ultimaTentativaVendaMs = 0;
   tentativasCompraHoje = 0;
   tentativasVendaHoje = 0;
   ultimoTipoOrdemCompra = ORDER_TYPE_BUY_LIMIT;
   ultimoTipoOrdemVenda = ORDER_TYPE_SELL_LIMIT;
   ultimoRetcodeCompra = 0;
   ultimoRetcodeVenda = 0;
   ultimaDescricaoCompra = "";
   ultimaDescricaoVenda = "";
   g_stop_financeiro_diario_acionado = false;
   g_pnl_diario_local = 0.0;
   g_stop_financeiro_motivo = "";
   direcaoReversaoPendente = 0;
   horarioSolicitacaoReversao = 0;
   dataPreparacaoNiveis = 0;
   g_trade_levels_valid = false;
   horarioEntrada = 0;
   ticketEntrada = 0;
   posicaoInicializada = false;

   g_zeragem_executada_hoje = false;
   g_ultima_tentativa_execucao = 0;
   g_ultimo_log_linhas = 0;
   g_ultimo_log_gestao_saida_bloqueada = 0;
   g_ultimo_log_parcial_volume_bloqueada = 0;
   g_id_posicao_gerenciada = 0;
   g_id_execucao_logada = 0;
   g_id_log_gestao_saida_bloqueada = 0;
   g_id_log_parcial_volume_bloqueada = 0;
   g_take_log_parcial_volume_bloqueada = 0;

   if(RemoverObjetosAntigos)
      DeleteOldObjects();
}

bool LoadPreviousDayLevels()
{
   return CarregarNiveisDiaAnterior();
}

bool CarregarNiveisDiaAnterior()
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(_Symbol, PERIOD_D1, 0, 5, rates);

   if(copied < 2)
   {
      Print("ERRO: sem candles D1 suficientes para calcular maxima/minima do pregao anterior.");
      return false;
   }

   datetime dataD0 = rates[0].time;
   datetime dataD1 = rates[1].time;

   if(dataD1 == dataD0)
      Print("ALERTA: candle D1 anterior parece estar igual ao candle atual. Verificar historico D1.");

   maxAnt = rates[1].high;
   minAnt = rates[1].low;

   if(maxAnt <= 0.0 || minAnt <= 0.0)
   {
      Print("ERRO: maxima ou minima D-1 invalida.");
      return false;
   }

   if(maxAnt <= minAnt)
   {
      Print("ERRO: maxima D-1 menor ou igual a minima D-1.");
      return false;
   }

   amplitude = maxAnt - minAnt;

   if(amplitude <= 0.0)
   {
      Print("ERRO: amplitude invalida.");
      return false;
   }

   fibo = amplitude * PercentualFibo;

   double compraRaw = minAnt + fibo;
   double vendaRaw = maxAnt - fibo;

   nivelCompra = NormalizarPreco(compraRaw);
   nivelVenda = NormalizarPreco(vendaRaw);

   if(nivelCompra <= minAnt || nivelCompra >= maxAnt)
   {
      Print("ERRO: nivelCompra fora da amplitude D-1.");
      return false;
   }

   if(nivelVenda <= minAnt || nivelVenda >= maxAnt)
   {
      Print("ERRO: nivelVenda fora da amplitude D-1.");
      return false;
   }

   if(nivelCompra >= nivelVenda)
   {
      Print("ERRO: nivelCompra maior ou igual ao nivelVenda. Formula provavelmente invertida.");
      return false;
   }

   if(!AreLevelsValid())
   {
      Print("Niveis calculados invalidos. Compra = ", nivelCompra, " Venda = ", nivelVenda);
      return false;
   }

   PrintFormat("CALCULO D1 AUDITORIA symbol=%s dataAtual=%s dataD0=%s dataD1Usada=%s maxAnt=%.3f minAnt=%.3f amplitude=%.3f percentualFibo=%.2f fibo=%.3f compraRaw=%.3f vendaRaw=%.3f nivelCompra=%.3f nivelVenda=%.3f tickSize=%.3f",
               _Symbol,
               TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES),
               TimeToString(dataD0, TIME_DATE),
               TimeToString(dataD1, TIME_DATE),
               maxAnt,
               minAnt,
               amplitude,
               PercentualFibo,
               fibo,
               compraRaw,
               vendaRaw,
               nivelCompra,
               nivelVenda,
               SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE));

   PrintFormat("FORMULA: Compra = MinD1 %.3f + Fibo %.3f = %.3f | Venda = MaxD1 %.3f - Fibo %.3f = %.3f",
               minAnt,
               fibo,
               nivelCompra,
               maxAnt,
               fibo,
               nivelVenda);

   return true;
}

void RecoverTodayState()
{
   datetime inicio = diaOperacional;
   datetime fim = TimeCurrent();

   if(HistorySelect(inicio, fim))
   {
      int total = HistoryDealsTotal();

      for(int i = 0; i < total; i++)
      {
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0)
            continue;

         if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
            continue;

         if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != MagicNumber)
            continue;

         ENUM_DEAL_ENTRY deal_entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
         if(deal_entry != DEAL_ENTRY_IN && deal_entry != DEAL_ENTRY_INOUT)
            continue;

         ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal, DEAL_TYPE);

         if(deal_type == DEAL_TYPE_BUY)
            operouCompraHoje = true;

         if(deal_type == DEAL_TYPE_SELL)
            operouVendaHoje = true;
      }
   }
   else
   {
      Print("Falha ao selecionar historico do dia para recuperar estado. Erro = ", GetLastError());
   }

   if(SelectOurPosition())
   {
      SetupStateFromSelectedPosition(true);
      aguardandoExecucao = false;

      ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if(type == POSITION_TYPE_BUY)
         operouCompraHoje = true;
      else if(type == POSITION_TYPE_SELL)
         operouVendaHoje = true;

      Print("Estado recuperado com posicao aberta. EntradaRaw = ", DoubleToString(entradaRaw, _Digits),
            " EntradaOperacional = ", DoubleToString(entradaOperacional, DigitosPrecoOperacional),
            " Volume = ", DoubleToString(PositionGetDouble(POSITION_VOLUME), VolumeDigits()),
            " Stop = ", DoubleToString(stopAtual, _Digits));
   }

   ticketEntradaCompra = FindPendingEntryOrderTicket(POSITION_TYPE_BUY);
   ticketEntradaVenda = FindPendingEntryOrderTicket(POSITION_TYPE_SELL);
   if(ticketEntradaCompra > 0 || ticketEntradaVenda > 0)
   {
      aguardandoExecucao = true;
      Print("Pendentes de entrada recuperadas. CompraTicket = ",
            IntegerToString((long)ticketEntradaCompra),
            " VendaTicket = ", IntegerToString((long)ticketEntradaVenda));
   }

   UpdateLocalDailyFinancialStop();

   Print("Estado do dia recuperado. operouCompraHoje = ", operouCompraHoje,
         " operouVendaHoje = ", operouVendaHoje);
}

double NormalizarPreco(double preco)
{
   double tick_size = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tick_size == 0.0) return preco;

   return MathRound(preco / tick_size) * tick_size;
}

double GetOperationalTickSize()
{
   double tickBroker = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);

   if(tickBroker <= 0.0)
      tickBroker = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(ForcarTickDolarB3)
   {
      static bool alertPrinted = false;

      if(tickBroker > 0.0 && tickBroker < TickOperacionalDolar && !alertPrinted)
      {
         PrintFormat("ALERTA: tickSize do simbolo incompativel com WDO/DOL. tickBroker=%.6f tickOperacional=%.3f. Usando tick operacional manual.",
                     tickBroker,
                     TickOperacionalDolar);
         alertPrinted = true;
      }

      return TickOperacionalDolar;
   }

   if(tickBroker > 0.0)
      return tickBroker;

   return SymbolInfoDouble(_Symbol, SYMBOL_POINT);
}

double GetBidRaw()
{
   return SymbolInfoDouble(_Symbol, SYMBOL_BID);
}

double GetAskRaw()
{
   return SymbolInfoDouble(_Symbol, SYMBOL_ASK);
}

double GetBidOperacional()
{
   return NormalizarPreco(GetBidRaw());
}

double GetAskOperacional()
{
   return NormalizarPreco(GetAskRaw());
}

bool AmbienteTesterValido()
{
   return true;
}

double NormalizeVolume(double volume)
{
   if(volume <= 0.0)
      return 0.0;

   double min_volume = g_volume_min;
   double step = g_volume_step;
   double max_volume = g_volume_max;

   if(min_volume <= 0.0)
      min_volume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   if(step <= 0.0)
      step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(max_volume <= 0.0)
      max_volume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(step <= 0.0)
      step = min_volume;

   double capped = MathMin(volume, max_volume);
   double normalized = MathFloor((capped + 0.000000001) / step) * step;
   normalized = NormalizeDouble(normalized, VolumeDigits());

   if(normalized < min_volume - 0.000000001)
      return 0.0;

   return normalized;
}

bool IsEntryTime()
{
   if(g_zeragem_executada_hoje)
      return false;

   datetime agora = TimeCurrent();
   datetime inicio = TodayTimeFromString(HorarioInicio);
   datetime fim = TodayTimeFromString(HorarioFimEntradas);

   return (agora >= inicio && agora < fim);
}

bool IsCloseTime()
{
   datetime agora = TimeCurrent();
   datetime zeragem = TodayTimeFromString(HorarioZeragem);

   return (agora >= zeragem);
}

datetime TodayTimeFromString(string hhmm)
{
   int hour = 0;
   int minute = 0;

   if(!ParseHHMM(hhmm, hour, minute))
      return diaOperacional;

   return (datetime)(diaOperacional + (hour * 3600) + (minute * 60));
}

int GetMinutosPreparacao()
{
   int minutosPreparacao = MinutosAntesParaPreparar;

   if(minutosPreparacao < 0)
   {
      static bool aviso_impresso = false;

      if(!aviso_impresso)
      {
         Print("MinutosAntesParaPreparar invalido. Usando 1 minuto para preparacao.");
         aviso_impresso = true;
      }

      minutosPreparacao = 1;
   }

   return minutosPreparacao;
}

datetime GetHorarioPreparacao()
{
   return (datetime)(TodayTimeFromString(HorarioInicio) - (GetMinutosPreparacao() * 60));
}

bool IsPreparationTime()
{
   datetime agora = TimeCurrent();
   datetime preparacao = GetHorarioPreparacao();
   datetime inicio = TodayTimeFromString(HorarioInicio);

   return (agora >= preparacao && agora < inicio);
}

void MarcarNiveisPreparados()
{
   if(!AreLevelsValid())
      return;

   niveisPreparadosHoje = true;
   dataPreparacaoNiveis = TimeCurrent();
}

void ExecutarPreparacaoNiveisAntesDaAbertura()
{
   if(!PrepararNiveisAntesDaAbertura)
      return;

   if(niveisPreparadosHoje)
      return;

   if(!IsPreparationTime())
      return;

   datetime preparacao = GetHorarioPreparacao();
   int minutos = GetMinutosPreparacao();

   Print("PREPARACAO: horario configurado de inicio = ", HorarioInicio);
   Print("PREPARACAO: horario de preparacao = ", TimeToString(preparacao, TIME_MINUTES));
   PrintFormat("PREPARACAO: HorarioInicio=%s HorarioPreparacao=%s",
               HorarioInicio,
               TimeToString(preparacao, TIME_MINUTES));

   if(minutos == 1)
      Print("PREPARACAO: atualizando niveis 1 minuto antes da abertura operacional");
   else
      PrintFormat("PREPARACAO: atualizando niveis %d minutos antes da abertura operacional", minutos);

   if(CarregarNiveisDiaAnterior())
   {
      MarcarNiveisPreparados();
      Print("PREPARACAO: niveis atualizados com sucesso");

      if(MostrarLinhasNoGrafico)
      {
         DrawTodayTradingLevels();
         Print("PREPARACAO: linhas do grafico atualizadas");
      }

      Print("PREPARACAO: operacao bloqueada ate ", HorarioInicio);
      PrintDailyLevels();
   }
   else
   {
      Print("ERRO PREPARACAO: nao foi possivel carregar niveis do dia anterior.");
   }
}

bool GarantirNiveisPreparadosAntesDeOperar()
{
   if(niveisPreparadosHoje && AreLevelsValid())
      return true;

   if(!PrepararNiveisAntesDaAbertura && AreLevelsValid())
   {
      MarcarNiveisPreparados();
      return true;
   }

   Print("ALERTA: chegou no horario operacional sem niveis preparados. Executando preparacao emergencial.");

   if(CarregarNiveisDiaAnterior())
   {
      MarcarNiveisPreparados();

      if(MostrarLinhasNoGrafico)
      {
         DrawTodayTradingLevels();
         Print("PREPARACAO: linhas do grafico atualizadas");
      }

      Print("PREPARACAO EMERGENCIAL: niveis preparados com sucesso.");
      PrintDailyLevels();

      return true;
   }

   Print("ERRO: niveis nao preparados. Operacoes bloqueadas.");
   return false;
}

bool IsSpreadOk(double ask, double bid)
{
   if(MaxSpreadPontos <= 0.0)
      return true;

   if(ask <= 0.0 || bid <= 0.0)
      return false;

   double spread = ask - bid;

   if(spread <= MaxSpreadPontos + TickTolerance())
      return true;

   Print("Spread acima do limite. Spread = ", DoubleToString(spread, _Digits),
         " MaxSpreadPontos = ", DoubleToString(MaxSpreadPontos, _Digits));
   return false;
}

bool HasOurPosition()
{
   return SelectOurPosition();
}

bool SelectOurPosition()
{
   int total = PositionsTotal();

   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;

      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;

      if((ulong)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      return true;
   }

   return false;
}

bool IsBoughtPosition()
{
   if(!SelectOurPosition())
      return false;

   return ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
}

bool IsSoldPosition()
{
   if(!SelectOurPosition())
      return false;

   return ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL);
}

bool CheckReversalSignal()
{
   if(!PermitirReversao)
      return false;

   if(reversaoPendente)
      return false;

   if(!SelectOurPosition())
      return false;

   if(!IsEntryTime())
      return false;

   if(!GarantirNiveisPreparadosAntesDeOperar())
      return false;

   if(!AmbienteTesterValido())
      return false;

   if(!AreLevelsValid())
      return false;

   askRaw = GetAskRaw();
   bidRaw = GetBidRaw();
   askOperacional = GetAskOperacional();
   bidOperacional = GetBidOperacional();

   if(askRaw <= 0.0 || bidRaw <= 0.0 || askOperacional <= 0.0 || bidOperacional <= 0.0)
      return false;

   if(!IsSpreadOk(askRaw, bidRaw))
      return false;

   if(!temPrecoAnteriorSessao || prevAskOp <= 0.0 || prevBidOp <= 0.0)
   {
      prevAskOp = askOperacional;
      prevBidOp = bidOperacional;
      temPrecoAnteriorSessao = true;
      return false;
   }

   if(IsBoughtPosition())
   {
      bool cruzouVenda = (prevBidOp < nivelVenda && bidOperacional >= nivelVenda);

      if(cruzouVenda)
      {
         if(operouVendaHoje)
         {
            Print("REVERSAO BLOQUEADA: venda ja operada hoje. Mantendo posicao comprada.");
            prevAskOp = askOperacional;
            prevBidOp = bidOperacional;
            return false;
         }

         PrintFormat("REVERSAO COMPRA->VENDA VALIDADA: prevBidOp=%.3f bidOp=%.3f nivelVenda=%.3f",
                     prevBidOp,
                     bidOperacional,
                     nivelVenda);

         direcaoReversaoPendente = -1;
         reversaoPendente = true;
         horarioSolicitacaoReversao = TimeCurrent();

         bool fechado = FecharPosicaoAtualParaReversao();
         prevAskOp = askOperacional;
         prevBidOp = bidOperacional;

         if(!fechado)
         {
            reversaoPendente = false;
            direcaoReversaoPendente = 0;
            horarioSolicitacaoReversao = 0;
            return false;
         }

         return true;
      }
   }
   else if(IsSoldPosition())
   {
      bool cruzouCompra = (prevAskOp > nivelCompra && askOperacional <= nivelCompra);

      if(cruzouCompra)
      {
         if(operouCompraHoje)
         {
            Print("REVERSAO BLOQUEADA: compra ja operada hoje. Mantendo posicao vendida.");
            prevAskOp = askOperacional;
            prevBidOp = bidOperacional;
            return false;
         }

         PrintFormat("REVERSAO VENDA->COMPRA VALIDADA: prevAskOp=%.3f askOp=%.3f nivelCompra=%.3f",
                     prevAskOp,
                     askOperacional,
                     nivelCompra);

         direcaoReversaoPendente = 1;
         reversaoPendente = true;
         horarioSolicitacaoReversao = TimeCurrent();

         bool fechado = FecharPosicaoAtualParaReversao();
         prevAskOp = askOperacional;
         prevBidOp = bidOperacional;

         if(!fechado)
         {
            reversaoPendente = false;
            direcaoReversaoPendente = 0;
            horarioSolicitacaoReversao = 0;
            return false;
         }

         return true;
      }
   }

   prevAskOp = askOperacional;
   prevBidOp = bidOperacional;
   return false;
}

bool ProcessarReversaoPendente()
{
   if(!reversaoPendente)
      return false;

   if(direcaoReversaoPendente == -1 && operouVendaHoje)
   {
      Print("REVERSAO CANCELADA: venda ja operada hoje. Limpando estado de reversao.");
      reversaoPendente = false;
      direcaoReversaoPendente = 0;
      horarioSolicitacaoReversao = 0;
      return true;
   }

   if(direcaoReversaoPendente == 1 && operouCompraHoje)
   {
      Print("REVERSAO CANCELADA: compra ja operada hoje. Limpando estado de reversao.");
      reversaoPendente = false;
      direcaoReversaoPendente = 0;
      horarioSolicitacaoReversao = 0;
      return true;
   }

   if(direcaoReversaoPendente != -1 && direcaoReversaoPendente != 1)
   {
      Print("REVERSAO CANCELADA: direcao pendente invalida. Limpando estado de reversao.");
      reversaoPendente = false;
      direcaoReversaoPendente = 0;
      horarioSolicitacaoReversao = 0;
      return true;
   }

   if(HasOurPosition())
      return true;

   if(!IsEntryTime())
   {
      Print("REVERSAO CANCELADA: fora do horario de entradas. Limpando estado de reversao.");
      reversaoPendente = false;
      direcaoReversaoPendente = 0;
      horarioSolicitacaoReversao = 0;
      return true;
   }

   if(!GarantirNiveisPreparadosAntesDeOperar())
      return true;

   if(aguardandoExecucao)
      return true;

   bool enviada = false;

   g_fibo_trade_action = "REVERSAL";
   if(direcaoReversaoPendente == -1)
      enviada = EnviarVendaReversaoMercado();
   else if(direcaoReversaoPendente == 1)
      enviada = EnviarCompraReversaoMercado();

   if(enviada)
   {
      reversaoPendente = false;
      direcaoReversaoPendente = 0;
      horarioSolicitacaoReversao = 0;
   }

   return true;
}

bool FecharPosicaoAtualParaReversao()
{
   if(!SelectOurPosition())
      return false;

   ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
   double volume = PositionGetDouble(POSITION_VOLUME);
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   PrintFormat("FECHANDO POSICAO PARA REVERSAO tipo=%s ticket=%s volume=%s destino=%s",
               type == POSITION_TYPE_BUY ? "COMPRA" : "VENDA",
               IntegerToString((long)ticket),
               DoubleToString(volume, VolumeDigits()),
               direcaoReversaoPendente == -1 ? "VENDA" : "COMPRA");
   PrintMarketSnapshot("ANTES DE FECHAR PARA REVERSAO");

   ResetLastError();
   bool ok = trade.PositionClose(ticket, SlippagePoints);
   uint retcode = trade.ResultRetcode();

   PrintMarketSnapshot("DEPOIS DE FECHAR PARA REVERSAO");

   if(!ok || !IsAcceptedTradeRetcode(retcode))
   {
      Print("Erro ao fechar posicao para reversao. Retcode = ", retcode,
            " - ", trade.ResultRetcodeDescription(),
            " LastError = ", GetLastError());
      return false;
   }

   CancelPendingTakeOrders();
   return true;
}

bool EnviarCompraReversaoMercado()
{
   return PlaceEntryOrder(POSITION_TYPE_BUY);
}

bool EnviarVendaReversaoMercado()
{
   return PlaceEntryOrder(POSITION_TYPE_SELL);
}

ENUM_ORDER_TYPE MR_DefinirTipoOrdemCompra(double askAtual, double nivel, double tolerancia)
{
   if(MathAbs(askAtual - nivel) <= tolerancia)
      return ORDER_TYPE_BUY;
   if(askAtual > nivel)
      return ORDER_TYPE_BUY_LIMIT;
   return ORDER_TYPE_BUY_STOP;
}

ENUM_ORDER_TYPE MR_DefinirTipoOrdemVenda(double bidAtual, double nivel, double tolerancia)
{
   if(MathAbs(bidAtual - nivel) <= tolerancia)
      return ORDER_TYPE_SELL;
   if(bidAtual < nivel)
      return ORDER_TYPE_SELL_LIMIT;
   return ORDER_TYPE_SELL_STOP;
}

string OrderTypeToText(ENUM_ORDER_TYPE orderType)
{
   if(orderType == ORDER_TYPE_BUY)
      return "BUY_MARKET";
   if(orderType == ORDER_TYPE_SELL)
      return "SELL_MARKET";
   if(orderType == ORDER_TYPE_BUY_LIMIT)
      return "BUY_LIMIT";
   if(orderType == ORDER_TYPE_SELL_LIMIT)
      return "SELL_LIMIT";
   if(orderType == ORDER_TYPE_BUY_STOP)
      return "BUY_STOP";
   if(orderType == ORDER_TYPE_SELL_STOP)
      return "SELL_STOP";
   return "UNKNOWN";
}

string EntryOrderComment(ENUM_POSITION_TYPE type, ENUM_ORDER_TYPE orderType)
{
   string side = (type == POSITION_TYPE_BUY ? "BUY" : "SELL");
   string kind = "MARKET";
   if(orderType == ORDER_TYPE_BUY_LIMIT || orderType == ORDER_TYPE_SELL_LIMIT)
      kind = "LIMIT";
   else if(orderType == ORDER_TYPE_BUY_STOP || orderType == ORDER_TYPE_SELL_STOP)
      kind = "STOP";
   return "FIBO_D1_" + side + "_" + kind + "_ENTRY";
}

bool IsEntryOrderCommentForSide(string comment, ENUM_POSITION_TYPE type)
{
   if(type == POSITION_TYPE_BUY)
      return (StringFind(comment, "FIBO_D1_BUY_") >= 0 && StringFind(comment, "_ENTRY") >= 0);
   if(type == POSITION_TYPE_SELL)
      return (StringFind(comment, "FIBO_D1_SELL_") >= 0 && StringFind(comment, "_ENTRY") >= 0);
   return false;
}

bool IsOurEntryOrderComment(string comment)
{
   return (IsEntryOrderCommentForSide(comment, POSITION_TYPE_BUY) ||
           IsEntryOrderCommentForSide(comment, POSITION_TYPE_SELL));
}

ulong FindPendingEntryOrderTicket(ENUM_POSITION_TYPE type)
{
   int total = OrdersTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = OrderGetTicket(i);

      if(ticket == 0)
         continue;

      if(OrderGetString(ORDER_SYMBOL) != _Symbol)
         continue;

      if((ulong)OrderGetInteger(ORDER_MAGIC) != MagicNumber)
         continue;

      if(IsEntryOrderCommentForSide(OrderGetString(ORDER_COMMENT), type))
         return ticket;
   }

   return 0;
}

bool PendingEntryOrderExists(ENUM_POSITION_TYPE type)
{
   ulong ticket = (type == POSITION_TYPE_BUY ? ticketEntradaCompra : ticketEntradaVenda);

   if(ticket > 0 && OrderSelect(ticket))
   {
      if(OrderGetString(ORDER_SYMBOL) == _Symbol &&
         (ulong)OrderGetInteger(ORDER_MAGIC) == MagicNumber &&
         IsEntryOrderCommentForSide(OrderGetString(ORDER_COMMENT), type))
      {
         return true;
      }
   }

   ticket = FindPendingEntryOrderTicket(type);

   if(type == POSITION_TYPE_BUY)
      ticketEntradaCompra = ticket;
   else
      ticketEntradaVenda = ticket;

   return (ticket > 0);
}

bool ShouldAttemptEntrySide(ENUM_POSITION_TYPE type)
{
   int attempts = (type == POSITION_TYPE_BUY ? tentativasCompraHoje : tentativasVendaHoje);
   if(!ReapregoarOrdemRejeitada && attempts > 0)
      return false;

   if(attempts >= MaxTentativasPorLado)
      return false;

   uint nowMs = GetTickCount();
   uint lastMs = (type == POSITION_TYPE_BUY ? ultimaTentativaCompraMs : ultimaTentativaVendaMs);
   if(lastMs > 0 && nowMs - lastMs < (uint)CooldownReenvioMs)
      return false;

   return true;
}

void RegisterEntryAttemptResult(ENUM_POSITION_TYPE type, bool accepted, uint retcode, string description)
{
   uint nowMs = GetTickCount();
   if(type == POSITION_TYPE_BUY)
   {
      ultimaTentativaCompraMs = nowMs;
      ultimoRetcodeCompra = retcode;
      ultimaDescricaoCompra = description;
      if(!accepted)
         tentativasCompraHoje++;
   }
   else if(type == POSITION_TYPE_SELL)
   {
      ultimaTentativaVendaMs = nowMs;
      ultimoRetcodeVenda = retcode;
      ultimaDescricaoVenda = description;
      if(!accepted)
         tentativasVendaHoje++;
   }
}

bool PlaceEntryOrder(ENUM_POSITION_TYPE type)
{
   if(type != POSITION_TYPE_BUY && type != POSITION_TYPE_SELL)
      return false;

   if(type == POSITION_TYPE_BUY && !PermitirCompra)
      return false;

   if(type == POSITION_TYPE_SELL && !PermitirVenda)
      return false;

   if(type == POSITION_TYPE_BUY && operouCompraHoje)
      return false;

   if(type == POSITION_TYPE_SELL && operouVendaHoje)
      return false;

   if(PendingEntryOrderExists(type))
      return true;

   if(!ShouldAttemptEntrySide(type))
      return false;

   if(!AreLevelsValid())
      return false;

   if(!ValidateTradingEnvironment(type))
      return false;

   askRaw = GetAskRaw();
   bidRaw = GetBidRaw();
   askOperacional = GetAskOperacional();
   bidOperacional = GetBidOperacional();

   if(askRaw <= 0.0 || bidRaw <= 0.0 || askOperacional <= 0.0 || bidOperacional <= 0.0)
      return false;

   if(!IsSpreadOk(askRaw, bidRaw))
      return false;

   double volume = NormalizeVolume(LoteTotal);
   if(volume <= 0.0)
   {
      Print("Volume invalido para ordem limit de entrada. LoteTotal = ", DoubleToString(LoteTotal, 4));
      return false;
   }

   double tolerancia = GetOperationalTickSize() * ToleranciaEntradaTicks;

   ENUM_ORDER_TYPE orderType = ORDER_TYPE_BUY_LIMIT;
   if(type == POSITION_TYPE_BUY)
      orderType = MR_DefinirTipoOrdemCompra(askRaw, nivelCompra, tolerancia);
   else
      orderType = MR_DefinirTipoOrdemVenda(bidRaw, nivelVenda, tolerancia);

   if(type == POSITION_TYPE_BUY)
      ultimoTipoOrdemCompra = orderType;
   else
      ultimoTipoOrdemVenda = orderType;

   bool isMarket = (orderType == ORDER_TYPE_BUY || orderType == ORDER_TYPE_SELL);
   if(!isMarket && !UsarOrdensPendentes)
      return false;

   double price = isMarket
                  ? NormalizarPreco(type == POSITION_TYPE_BUY ? askRaw : bidRaw)
                  : NormalizarPreco(type == POSITION_TYPE_BUY ? nivelCompra : nivelVenda);
   double stopInicial = 0.0;
   string comment = EntryOrderComment(type, orderType);

   if(type == POSITION_TYPE_BUY)
   {
      if(orderType == ORDER_TYPE_BUY_LIMIT && price >= askRaw - tolerancia)
         return false;

      if(orderType == ORDER_TYPE_BUY_STOP && price <= askRaw + tolerancia)
         return false;

      stopInicial = NormalizarPreco(price - StopPontos);

      if(stopInicial <= 0.0 || stopInicial >= price)
      {
         Print("BUY LIMIT bloqueada: stopInicial invalido.");
         return false;
      }
   }
   else
   {
      if(orderType == ORDER_TYPE_SELL_LIMIT && price <= bidRaw + tolerancia)
         return false;

      if(orderType == ORDER_TYPE_SELL_STOP && price >= bidRaw - tolerancia)
         return false;

      stopInicial = NormalizarPreco(price + StopPontos);

      if(stopInicial <= 0.0 || stopInicial <= price)
      {
         Print("SELL LIMIT bloqueada: stopInicial invalido.");
         return false;
      }
   }

   if(isMarket && !ValidateInitialStop(type, stopInicial, askRaw, bidRaw))
      return false;

   double min_distance = BrokerStopsDistance();
   if(min_distance > 0.0 && MathAbs(price - stopInicial) < min_distance - TickTolerance())
   {
      Print("Entrada bloqueada por distancia minima entre preco e stop. Tipo = ",
            OrderTypeToText(orderType),
            " Preco = ", DoubleToString(price, _Digits),
            " Stop = ", DoubleToString(stopInicial, _Digits),
            " Minimo = ", DoubleToString(min_distance, _Digits));
      return false;
   }

   ResetLastError();

   bool ok = false;
   if(orderType == ORDER_TYPE_BUY)
      ok = trade.Buy(volume, _Symbol, 0.0, stopInicial, 0.0, comment);
   else if(orderType == ORDER_TYPE_SELL)
      ok = trade.Sell(volume, _Symbol, 0.0, stopInicial, 0.0, comment);
   else if(orderType == ORDER_TYPE_BUY_LIMIT)
      ok = trade.BuyLimit(volume, price, _Symbol, stopInicial, 0.0, ORDER_TIME_GTC, 0, comment);
   else if(orderType == ORDER_TYPE_SELL_LIMIT)
      ok = trade.SellLimit(volume, price, _Symbol, stopInicial, 0.0, ORDER_TIME_GTC, 0, comment);
   else if(orderType == ORDER_TYPE_BUY_STOP)
      ok = trade.BuyStop(volume, price, _Symbol, stopInicial, 0.0, ORDER_TIME_GTC, 0, comment);
   else if(orderType == ORDER_TYPE_SELL_STOP)
      ok = trade.SellStop(volume, price, _Symbol, stopInicial, 0.0, ORDER_TIME_GTC, 0, comment);

   uint retcode = trade.ResultRetcode();
   ulong order = trade.ResultOrder();
   ulong deal = trade.ResultDeal();
   string description = trade.ResultRetcodeDescription();
   bool accepted = (ok && IsAcceptedTradeRetcode(retcode) && (order > 0 || deal > 0 || isMarket));
   RegisterEntryAttemptResult(type, accepted, retcode, description);

   if(!accepted)
   {
      Print("Erro ao enviar ordem de entrada. Tipo = ",
            OrderTypeToText(orderType),
            " Volume = ", DoubleToString(volume, VolumeDigits()),
            " Preco = ", DoubleToString(price, _Digits),
            " Stop = ", DoubleToString(stopInicial, _Digits),
            " Retcode = ", retcode,
            " - ", description,
            " Tentativas = ", IntegerToString(type == POSITION_TYPE_BUY ? tentativasCompraHoje : tentativasVendaHoje),
            " LastError = ", GetLastError());
      return false;
   }

   if(!isMarket)
   {
      if(type == POSITION_TYPE_BUY)
         ticketEntradaCompra = order;
      else
         ticketEntradaVenda = order;
      aguardandoExecucao = true;
   }

   PrintFormat("ORDEM ENTRADA ENVIADA tipo=%s ticket=%s deal=%s volume=%s preco=%.3f stop=%.3f bid=%.3f ask=%.3f nivelCompra=%.3f nivelVenda=%.3f tolerancia=%.3f comentario=%s",
               OrderTypeToText(orderType),
               IntegerToString((long)order),
               IntegerToString((long)deal),
               DoubleToString(volume, VolumeDigits()),
               price,
               stopInicial,
               bidRaw,
               askRaw,
               nivelCompra,
               nivelVenda,
               tolerancia,
               comment);

   return true;
}

void CancelPendingEntryOrder(ENUM_POSITION_TYPE type)
{
   ulong ticket = (type == POSITION_TYPE_BUY ? ticketEntradaCompra : ticketEntradaVenda);

   if(ticket == 0)
      ticket = FindPendingEntryOrderTicket(type);

   if(ticket > 0 && OrderSelect(ticket))
   {
      ResetLastError();
      bool ok = trade.OrderDelete(ticket);
      uint retcode = trade.ResultRetcode();

      if(!ok || !IsAcceptedTradeRetcode(retcode))
      {
         Print("Falha ao cancelar ordem de entrada. Ticket = ",
               IntegerToString((long)ticket),
               " Retcode = ", retcode,
               " - ", trade.ResultRetcodeDescription(),
               " LastError = ", GetLastError());
      }
   }

   if(type == POSITION_TYPE_BUY)
      ticketEntradaCompra = 0;
   else
      ticketEntradaVenda = 0;
}

void CancelPendingEntryOrders()
{
   CancelPendingEntryOrder(POSITION_TYPE_BUY);
   CancelPendingEntryOrder(POSITION_TYPE_SELL);
}

void CancelOppositeEntryOrder(ENUM_POSITION_TYPE type)
{
   if(type == POSITION_TYPE_BUY)
      CancelPendingEntryOrder(POSITION_TYPE_SELL);
   else if(type == POSITION_TYPE_SELL)
      CancelPendingEntryOrder(POSITION_TYPE_BUY);
}

void CheckMarketEntries()
{
   g_fibo_trade_action = "ENTRY";

   if(HasOurPosition())
      return;

   if(!IsEntryTime())
   {
      CancelPendingEntryOrders();
      return;
   }

   if(!GarantirNiveisPreparadosAntesDeOperar())
      return;

   if(!AreLevelsValid())
      return;

   int operacoesHoje = CountTodayEntryDeals();
   if(InpMaxOperacoesDia > 0 && operacoesHoje >= InpMaxOperacoesDia)
   {
      CancelPendingEntryOrders();
      return;
   }

   if(InpMaxPerdasConsecutivas > 0 &&
      CountConsecutiveLosingTradesToday() >= InpMaxPerdasConsecutivas)
   {
      CancelPendingEntryOrders();
      return;
   }

   if(operouCompraHoje || !PermitirCompra)
      CancelPendingEntryOrder(POSITION_TYPE_BUY);
   else
      PlaceEntryOrder(POSITION_TYPE_BUY);

   if(operouVendaHoje || !PermitirVenda)
      CancelPendingEntryOrder(POSITION_TYPE_SELL);
   else
      PlaceEntryOrder(POSITION_TYPE_SELL);
}

double CalculateLocalDailyPnl()
{
   double pnl = 0.0;
   datetime inicio = diaOperacional;
   datetime fim = TimeCurrent();

   if(HistorySelect(inicio, fim))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0)
            continue;

         if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
            continue;

         if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != MagicNumber)
            continue;

         ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal, DEAL_TYPE);
         if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL)
            continue;

         pnl += HistoryDealGetDouble(deal, DEAL_PROFIT);
         pnl += HistoryDealGetDouble(deal, DEAL_SWAP);
         pnl += HistoryDealGetDouble(deal, DEAL_COMMISSION);
      }
   }

   if(InpConsiderarPnLAberto && SelectOurPosition())
      pnl += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);

   return pnl;
}

int CountTodayEntryDeals()
{
   int count = 0;
   if(!HistorySelect(diaOperacional, TimeCurrent()))
      return count;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;

      if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;

      if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != MagicNumber)
         continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_IN || entry == DEAL_ENTRY_INOUT)
         count++;
   }

   return count;
}

int CountConsecutiveLosingTradesToday()
{
   int streak = 0;
   if(!HistorySelect(diaOperacional, TimeCurrent()))
      return streak;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;

      if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;

      if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != MagicNumber)
         continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
         continue;

      double result = HistoryDealGetDouble(deal, DEAL_PROFIT) +
                      HistoryDealGetDouble(deal, DEAL_SWAP) +
                      HistoryDealGetDouble(deal, DEAL_COMMISSION);

      if(result < -0.000000001)
         streak++;
      else if(result > 0.000000001)
         streak = 0;
   }

   return streak;
}

bool UpdateLocalDailyFinancialStop()
{
   if(!InpHabilitarStopFinanceiroDiario || InpLimitePerdaDiariaReais <= 0.0)
   {
      g_pnl_diario_local = CalculateLocalDailyPnl();
      return false;
   }

   g_pnl_diario_local = CalculateLocalDailyPnl();
   double limite = -MathAbs(InpLimitePerdaDiariaReais);

   if(g_pnl_diario_local > limite + 0.000000001 && !g_stop_financeiro_diario_acionado)
      return false;

   if(!g_stop_financeiro_diario_acionado)
   {
      g_stop_financeiro_diario_acionado = true;
      g_stop_financeiro_motivo = "PnL diario local " + DoubleToString(g_pnl_diario_local, 2) +
                                 " <= limite " + DoubleToString(limite, 2);
      Print("STOP FINANCEIRO DIARIO LOCAL ACIONADO: ", g_stop_financeiro_motivo);
   }

   if(InpCancelarPendentesNoLimite)
      CancelPendingEntryOrders();

   if(InpFecharPosicaoNoLimite && SelectOurPosition())
      CloseOurPositionAtMarket("Stop financeiro diario local");

   return true;
}

void ManageOpenPosition()
{
   if(!SelectOurPosition())
   {
      aguardandoExecucao = false;
      return;
   }

   aguardandoExecucao = false;

   long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   if(g_id_posicao_gerenciada != position_id)
   {
      SetupStateFromSelectedPosition(false);

      if(type == POSITION_TYPE_BUY)
      {
         operouCompraHoje = true;
         if(g_id_execucao_logada != position_id)
            Print("Compra executada");
      }
      else if(type == POSITION_TYPE_SELL)
      {
         operouVendaHoje = true;
         if(g_id_execucao_logada != position_id)
            Print("Venda executada");
      }

      g_id_execucao_logada = position_id;
   }
   else
   {
      double position_sl = PositionGetDouble(POSITION_SL);
      if(position_sl > 0.0)
         stopAtual = NormalizarPreco(position_sl);

      if(entradaOperacional <= 0.0)
      {
         entradaRaw = PositionGetDouble(POSITION_PRICE_OPEN);
         entradaOperacional = NormalizarPreco(entradaRaw);
         CalculateTradeTargets(type);
      }
   }

   if(!g_trade_levels_valid)
   {
      Print("Gerenciamento bloqueado: niveis da operacao invalidos. entradaOperacional = ",
            DoubleToString(entradaOperacional, DigitosPrecoOperacional),
            " stop = ", DoubleToString(stopAtual, _Digits),
            " alvo1 = ", DoubleToString(alvo1, _Digits),
            " alvo2 = ", DoubleToString(alvo2, _Digits));
      return;
   }

   if(type == POSITION_TYPE_BUY)
      ManageBuyPosition();
   else if(type == POSITION_TYPE_SELL)
      ManageSellPosition();
}

void ManageBuyPosition()
{
   if(!SelectOurPosition())
      return;

   bidRaw = GetBidRaw();
   bidOperacional = GetBidOperacional();

   if(bidRaw <= 0.0 || bidOperacional <= 0.0)
      return;

   double current_sl = PositionGetDouble(POSITION_SL);
   if(current_sl > 0.0)
      stopAtual = NormalizarPreco(current_sl);

   if(stopAtual <= 0.0)
   {
      CalculateTradeTargets(POSITION_TYPE_BUY);

      if(stopAtual <= 0.0)
         return;

      PrintMarketSnapshot("ANTES DE MODIFY STOP");
      ModifyStop(NormalizarPreco(entradaOperacional - StopPontos));

      return;
   }

   PlaceTakeLimitOrders(POSITION_TYPE_BUY);

   if(!CanManageExits())
   {
      PrintGestaoSaidasBloqueadaUmaVez();
      return;
   }

   if(!parcial1Feita && bidOperacional >= alvo1)
   {
      PrintFormat("CHECK PARCIAL COMPRA bidRaw=%.3f bidOp=%.3f entradaOp=%.3f alvo1=%.3f alvo2=%.3f parcial1=%s parcial2=%s",
                  bidRaw,
                  bidOperacional,
                  entradaOperacional,
                  alvo1,
                  alvo2,
                  parcial1Feita ? "true" : "false",
                  parcial2Feita ? "true" : "false");
      PlaceTakeLimitOrder(POSITION_TYPE_BUY, 1);

      return;
   }

   if(parcial1Feita && !parcial2Feita && bidOperacional >= alvo2)
   {
      PrintFormat("CHECK PARCIAL COMPRA bidRaw=%.3f bidOp=%.3f entradaOp=%.3f alvo1=%.3f alvo2=%.3f parcial1=%s parcial2=%s",
                  bidRaw,
                  bidOperacional,
                  entradaOperacional,
                  alvo1,
                  alvo2,
                  parcial1Feita ? "true" : "false",
                  parcial2Feita ? "true" : "false");
      PlaceTakeLimitOrder(POSITION_TYPE_BUY, 2);

      return;
   }

   if(HabilitarTrailing && trailingAtivo)
   {
      if(TrailingTrigger > 0.0 &&
         bidOperacional - entradaOperacional < TrailingTrigger - TickTolerance())
      {
         return;
      }

      if(melhorPrecoCompra <= 0.0)
         melhorPrecoCompra = bidOperacional;

      if(bidOperacional > melhorPrecoCompra)
         melhorPrecoCompra = bidOperacional;

      double distancia = (TrailingDistancePontos > 0.0 ? TrailingDistancePontos : TrailOffsetPontos);
      double novo_stop = NormalizarPreco(melhorPrecoCompra - distancia);

      if(novo_stop >= stopAtual + TrailStepPontos - TickTolerance() && novo_stop < bidOperacional)
      {
         double stop_anterior = stopAtual;

         PrintMarketSnapshot("ANTES DE MODIFY STOP");
         stopAtual = novo_stop;
         if(ModifyStop(stopAtual))
         {
            Print("Trailing compra: Stop Loss real atualizado. Stop anterior = ",
                  DoubleToString(stop_anterior, _Digits),
                  ", Novo stop = ", DoubleToString(stopAtual, _Digits));
         }
         else
            stopAtual = stop_anterior;
      }
   }
}

void ManageSellPosition()
{
   if(!SelectOurPosition())
      return;

   askRaw = GetAskRaw();
   askOperacional = GetAskOperacional();

   if(askRaw <= 0.0 || askOperacional <= 0.0)
      return;

   double current_sl = PositionGetDouble(POSITION_SL);
   if(current_sl > 0.0)
      stopAtual = NormalizarPreco(current_sl);

   if(stopAtual <= 0.0)
   {
      CalculateTradeTargets(POSITION_TYPE_SELL);

      if(stopAtual <= 0.0)
         return;

      PrintMarketSnapshot("ANTES DE MODIFY STOP");
      ModifyStop(NormalizarPreco(entradaOperacional + StopPontos));

      return;
   }

   PlaceTakeLimitOrders(POSITION_TYPE_SELL);

   if(!CanManageExits())
   {
      PrintGestaoSaidasBloqueadaUmaVez();
      return;
   }

   if(!parcial1Feita && askOperacional <= alvo1)
   {
      PrintFormat("CHECK PARCIAL VENDA askRaw=%.3f askOp=%.3f entradaOp=%.3f alvo1=%.3f alvo2=%.3f parcial1=%s parcial2=%s",
                  askRaw,
                  askOperacional,
                  entradaOperacional,
                  alvo1,
                  alvo2,
                  parcial1Feita ? "true" : "false",
                  parcial2Feita ? "true" : "false");
      PlaceTakeLimitOrder(POSITION_TYPE_SELL, 1);

      return;
   }

   if(parcial1Feita && !parcial2Feita && askOperacional <= alvo2)
   {
      PrintFormat("CHECK PARCIAL VENDA askRaw=%.3f askOp=%.3f entradaOp=%.3f alvo1=%.3f alvo2=%.3f parcial1=%s parcial2=%s",
                  askRaw,
                  askOperacional,
                  entradaOperacional,
                  alvo1,
                  alvo2,
                  parcial1Feita ? "true" : "false",
                  parcial2Feita ? "true" : "false");
      PlaceTakeLimitOrder(POSITION_TYPE_SELL, 2);

      return;
   }

   if(HabilitarTrailing && trailingAtivo)
   {
      if(TrailingTrigger > 0.0 &&
         entradaOperacional - askOperacional < TrailingTrigger - TickTolerance())
      {
         return;
      }

      if(melhorPrecoVenda <= 0.0)
         melhorPrecoVenda = askOperacional;

      if(askOperacional < melhorPrecoVenda)
         melhorPrecoVenda = askOperacional;

      double distancia = (TrailingDistancePontos > 0.0 ? TrailingDistancePontos : TrailOffsetPontos);
      double novo_stop = NormalizarPreco(melhorPrecoVenda + distancia);

      if(novo_stop <= stopAtual - TrailStepPontos + TickTolerance() && novo_stop > askOperacional)
      {
         double stop_anterior = stopAtual;

         PrintMarketSnapshot("ANTES DE MODIFY STOP");
         stopAtual = novo_stop;
         if(ModifyStop(stopAtual))
         {
            Print("Trailing venda: Stop Loss real atualizado. Stop anterior = ",
                  DoubleToString(stop_anterior, _Digits),
                  ", Novo stop = ", DoubleToString(stopAtual, _Digits));
         }
         else
            stopAtual = stop_anterior;
      }
   }
}

bool PlaceTakeLimitOrders(ENUM_POSITION_TYPE type)
{
   if(!SelectOurPosition() || !g_trade_levels_valid)
      return false;

   bool ok = true;

   if(!parcial1Feita && LoteAlvo1 > 0.0)
      ok = PlaceTakeLimitOrder(type, 1) && ok;

   if(!parcial2Feita && LoteAlvo2 > 0.0)
      ok = PlaceTakeLimitOrder(type, 2) && ok;

   return ok;
}

bool PlaceTakeLimitOrder(ENUM_POSITION_TYPE type, int takeIndex)
{
   if(PendingTakeOrderExists(takeIndex, type))
      return true;

   double volume = NormalizeVolume(takeIndex == 1 ? LoteAlvo1 : LoteAlvo2);
   double price = NormalizarPreco(takeIndex == 1 ? alvo1 : alvo2);

   if(volume <= 0.0 || price <= 0.0)
      return true;

   double current_volume = PositionGetDouble(POSITION_VOLUME);
   double tolerance = MathMax(g_volume_step * 0.5, 0.000000001);

   if(volume >= current_volume - tolerance)
   {
      if(DeveLogarParcialVolumeBloqueada(takeIndex))
      {
         Print("Ordem limit de parcial bloqueada: volume da parcial >= volume atual. Take = ",
               takeIndex,
               " volume = ", DoubleToString(volume, VolumeDigits()),
               " volumeAtual = ", DoubleToString(current_volume, VolumeDigits()));
      }

      return false;
   }

   string comment = TakeLimitComment(takeIndex, type);

   ResetLastError();
   bool ok = false;

   if(type == POSITION_TYPE_BUY)
      ok = trade.SellLimit(volume, price, _Symbol, 0.0, 0.0, ORDER_TIME_GTC, 0, comment);
   else if(type == POSITION_TYPE_SELL)
      ok = trade.BuyLimit(volume, price, _Symbol, 0.0, 0.0, ORDER_TIME_GTC, 0, comment);
   else
      return false;

   uint retcode = trade.ResultRetcode();
   ulong order = trade.ResultOrder();

   if(!ok || !IsAcceptedTradeRetcode(retcode) || order == 0)
   {
      Print("Erro ao enviar ordem limit de parcial. Take = ", takeIndex,
            " Volume = ", DoubleToString(volume, VolumeDigits()),
            " Preco = ", DoubleToString(price, _Digits),
            " Retcode = ", retcode,
            " - ", trade.ResultRetcodeDescription(),
            " LastError = ", GetLastError());
      return false;
   }

   if(takeIndex == 1)
      ticketTake1 = order;
   else
      ticketTake2 = order;

   PrintFormat("ORDEM LIMIT TAKE %d ENVIADA tipo=%s ticket=%s volume=%s preco=%.3f comentario=%s",
               takeIndex,
               type == POSITION_TYPE_BUY ? "SELL_LIMIT" : "BUY_LIMIT",
               IntegerToString((long)order),
               DoubleToString(volume, VolumeDigits()),
               price,
               comment);

   return true;
}

bool PendingTakeOrderExists(int takeIndex, ENUM_POSITION_TYPE type)
{
   ulong ticket = (takeIndex == 1 ? ticketTake1 : ticketTake2);
   string comment = TakeLimitComment(takeIndex, type);

   if(ticket > 0 && OrderSelect(ticket))
   {
      if(OrderGetString(ORDER_SYMBOL) == _Symbol &&
         (ulong)OrderGetInteger(ORDER_MAGIC) == MagicNumber &&
         OrderGetString(ORDER_COMMENT) == comment)
      {
         return true;
      }
   }

   ticket = FindPendingTakeOrderTicket(comment);

   if(takeIndex == 1)
      ticketTake1 = ticket;
   else
      ticketTake2 = ticket;

   return (ticket > 0);
}

ulong FindPendingTakeOrderTicket(string comment)
{
   int total = OrdersTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = OrderGetTicket(i);

      if(ticket == 0)
         continue;

      if(OrderGetString(ORDER_SYMBOL) != _Symbol)
         continue;

      if((ulong)OrderGetInteger(ORDER_MAGIC) != MagicNumber)
         continue;

      if(OrderGetString(ORDER_COMMENT) == comment)
         return ticket;
   }

   return 0;
}

string TakeLimitComment(int takeIndex, ENUM_POSITION_TYPE type)
{
   string side = (type == POSITION_TYPE_BUY ? "SELL_LIMIT" : "BUY_LIMIT");
   return "FIBO_D1_TAKE" + IntegerToString(takeIndex) + "_" + side;
}

void CancelPendingTakeOrders()
{
   ulong tickets[2] = { ticketTake1, ticketTake2 };

   for(int i = 0; i < 2; i++)
   {
      ulong ticket = tickets[i];

      if(ticket == 0)
         continue;

      if(OrderSelect(ticket))
      {
         ResetLastError();
         bool ok = trade.OrderDelete(ticket);
         uint retcode = trade.ResultRetcode();

         if(!ok || !IsAcceptedTradeRetcode(retcode))
         {
            Print("Falha ao cancelar ordem limit de parcial. Ticket = ",
                  IntegerToString((long)ticket),
                  " Retcode = ", retcode,
                  " - ", trade.ResultRetcodeDescription(),
                  " LastError = ", GetLastError());
         }
      }
   }

   ticketTake1 = 0;
   ticketTake2 = 0;
}

void HandleTakeLimitFill(string comment, ENUM_DEAL_TYPE dealType)
{
   bool take1 = (StringFind(comment, "FIBO_D1_TAKE1") >= 0);
   bool take2 = (StringFind(comment, "FIBO_D1_TAKE2") >= 0);

   if(!take1 && !take2)
      return;

   Sleep(200);

   if(take1)
   {
      parcial1Feita = true;
      ticketTake1 = 0;

      if(SelectOurPosition())
      {
         ENUM_POSITION_TYPE pos_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         if(HabilitarBreakeven && BreakevenAposTake1)
         {
            if(pos_type == POSITION_TYPE_BUY)
               stopAtual = NormalizarPreco(entradaOperacional + BreakevenOffsetPontos);
            else
               stopAtual = NormalizarPreco(entradaOperacional - BreakevenOffsetPontos);

            PrintMarketSnapshot("ANTES DE MODIFY STOP");

            if(ModifyStop(stopAtual))
               Print("Take 1 limit executado. Stop real movido para entrada operacional.");
            else
               Print("Take 1 limit executado, mas falhou ao mover Stop Loss real para entrada operacional.");
         }
         else
         {
            Print("Take 1 limit executado. Breakeven desabilitado por input.");
         }
      }
   }

   if(take2)
   {
      parcial2Feita = true;
      ticketTake2 = 0;
      trailingAtivo = HabilitarTrailing;

      if(trailingAtivo)
      {
         if(dealType == DEAL_TYPE_SELL)
            melhorPrecoCompra = GetBidOperacional();
         else if(dealType == DEAL_TYPE_BUY)
            melhorPrecoVenda = GetAskOperacional();

         Print("Take 2 limit executado. Trailing real ativado.");
      }
      else
      {
         Print("Take 2 limit executado. Trailing desabilitado por input.");
      }
   }
}

bool ModifyStop(double newSL)
{
   if(!SelectOurPosition())
      return false;

   double sl = NormalizarPreco(newSL);
   if(sl <= 0.0)
   {
      Print("ModifyStop bloqueado: stop invalido = ", DoubleToString(sl, _Digits));
      return false;
   }

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double current_sl = PositionGetDouble(POSITION_SL);
   double ask = GetAskRaw();
   double bid = GetBidRaw();

   if(type == POSITION_TYPE_BUY)
   {
      if(bid <= 0.0 || sl >= bid)
      {
         Print("ModifyStop compra bloqueado. SL = ", DoubleToString(sl, _Digits),
               " Bid = ", DoubleToString(bid, _Digits));
         return false;
      }

      double min_distance = BrokerStopsDistance();
      if(min_distance > 0.0 && bid - sl < min_distance - TickTolerance())
      {
         Print("ModifyStop compra bloqueado por SYMBOL_TRADE_STOPS_LEVEL. Bid = ",
               DoubleToString(bid, _Digits),
               " SL = ", DoubleToString(sl, _Digits),
               " Distancia = ", DoubleToString(bid - sl, _Digits),
               " Minimo = ", DoubleToString(min_distance, _Digits));
         return false;
      }
   }
   else if(type == POSITION_TYPE_SELL)
   {
      if(ask <= 0.0 || sl <= ask)
      {
         Print("ModifyStop venda bloqueado. SL = ", DoubleToString(sl, _Digits),
               " Ask = ", DoubleToString(ask, _Digits));
         return false;
      }

      double min_distance = BrokerStopsDistance();
      if(min_distance > 0.0 && sl - ask < min_distance - TickTolerance())
      {
         Print("ModifyStop venda bloqueado por SYMBOL_TRADE_STOPS_LEVEL. Ask = ",
               DoubleToString(ask, _Digits),
               " SL = ", DoubleToString(sl, _Digits),
               " Distancia = ", DoubleToString(sl - ask, _Digits),
               " Minimo = ", DoubleToString(min_distance, _Digits));
         return false;
      }
   }
   else
   {
      return false;
   }

   if(current_sl > 0.0 && MathAbs(current_sl - sl) <= TickTolerance())
   {
      stopAtual = NormalizarPreco(current_sl);
      return true;
   }

   ResetLastError();
   bool ok = trade.PositionModify(_Symbol, sl, 0.0);
   uint retcode = trade.ResultRetcode();

   if(!ok || !IsAcceptedTradeRetcode(retcode))
   {
      Print("Erro ao modificar stop. SL = ", DoubleToString(sl, _Digits),
            " Retcode = ", retcode, " - ", trade.ResultRetcodeDescription(),
            " LastError = ", GetLastError());
      return false;
   }

   stopAtual = sl;
   Print("Stop atualizado para ", DoubleToString(stopAtual, _Digits));
   return true;
}

void DrawTodayTradingLevels()
{
   if(!MostrarLinhasNoGrafico || !AreLevelsValid())
      return;

   datetime t1 = TodayTimeFromString(HorarioInicio);
   datetime t2 = TodayTimeFromString(HorarioFimEntradas);
   datetime label_time = (datetime)(t1 + 5 * 60);
   string stamp = DateStamp();
   string magic = MagicString();

   string buy_name = "FIBO_D1_BUY_LEVEL_" + _Symbol + "_" + magic + "_" + stamp;
   string sell_name = "FIBO_D1_SELL_LEVEL_" + _Symbol + "_" + magic + "_" + stamp;
   string max_name = "FIBO_D1_PREV_HIGH_" + _Symbol + "_" + magic + "_" + stamp;
   string min_name = "FIBO_D1_PREV_LOW_" + _Symbol + "_" + magic + "_" + stamp;

   DrawSegmentLine(buy_name, t1, t2, nivelCompra, clrGreen, 2, STYLE_SOLID);
   DrawSegmentLine(sell_name, t1, t2, nivelVenda, clrRed, 2, STYLE_SOLID);
   DrawSegmentLine(max_name, t1, t2, maxAnt, clrGray, 1, STYLE_DOT);
   DrawSegmentLine(min_name, t1, t2, minAnt, clrGray, 1, STYLE_DOT);

   string fibo_text = DoubleToString(PercentualFibo * 100.0, 1) + "%";

   DrawTextLabel("FIBO_D1_BUY_TEXT_" + _Symbol + "_" + magic + "_" + stamp,
                 label_time,
                 nivelCompra,
                 "Compra: Min D-1 " + DoubleToString(minAnt, _Digits) +
                 " + " + fibo_text + " " + DoubleToString(fibo, _Digits) +
                 " = " + DoubleToString(nivelCompra, _Digits),
                 clrGreen);

   DrawTextLabel("FIBO_D1_SELL_TEXT_" + _Symbol + "_" + magic + "_" + stamp,
                 label_time,
                 nivelVenda,
                 "Venda: Max D-1 " + DoubleToString(maxAnt, _Digits) +
                 " - " + fibo_text + " " + DoubleToString(fibo, _Digits) +
                 " = " + DoubleToString(nivelVenda, _Digits),
                 clrRed);

   if(g_ultimo_log_linhas != diaOperacional)
   {
      Print("Linhas do dia atual atualizadas");
      Print("NivelCompra = ", DoubleToString(nivelCompra, _Digits));
      Print("NivelVenda = ", DoubleToString(nivelVenda, _Digits));
      g_ultimo_log_linhas = diaOperacional;
   }

   ChartRedraw(0);
}

void DrawOpenTradeLines()
{
   if(!MostrarLinhasNoGrafico || !SelectOurPosition())
      return;

   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   if(entradaOperacional <= 0.0)
   {
      entradaRaw = PositionGetDouble(POSITION_PRICE_OPEN);
      entradaOperacional = NormalizarPreco(entradaRaw);
   }

   double position_sl = PositionGetDouble(POSITION_SL);
   if(position_sl > 0.0)
      stopAtual = NormalizarPreco(position_sl);

   CalculateTradeTargets(type);

   datetime t1 = TodayTimeFromString(HorarioInicio);
   datetime t2 = TodayTimeFromString(HorarioZeragem);
   string stamp = DateStamp();
   string magic = MagicString();

   DrawSegmentLine("FIBO_D1_ENTRY_" + _Symbol + "_" + magic + "_" + stamp,
                   t1, t2, entradaOperacional, clrBlue, 1, STYLE_SOLID);

   if(stopAtual > 0.0)
   {
      DrawSegmentLine("FIBO_D1_STOP_" + _Symbol + "_" + magic + "_" + stamp,
                      t1, t2, stopAtual, clrOrange, 2, STYLE_DASH);
   }

   DrawSegmentLine("FIBO_D1_TARGET1_" + _Symbol + "_" + magic + "_" + stamp,
                   t1, t2, alvo1, clrAqua, 1, STYLE_DASH);

   DrawSegmentLine("FIBO_D1_TARGET2_" + _Symbol + "_" + magic + "_" + stamp,
                   t1, t2, alvo2, clrMagenta, 1, STYLE_DASH);

   ChartRedraw(0);
}

void DrawSegmentLine(string name, datetime t1, datetime t2, double price, color clr, int width, ENUM_LINE_STYLE style)
{
   double normalized_price = NormalizarPreco(price);

   if(ObjectFind(0, name) < 0)
   {
      if(!ObjectCreate(0, name, OBJ_TREND, 0, t1, normalized_price, t2, normalized_price))
      {
         Print("Falha ao criar linha ", name, ". Erro = ", GetLastError());
         return;
      }
   }
   else
   {
      ObjectMove(0, name, 0, t1, normalized_price);
      ObjectMove(0, name, 1, t2, normalized_price);
   }

   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_RAY_LEFT, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
}

void DrawTextLabel(string name, datetime t, double price, string text, color clr)
{
   double normalized_price = NormalizarPreco(price);

   if(ObjectFind(0, name) < 0)
   {
      if(!ObjectCreate(0, name, OBJ_TEXT, 0, t, normalized_price))
      {
         Print("Falha ao criar texto ", name, ". Erro = ", GetLastError());
         return;
      }
   }
   else
   {
      ObjectMove(0, name, 0, t, normalized_price);
   }

   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
}

void DeleteOldObjects()
{
   string needle = ObjectScopeNeedle();
   int total = ObjectsTotal(0, 0, -1);

   for(int i = total - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i, 0, -1);

      if(StringFind(name, "FIBO_D1_") == 0 && StringFind(name, needle) >= 0)
         ObjectDelete(0, name);
   }
}

void PrintDailyLevels()
{
   if(!AreLevelsValid())
      return;

   Print("Data = ", TimeToString(diaOperacional, TIME_DATE));
   Print("Maxima anterior = ", DoubleToString(maxAnt, _Digits));
   Print("Minima anterior = ", DoubleToString(minAnt, _Digits));
   Print("Amplitude = ", DoubleToString(amplitude, _Digits));
   Print("Fibo ", DoubleToString(PercentualFibo * 100.0, 1), "% = ", DoubleToString(fibo, _Digits));
   Print("Nivel de compra = ", DoubleToString(nivelCompra, _Digits));
   Print("Nivel de venda = ", DoubleToString(nivelVenda, _Digits));
}

bool LoadSymbolProperties()
{
   g_broker_tick_size = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   g_tick_size = GetOperationalTickSize();
   g_volume_min = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   g_volume_step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   g_volume_max = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(g_tick_size <= 0.0)
   {
      Print("Tick operacional invalido para o simbolo ", _Symbol);
      return false;
   }

   if(g_volume_min <= 0.0 || g_volume_step <= 0.0 || g_volume_max <= 0.0)
   {
      Print("Propriedades de volume invalidas para o simbolo ", _Symbol);
      return false;
   }

   return true;
}

bool ValidateInputs()
{
   int hInicio = 0;
   int mInicio = 0;
   int hFim = 0;
   int mFim = 0;
   int hZeragem = 0;
   int mZeragem = 0;
   double operational_tick = GetOperationalTickSize();

   if(!ParseHHMM(HorarioInicio, hInicio, mInicio) ||
      !ParseHHMM(HorarioFimEntradas, hFim, mFim) ||
      !ParseHHMM(HorarioZeragem, hZeragem, mZeragem))
   {
      Print("Horario invalido. Use o formato HH:MM.");
      return false;
   }

   int inicioMin = hInicio * 60 + mInicio;
   int fimMin = hFim * 60 + mFim;
   int zeragemMin = hZeragem * 60 + mZeragem;
   if(inicioMin >= fimMin || fimMin > zeragemMin)
   {
      Print("Horarios invalidos. Exigido: HorarioInicio < HorarioFimEntradas <= HorarioZeragem.");
      return false;
   }

   if(PercentualFibo <= 0.0 || PercentualFibo >= 1.0)
   {
      Print("PercentualFibo deve ser maior que 0 e menor que 1. Exemplo: 0.20 para 20%.");
      return false;
   }

   if(LoteTotal <= 0.0 || StopPontos <= 0.0 || Alvo1Pontos <= 0.0 || Alvo2Pontos <= 0.0)
   {
      Print("LoteTotal, StopPontos, Alvo1Pontos e Alvo2Pontos devem ser maiores que zero.");
      return false;
   }

   if(ForcarTickDolarB3 && TickOperacionalDolar <= 0.0)
   {
      Print("TickOperacionalDolar deve ser maior que zero quando ForcarTickDolarB3 estiver true.");
      return false;
   }

   if(DigitosPrecoOperacional < 0 || DigitosPrecoOperacional > 8)
   {
      Print("DigitosPrecoOperacional deve estar entre 0 e 8.");
      return false;
   }

   if(operational_tick <= 0.0)
   {
      Print("Tick operacional invalido.");
      return false;
   }

   if(StopPontos < operational_tick)
   {
      Print("StopPontos menor que o tick operacional. EA bloqueado. StopPontos = ",
            DoubleToString(StopPontos, DigitosPrecoOperacional),
            " Tick = ", DoubleToString(operational_tick, DigitosPrecoOperacional));
      return false;
   }

   if(Alvo1Pontos < operational_tick)
   {
      Print("Alvo1Pontos menor que o tick operacional. EA bloqueado. Alvo1Pontos = ",
            DoubleToString(Alvo1Pontos, DigitosPrecoOperacional),
            " Tick = ", DoubleToString(operational_tick, DigitosPrecoOperacional));
      return false;
   }

   if(Alvo2Pontos <= Alvo1Pontos)
   {
      Print("Alvo2Pontos deve ser maior que Alvo1Pontos. EA bloqueado.");
      return false;
   }

   if(LoteAlvo1 < 0.0 || LoteAlvo2 < 0.0 || LoteFinal < 0.0)
   {
      Print("Volumes de parciais e lote final nao podem ser negativos.");
      return false;
   }

   if(LoteAlvo1 + LoteAlvo2 > LoteTotal + 0.000000001)
   {
      Print("LoteAlvo1 + LoteAlvo2 nao pode ser maior que LoteTotal.");
      return false;
   }

   if(MathAbs((LoteAlvo1 + LoteAlvo2 + LoteFinal) - LoteTotal) > 0.000000001)
   {
      Print("LoteAlvo1 + LoteAlvo2 + LoteFinal deve ser igual a LoteTotal.");
      return false;
   }

   if(NormalizeVolume(LoteTotal) <= 0.0)
   {
      Print("LoteTotal nao e valido para o simbolo.");
      return false;
   }

   if(HabilitarTrailing && (TrailStepPontos <= 0.0 || TrailOffsetPontos <= 0.0 || TrailingDistancePontos <= 0.0))
   {
      Print("Parametros de trailing devem ser maiores que zero quando trailing estiver habilitado.");
      return false;
   }

   if(SlippagePoints < 0)
   {
      Print("SlippagePoints nao pode ser negativo.");
      return false;
   }

   return true;
}

bool ParseHHMM(string hhmm, int &hour, int &minute)
{
   int colon = StringFind(hhmm, ":");

   if(colon <= 0)
      return false;

   string h_text = StringSubstr(hhmm, 0, colon);
   string m_text = StringSubstr(hhmm, colon + 1);

   if(StringLen(h_text) < 1 || StringLen(m_text) < 1)
      return false;

   hour = (int)StringToInteger(h_text);
   minute = (int)StringToInteger(m_text);

   return (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59);
}

datetime DayStart(datetime when)
{
   MqlDateTime parts;
   TimeToStruct(when, parts);
   parts.hour = 0;
   parts.min = 0;
   parts.sec = 0;
   return StructToTime(parts);
}

string DateStamp()
{
   MqlDateTime parts;
   TimeToStruct(diaOperacional, parts);
   return StringFormat("%04d%02d%02d", parts.year, parts.mon, parts.day);
}

string MagicString()
{
   return IntegerToString((long)MagicNumber);
}

bool AreLevelsValid()
{
   return (maxAnt > 0.0 &&
           minAnt > 0.0 &&
           amplitude > 0.0 &&
           nivelCompra > 0.0 &&
           nivelVenda > 0.0 &&
           nivelCompra < nivelVenda);
}

bool ValidateTradingEnvironment(ENUM_POSITION_TYPE direction)
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("AutoTrading desabilitado no terminal.");
      return false;
   }

   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("Trading nao permitido para este Expert Advisor.");
      return false;
   }

   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
   {
      Print("Trading nao permitido para esta conta.");
      return false;
   }

   ENUM_SYMBOL_TRADE_MODE trade_mode = (ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE);

   if(trade_mode == SYMBOL_TRADE_MODE_DISABLED || trade_mode == SYMBOL_TRADE_MODE_CLOSEONLY)
   {
      Print("Simbolo nao esta negociavel para novas entradas. Trade mode = ", trade_mode);
      return false;
   }

   if(direction == POSITION_TYPE_BUY && trade_mode == SYMBOL_TRADE_MODE_SHORTONLY)
   {
      Print("Simbolo permite apenas venda.");
      return false;
   }

   if(direction == POSITION_TYPE_SELL && trade_mode == SYMBOL_TRADE_MODE_LONGONLY)
   {
      Print("Simbolo permite apenas compra.");
      return false;
   }

   return true;
}

bool ValidateInitialStop(ENUM_POSITION_TYPE direction, double sl, double ask, double bid)
{
   if(sl <= 0.0)
   {
      if(direction == POSITION_TYPE_BUY)
         Print("Compra bloqueada: stop inicial invalido. Ask = ", DoubleToString(ask, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
      else
         Print("Venda bloqueada: stop inicial invalido. Bid = ", DoubleToString(bid, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
      return false;
   }

   double min_distance = BrokerStopsDistance();

   if(direction == POSITION_TYPE_BUY)
   {
      if(sl >= ask)
      {
         Print("Compra bloqueada: stop inicial invalido. Ask = ", DoubleToString(ask, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
         return false;
      }

      if(sl >= bid)
      {
         Print("Compra bloqueada: stop inicial invalido para o lado da operacao. Bid = ",
               DoubleToString(bid, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
         return false;
      }

      if(min_distance > 0.0 && bid - sl < min_distance - TickTolerance())
      {
         Print("Compra bloqueada: stop inicial desrespeita SYMBOL_TRADE_STOPS_LEVEL. Bid = ",
               DoubleToString(bid, _Digits),
               " SL = ", DoubleToString(sl, _Digits),
               " Distancia = ", DoubleToString(bid - sl, _Digits),
               " Minimo = ", DoubleToString(min_distance, _Digits));
         return false;
      }
   }
   else if(direction == POSITION_TYPE_SELL)
   {
      if(sl <= bid)
      {
         Print("Venda bloqueada: stop inicial invalido. Bid = ", DoubleToString(bid, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
         return false;
      }

      if(sl <= ask)
      {
         Print("Venda bloqueada: stop inicial invalido para o lado da operacao. Ask = ",
               DoubleToString(ask, _Digits),
               " SL = ", DoubleToString(sl, _Digits));
         return false;
      }

      if(min_distance > 0.0 && sl - ask < min_distance - TickTolerance())
      {
         Print("Venda bloqueada: stop inicial desrespeita SYMBOL_TRADE_STOPS_LEVEL. Ask = ",
               DoubleToString(ask, _Digits),
               " SL = ", DoubleToString(sl, _Digits),
               " Distancia = ", DoubleToString(sl - ask, _Digits),
               " Minimo = ", DoubleToString(min_distance, _Digits));
         return false;
      }
   }
   else
   {
      return false;
   }

   return true;
}

double BrokerStopsDistance()
{
   long stops_level = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);

   if(stops_level <= 0)
      return 0.0;

   return (double)stops_level * _Point;
}

bool IsAcceptedTradeRetcode(uint retcode)
{
   return (retcode == TRADE_RETCODE_DONE ||
           retcode == TRADE_RETCODE_DONE_PARTIAL ||
           retcode == TRADE_RETCODE_PLACED);
}

double TickTolerance()
{
   if(g_tick_size > 0.0)
      return g_tick_size * 0.5;

   return _Point * 0.5;
}

int VolumeDigits()
{
   double step = g_volume_step;

   if(step <= 0.0)
      step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   int digits = 0;
   double value = step;

   while(digits < 8 && MathAbs(value - MathRound(value)) > 0.000000001)
   {
      value *= 10.0;
      digits++;
   }

   return digits;
}

void SetupStateFromSelectedPosition(bool recovery)
{
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   ulong position_ticket = (ulong)PositionGetInteger(POSITION_TICKET);
   datetime position_time = (datetime)PositionGetInteger(POSITION_TIME);

   entradaRaw = PositionGetDouble(POSITION_PRICE_OPEN);
   entradaOperacional = NormalizarPreco(entradaRaw);
   double position_sl = NormalizarPreco(PositionGetDouble(POSITION_SL));

   stopAtual = 0.0;
   CalculateTradeTargets(type);
   double stop_calculado_pela_entrada = stopAtual;

   InferPartialStateFromVolume(PositionGetDouble(POSITION_VOLUME));

   long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
   g_id_posicao_gerenciada = position_id;

   if(recovery)
      g_id_execucao_logada = position_id;

   if(!posicaoInicializada || ticketEntrada != position_ticket)
   {
      horarioEntrada = (recovery && position_time > 0 ? position_time : TimeCurrent());
      ticketEntrada = position_ticket;
      posicaoInicializada = true;
   }

   if(type == POSITION_TYPE_BUY)
   {
      if(trailingAtivo && melhorPrecoCompra <= 0.0)
         melhorPrecoCompra = GetBidOperacional();

      if(parcial1Feita && position_sl > 0.0)
         stopAtual = position_sl;
   }
   else if(type == POSITION_TYPE_SELL)
   {
      if(trailingAtivo && melhorPrecoVenda <= 0.0)
         melhorPrecoVenda = GetAskOperacional();

      if(parcial1Feita && position_sl > 0.0)
         stopAtual = position_sl;
   }

   if(g_trade_levels_valid && SelectOurPosition())
   {
      PrintMarketSnapshot("DEPOIS DA ENTRADA");
      LogOperationStarted();
      PlaceTakeLimitOrders(type);

      if(!parcial1Feita)
         AuditOpenPosition(type, stop_calculado_pela_entrada);
   }
}

void CalculateTradeTargets(ENUM_POSITION_TYPE type)
{
   g_trade_levels_valid = false;

   if(entradaOperacional <= 0.0)
      return;

   if(type == POSITION_TYPE_BUY)
   {
      double calculated_stop = NormalizarPreco(entradaOperacional - StopPontos);

      if(stopAtual <= 0.0)
         stopAtual = calculated_stop;

      alvo1 = NormalizarPreco(entradaOperacional + Alvo1Pontos);
      alvo2 = NormalizarPreco(entradaOperacional + Alvo2Pontos);
      g_trade_levels_valid = ValidateTradeTargets(type, calculated_stop);
   }
   else if(type == POSITION_TYPE_SELL)
   {
      double calculated_stop = NormalizarPreco(entradaOperacional + StopPontos);

      if(stopAtual <= 0.0)
         stopAtual = calculated_stop;

      alvo1 = NormalizarPreco(entradaOperacional - Alvo1Pontos);
      alvo2 = NormalizarPreco(entradaOperacional - Alvo2Pontos);
      g_trade_levels_valid = ValidateTradeTargets(type, calculated_stop);
   }
}

bool ValidateTradeTargets(ENUM_POSITION_TYPE type, double calculatedStop)
{
   double tolerance = TickTolerance();
   double tickSize = GetOperationalTickSize();

   if(tickSize <= 0.0)
      tickSize = _Point;

   if(type == POSITION_TYPE_BUY)
   {
      double distanciaStop = entradaOperacional - calculatedStop;
      double distanciaAlvo1 = alvo1 - entradaOperacional;
      double distanciaAlvo2 = alvo2 - entradaOperacional;

      if(calculatedStop >= entradaOperacional - tolerance)
      {
         Print("ERRO CRITICO: stop de compra invalido. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " stopAtual = ", DoubleToString(calculatedStop, _Digits));
         return false;
      }

      if(MathAbs(distanciaStop - StopPontos) > tickSize)
      {
         Print("ERRO CRITICO: stop de compra com distancia incorreta. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " stopAtual = ", DoubleToString(calculatedStop, _Digits),
               " distancia = ", DoubleToString(distanciaStop, _Digits),
               " StopPontos = ", DoubleToString(StopPontos, _Digits),
               " tickSize = ", DoubleToString(tickSize, _Digits));
         return false;
      }

      if(alvo1 <= entradaOperacional + tolerance)
      {
         Print("ERRO CRITICO: alvo1 de compra invalido. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " alvo1 = ", DoubleToString(alvo1, _Digits),
               " tickSize = ", DoubleToString(g_tick_size, _Digits));
         return false;
      }

      if(MathAbs(distanciaAlvo1 - Alvo1Pontos) > tickSize)
      {
         Print("ERRO CRITICO: alvo1 de compra com distancia incorreta. distancia = ",
               DoubleToString(distanciaAlvo1, _Digits),
               " Alvo1Pontos = ", DoubleToString(Alvo1Pontos, _Digits));
         return false;
      }

      if(alvo2 <= alvo1 + tolerance)
      {
         Print("ERRO CRITICO: alvo2 de compra invalido. alvo1 = ",
               DoubleToString(alvo1, _Digits),
               " alvo2 = ", DoubleToString(alvo2, _Digits));
         return false;
      }

      if(MathAbs(distanciaAlvo2 - Alvo2Pontos) > tickSize)
      {
         Print("ERRO CRITICO: alvo2 de compra com distancia incorreta. distancia = ",
               DoubleToString(distanciaAlvo2, _Digits),
               " Alvo2Pontos = ", DoubleToString(Alvo2Pontos, _Digits));
         return false;
      }

      return true;
   }

   if(type == POSITION_TYPE_SELL)
   {
      double distanciaStop = calculatedStop - entradaOperacional;
      double distanciaAlvo1 = entradaOperacional - alvo1;
      double distanciaAlvo2 = entradaOperacional - alvo2;

      if(calculatedStop <= entradaOperacional + tolerance)
      {
         Print("ERRO CRITICO: stop de venda invalido. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " stopAtual = ", DoubleToString(calculatedStop, _Digits));
         return false;
      }

      if(MathAbs(distanciaStop - StopPontos) > tickSize)
      {
         Print("ERRO CRITICO: stop de venda com distancia incorreta. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " stopAtual = ", DoubleToString(calculatedStop, _Digits),
               " distancia = ", DoubleToString(distanciaStop, _Digits),
               " StopPontos = ", DoubleToString(StopPontos, _Digits),
               " tickSize = ", DoubleToString(tickSize, _Digits));
         return false;
      }

      if(alvo1 >= entradaOperacional - tolerance)
      {
         Print("ERRO CRITICO: alvo1 de venda invalido. entradaOperacional = ",
               DoubleToString(entradaOperacional, DigitosPrecoOperacional),
               " alvo1 = ", DoubleToString(alvo1, _Digits),
               " tickSize = ", DoubleToString(g_tick_size, _Digits));
         return false;
      }

      if(MathAbs(distanciaAlvo1 - Alvo1Pontos) > tickSize)
      {
         Print("ERRO CRITICO: alvo1 de venda com distancia incorreta. distancia = ",
               DoubleToString(distanciaAlvo1, _Digits),
               " Alvo1Pontos = ", DoubleToString(Alvo1Pontos, _Digits));
         return false;
      }

      if(alvo2 >= alvo1 - tolerance)
      {
         Print("ERRO CRITICO: alvo2 de venda invalido. alvo1 = ",
               DoubleToString(alvo1, _Digits),
               " alvo2 = ", DoubleToString(alvo2, _Digits));
         return false;
      }

      if(MathAbs(distanciaAlvo2 - Alvo2Pontos) > tickSize)
      {
         Print("ERRO CRITICO: alvo2 de venda com distancia incorreta. distancia = ",
               DoubleToString(distanciaAlvo2, _Digits),
               " Alvo2Pontos = ", DoubleToString(Alvo2Pontos, _Digits));
         return false;
      }

      return true;
   }

   return false;
}

void LogOperationStarted()
{
   if(!SelectOurPosition())
      return;

   PrintFormat("OPERACAO INICIADA entradaRaw=%.3f entradaOperacional=%.3f stopAtual=%.3f alvo1=%.3f alvo2=%.3f slReal=%.3f last=%.3f",
               entradaRaw,
               entradaOperacional,
               stopAtual,
               alvo1,
               alvo2,
               PositionGetDouble(POSITION_SL),
               SymbolInfoDouble(_Symbol, SYMBOL_LAST));
}

void AuditOpenPosition(ENUM_POSITION_TYPE type, double expectedStop)
{
   if(!SelectOurPosition())
      return;

   string tipo = (type == POSITION_TYPE_BUY ? "COMPRA" : "VENDA");
   double slReal = PositionGetDouble(POSITION_SL);
   bidRaw = GetBidRaw();
   askRaw = GetAskRaw();
   bidOperacional = GetBidOperacional();
   askOperacional = GetAskOperacional();
   double last = SymbolInfoDouble(_Symbol, SYMBOL_LAST);
   double tickSize = GetOperationalTickSize();

   if(tickSize <= 0.0)
      tickSize = _Point;

   PrintFormat("AUDITORIA POSICAO ABERTA tipo=%s entradaRaw=%.3f entradaOperacional=%.3f slEsperado=%.3f slReal=%.3f distanciaSL=%.3f bidRaw=%.3f askRaw=%.3f bidOp=%.3f askOp=%.3f last=%.3f tickSize=%.3f point=%.6f",
               tipo,
               entradaRaw,
               entradaOperacional,
               expectedStop,
               slReal,
               MathAbs(entradaOperacional - slReal),
               bidRaw,
               askRaw,
               bidOperacional,
               askOperacional,
               last,
               tickSize,
               _Point);

   if(type == POSITION_TYPE_BUY)
   {
      if(slReal > 0.0 && MathAbs((entradaOperacional - slReal) - StopPontos) > tickSize)
      {
         PrintFormat("ERRO CRITICO: SL real da compra nao respeita StopPontos. entradaOperacional=%.3f slReal=%.3f distancia=%.3f StopPontos=%.3f",
                     entradaOperacional,
                     slReal,
                     entradaOperacional - slReal,
                     StopPontos);
      }

      if(bidOperacional > expectedStop)
      {
         PrintFormat("COMPRA OK: preco operacional ainda acima do stop. bidRaw=%.3f bidOp=%.3f stopAtual=%.3f distancia=%.3f",
                     bidRaw,
                     bidOperacional,
                     expectedStop,
                     bidOperacional - expectedStop);
      }
      else
      {
         PrintFormat("ALERTA: compra abriu ja com bidOp <= stop. bidRaw=%.3f bidOp=%.3f stopAtual=%.3f",
                     bidRaw,
                     bidOperacional,
                     expectedStop);
      }
   }
   else if(type == POSITION_TYPE_SELL)
   {
      if(slReal > 0.0 && MathAbs((slReal - entradaOperacional) - StopPontos) > tickSize)
      {
         PrintFormat("ERRO CRITICO: SL real da venda nao respeita StopPontos. entradaOperacional=%.3f slReal=%.3f distancia=%.3f StopPontos=%.3f",
                     entradaOperacional,
                     slReal,
                     slReal - entradaOperacional,
                     StopPontos);
      }

      if(askOperacional < expectedStop)
      {
         PrintFormat("VENDA OK: preco operacional ainda abaixo do stop. askRaw=%.3f askOp=%.3f stopAtual=%.3f distancia=%.3f",
                     askRaw,
                     askOperacional,
                     expectedStop,
                     expectedStop - askOperacional);
      }
      else
      {
         PrintFormat("ALERTA: venda abriu ja com askOp >= stop. askRaw=%.3f askOp=%.3f stopAtual=%.3f",
                     askRaw,
                     askOperacional,
                     expectedStop);
      }
   }

   if(slReal <= 0.0 || MathAbs(slReal - expectedStop) > tickSize + 0.000000001)
   {
      Print("SL real diferente do stop esperado por mais de 1 tick. Tentando corrigir. slReal = ",
            DoubleToString(slReal, _Digits),
            " slEsperado = ", DoubleToString(expectedStop, _Digits),
            " tickSize = ", DoubleToString(tickSize, _Digits));

      PrintMarketSnapshot("ANTES DE MODIFY STOP");
      bool changed = ModifyStop(expectedStop);

      if(!changed)
      {
         if(slReal <= 0.0)
         {
            Print("Falha critica: posicao aberta sem Stop Loss real. Fechando a mercado.");
            CloseOurPositionAtMarket("Protecao: posicao sem Stop Loss real");
         }
         else
         {
            Print("ERRO CRITICO: nao foi possivel corrigir SL real diferente do esperado. Posicao mantida com SL real atual.");
         }
      }
   }
}

bool CanManageExits()
{
   if(!posicaoInicializada)
      return false;

   if(TimeCurrent() <= horarioEntrada)
      return false;

   return true;
}

void PrintGestaoSaidasBloqueadaUmaVez()
{
   long position_id = 0;

   if(SelectOurPosition())
      position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);

   datetime agora = TimeCurrent();

   if(g_id_log_gestao_saida_bloqueada == position_id &&
      g_ultimo_log_gestao_saida_bloqueada == agora)
   {
      return;
   }

   g_id_log_gestao_saida_bloqueada = position_id;
   g_ultimo_log_gestao_saida_bloqueada = agora;

   Print("Gestao de saidas bloqueada no tick/segundo da entrada para evitar saida imediata.");
}

bool DeveLogarParcialVolumeBloqueada(int takeIndex)
{
   long position_id = 0;

   if(SelectOurPosition())
      position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);

   datetime agora = TimeCurrent();

   if(g_id_log_parcial_volume_bloqueada == position_id &&
      g_take_log_parcial_volume_bloqueada == takeIndex &&
      g_ultimo_log_parcial_volume_bloqueada == agora)
   {
      return false;
   }

   g_id_log_parcial_volume_bloqueada = position_id;
   g_take_log_parcial_volume_bloqueada = takeIndex;
   g_ultimo_log_parcial_volume_bloqueada = agora;

   return true;
}

void PrintMarketSnapshot(string contexto)
{
   bidRaw = GetBidRaw();
   askRaw = GetAskRaw();
   bidOperacional = GetBidOperacional();
   askOperacional = GetAskOperacional();
   double last = SymbolInfoDouble(_Symbol, SYMBOL_LAST);
   double tickSize = GetOperationalTickSize();

   if(tickSize <= 0.0)
      tickSize = _Point;

   PrintFormat("%s bidRaw=%.3f askRaw=%.3f bidOp=%.3f askOp=%.3f last=%.3f spread=%.3f tickSize=%.3f point=%.6f",
               contexto,
               bidRaw,
               askRaw,
               bidOperacional,
               askOperacional,
               last,
               askRaw - bidRaw,
               tickSize,
               _Point);
}

void InferPartialStateFromVolume(double current_volume)
{
   double after_p1 = NormalizeVolume(LoteTotal - LoteAlvo1);
   double after_p2 = NormalizeVolume(LoteTotal - LoteAlvo1 - LoteAlvo2);
   double tolerance = MathMax(g_volume_step * 0.5, 0.000000001);

   parcial1Feita = false;
   parcial2Feita = false;
   trailingAtivo = false;

   if(after_p1 > 0.0 && current_volume <= after_p1 + tolerance)
      parcial1Feita = true;

   if(after_p2 > 0.0 && current_volume <= after_p2 + tolerance)
   {
      parcial1Feita = true;
      parcial2Feita = true;
      trailingAtivo = HabilitarTrailing;
   }
}

void ClearOpenTradeState()
{
   if(aguardandoExecucao)
      return;

   CancelPendingTakeOrders();

   parcial1Feita = false;
   parcial2Feita = false;
   trailingAtivo = false;
   entradaRaw = 0.0;
   entradaOperacional = 0.0;
   bidRaw = 0.0;
   askRaw = 0.0;
   bidOperacional = 0.0;
   askOperacional = 0.0;
   stopAtual = 0.0;
   alvo1 = 0.0;
   alvo2 = 0.0;
   melhorPrecoCompra = 0.0;
   melhorPrecoVenda = 0.0;
   ticketTake1 = 0;
   ticketTake2 = 0;
   ticketEntradaCompra = 0;
   ticketEntradaVenda = 0;
   g_trade_levels_valid = false;
   g_id_posicao_gerenciada = 0;
   g_id_execucao_logada = 0;
   g_id_log_gestao_saida_bloqueada = 0;
   g_id_log_parcial_volume_bloqueada = 0;
   g_take_log_parcial_volume_bloqueada = 0;
   g_ultimo_log_gestao_saida_bloqueada = 0;
   g_ultimo_log_parcial_volume_bloqueada = 0;
   horarioEntrada = 0;
   ticketEntrada = 0;
   posicaoInicializada = false;
}

bool CloseOurPositionAtMarket(string reason)
{
   if(!SelectOurPosition())
      return false;

   double volume = PositionGetDouble(POSITION_VOLUME);
   ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
   ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   Print("Zeragem no fim do dia executada");
   Print("Motivo da zeragem = ", reason);
   Print("Horario = ", TimeToString(TimeCurrent(), TIME_SECONDS));
   Print("Volume restante = ", DoubleToString(volume, VolumeDigits()));

   ResetLastError();
   bool ok = trade.PositionClose(ticket, SlippagePoints);
   uint retcode = trade.ResultRetcode();

   if(!ok || !IsAcceptedTradeRetcode(retcode))
   {
      Print("Erro na zeragem. Retcode = ", retcode,
            " - ", trade.ResultRetcodeDescription(),
            " LastError = ", GetLastError());
      return false;
   }

   if(type == POSITION_TYPE_BUY)
      operouCompraHoje = true;
   else if(type == POSITION_TYPE_SELL)
      operouVendaHoje = true;

   CancelPendingTakeOrders();
   CancelPendingEntryOrders();

   return true;
}

string ObjectScopeNeedle()
{
   return "_" + _Symbol + "_" + MagicString() + "_";
}
