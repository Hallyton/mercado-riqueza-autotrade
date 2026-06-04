//+------------------------------------------------------------------+
//| MR_Strategy_FiboD1_Guard.mqh — lógica Fibo D1 (sinal apenas)       |
//| Mercado da Riqueza — parâmetros internos hardcoded (caixa preta)  |
//+------------------------------------------------------------------+
#property strict

#define MR_FIBO_GUARD_CODE      "MR_FIBO_D1_GUARD"
#define MR_FIBO_GUARD_VERSION   "1.0.0"

// Parâmetros internos — não expor como inputs de produção
static const double MR_FIBO_PERCENT           = 0.20;
static const double MR_FIBO_STOP_POINTS       = 7.0;
static const double MR_FIBO_ALVO1_POINTS      = 5.0;
static const double MR_FIBO_ALVO2_POINTS      = 10.0;
static const double MR_FIBO_LOTE_TOTAL        = 1.0;
static const double MR_FIBO_LOTE_ALVO1        = 1.0;
static const double MR_FIBO_LOTE_ALVO2        = 0.0;
static const double MR_FIBO_TRAIL_STEP        = 0.5;
static const double MR_FIBO_TRAIL_DISTANCE    = 1.0;
static const double MR_FIBO_TICK_OP           = 0.5;
static const int    MR_FIBO_DIGITS_OP         = 1;
static const string MR_FIBO_HORARIO_INICIO    = "09:15";
static const string MR_FIBO_HORARIO_FIM       = "17:30";
static const int    MR_FIBO_MIN_PREPARACAO    = 1;

struct MR_StrategySignal
  {
   bool              hasSignal;
   string            strategyName;
   string            strategyVersion;
   string            side;
   string            orderType;
   double            orderPrice;
   double            initialStopLoss;
   double            take1Price;
   double            take1Quantity;
   double            take2Price;
   double            take2Quantity;
   bool              breakEvenEnabled;
   string            breakEvenTrigger;
   double            breakEvenOffset;
   bool              trailingEnabled;
   double            trailingTriggerPrice;
   double            trailingDistance;
   double            trailingStep;
   string            reasonCode;
  };

static bool     g_fibo_operou_compra = false;
static bool     g_fibo_operou_venda = false;
static bool     g_fibo_compra_armada = false;
static bool     g_fibo_venda_armada = false;
static bool     g_fibo_tem_prev = false;
static double   g_fibo_prev_ask = 0;
static double   g_fibo_prev_bid = 0;
static double   g_fibo_max_ant = 0;
static double   g_fibo_min_ant = 0;
static double   g_fibo_nivel_compra = 0;
static double   g_fibo_nivel_venda = 0;
static datetime g_fibo_dia_operacional = 0;
static datetime g_fibo_niveis_preparados = 0;

double MR_Fibo_NormalizePrice(const double price)
  {
   return NormalizeDouble(MathRound(price / MR_FIBO_TICK_OP) * MR_FIBO_TICK_OP, MR_FIBO_DIGITS_OP);
  }

double MR_Fibo_GetAskOp()
  {
   return MR_Fibo_NormalizePrice(SymbolInfoDouble(_Symbol, SYMBOL_ASK));
  }

double MR_Fibo_GetBidOp()
  {
   return MR_Fibo_NormalizePrice(SymbolInfoDouble(_Symbol, SYMBOL_BID));
  }

datetime MR_Fibo_DayStart(datetime when)
  {
   MqlDateTime dt;
   TimeToStruct(when, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
  }

bool MR_Fibo_ParseHHMM(const string hhmm, int &hour, int &minute)
  {
   string parts[];
   if(StringSplit(hhmm, ':', parts) != 2)
      return false;
   hour = (int)StringToInteger(parts[0]);
   minute = (int)StringToInteger(parts[1]);
   return true;
  }

datetime MR_Fibo_TodayTimeFromString(const string hhmm)
  {
   int h = 0, m = 0;
   if(!MR_Fibo_ParseHHMM(hhmm, h, m))
      return 0;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = h;
   dt.min = m;
   dt.sec = 0;
   return StructToTime(dt);
  }

bool MR_Fibo_IsEntryTime()
  {
   datetime now = TimeCurrent();
   datetime start = MR_Fibo_TodayTimeFromString(MR_FIBO_HORARIO_INICIO);
   datetime end = MR_Fibo_TodayTimeFromString(MR_FIBO_HORARIO_FIM);
   return (now >= start && now <= end);
  }

bool MR_Fibo_IsPreparationTime()
  {
   datetime start = MR_Fibo_TodayTimeFromString(MR_FIBO_HORARIO_INICIO);
   datetime prep = start - MR_FIBO_MIN_PREPARACAO * 60;
   datetime now = TimeCurrent();
   return (now >= prep && now < start);
  }

bool MR_Fibo_CarregarNiveisDiaAnterior()
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_D1, 0, 5, rates);
   if(copied < 2)
      return false;

   double maxAnt = rates[1].high;
   double minAnt = rates[1].low;
   if(maxAnt <= minAnt)
      return false;

   double amplitude = maxAnt - minAnt;
   double fibo = amplitude * MR_FIBO_PERCENT;
   g_fibo_max_ant = maxAnt;
   g_fibo_min_ant = minAnt;
   g_fibo_nivel_compra = MR_Fibo_NormalizePrice(minAnt + fibo);
   g_fibo_nivel_venda = MR_Fibo_NormalizePrice(maxAnt - fibo);
   g_fibo_niveis_preparados = TimeCurrent();
   return true;
  }

void MR_Fibo_ResetDailyIfNeeded()
  {
   datetime day = MR_Fibo_DayStart(TimeCurrent());
   if(g_fibo_dia_operacional == day)
      return;
   g_fibo_dia_operacional = day;
   g_fibo_operou_compra = false;
   g_fibo_operou_venda = false;
   g_fibo_compra_armada = false;
   g_fibo_venda_armada = false;
   g_fibo_tem_prev = false;
   g_fibo_prev_ask = 0;
   g_fibo_prev_bid = 0;
   g_fibo_max_ant = 0;
   g_fibo_min_ant = 0;
   g_fibo_nivel_compra = 0;
   g_fibo_nivel_venda = 0;
   g_fibo_niveis_preparados = 0;
  }

bool MR_Fibo_GarantirNiveis()
  {
   if(g_fibo_nivel_compra > 0 && g_fibo_nivel_venda > 0)
      return true;
   if(MR_Fibo_IsPreparationTime() || MR_Fibo_IsEntryTime())
      return MR_Fibo_CarregarNiveisDiaAnterior();
   return false;
  }

bool MR_Fibo_HasOpenPositionForMagic(const int magic)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic)
         continue;
      return true;
     }
   return false;
  }

void MR_Fibo_FillSignalBuy(MR_StrategySignal &sig, const double askOp)
  {
   sig.hasSignal = true;
   sig.strategyName = MR_FIBO_GUARD_CODE;
   sig.strategyVersion = MR_FIBO_GUARD_VERSION;
   sig.side = "BUY";
   sig.orderType = "MARKET";
   sig.orderPrice = 0;
   sig.initialStopLoss = MR_Fibo_NormalizePrice(askOp - MR_FIBO_STOP_POINTS);
   sig.take1Price = MR_Fibo_NormalizePrice(askOp + MR_FIBO_ALVO1_POINTS);
   sig.take1Quantity = MR_FIBO_LOTE_ALVO1;
   sig.take2Price = MR_Fibo_NormalizePrice(askOp + MR_FIBO_ALVO2_POINTS);
   sig.take2Quantity = MR_FIBO_LOTE_ALVO2;
   sig.breakEvenEnabled = true;
   sig.breakEvenTrigger = "TAKE1_FILLED";
   sig.breakEvenOffset = 0;
   sig.trailingEnabled = true;
   sig.trailingTriggerPrice = MR_Fibo_NormalizePrice(askOp + MR_FIBO_ALVO2_POINTS);
   sig.trailingDistance = MR_FIBO_TRAIL_DISTANCE;
   sig.trailingStep = MR_FIBO_TRAIL_STEP;
   sig.reasonCode = "FIBO_D1_BUY_LEVEL_TOUCH";
  }

void MR_Fibo_FillSignalSell(MR_StrategySignal &sig, const double bidOp)
  {
   sig.hasSignal = true;
   sig.strategyName = MR_FIBO_GUARD_CODE;
   sig.strategyVersion = MR_FIBO_GUARD_VERSION;
   sig.side = "SELL";
   sig.orderType = "MARKET";
   sig.orderPrice = 0;
   sig.initialStopLoss = MR_Fibo_NormalizePrice(bidOp + MR_FIBO_STOP_POINTS);
   sig.take1Price = MR_Fibo_NormalizePrice(bidOp - MR_FIBO_ALVO1_POINTS);
   sig.take1Quantity = MR_FIBO_LOTE_ALVO1;
   sig.take2Price = MR_Fibo_NormalizePrice(bidOp - MR_FIBO_ALVO2_POINTS);
   sig.take2Quantity = MR_FIBO_LOTE_ALVO2;
   sig.breakEvenEnabled = true;
   sig.breakEvenTrigger = "TAKE1_FILLED";
   sig.breakEvenOffset = 0;
   sig.trailingEnabled = true;
   sig.trailingTriggerPrice = MR_Fibo_NormalizePrice(bidOp - MR_FIBO_ALVO2_POINTS);
   sig.trailingDistance = MR_FIBO_TRAIL_DISTANCE;
   sig.trailingStep = MR_FIBO_TRAIL_STEP;
   sig.reasonCode = "FIBO_D1_SELL_LEVEL_TOUCH";
  }

bool MR_Fibo_EvaluateSignal(const int magic, MR_StrategySignal &out_signal)
  {
   MR_StrategySignal empty;
   empty.hasSignal = false;
   out_signal = empty;

   MR_Fibo_ResetDailyIfNeeded();

   if(MR_Fibo_HasOpenPositionForMagic(magic))
      return false;

   if(!MR_Fibo_IsEntryTime())
      return false;

   if(!MR_Fibo_GarantirNiveis())
      return false;

   if(g_fibo_nivel_compra <= 0 || g_fibo_nivel_venda <= 0)
      return false;

   double askOp = MR_Fibo_GetAskOp();
   double bidOp = MR_Fibo_GetBidOp();
   if(askOp <= 0 || bidOp <= 0)
      return false;

   if(!g_fibo_tem_prev)
     {
      g_fibo_prev_ask = askOp;
      g_fibo_prev_bid = bidOp;
      g_fibo_tem_prev = true;
      if(askOp > g_fibo_nivel_compra)
         g_fibo_compra_armada = true;
      if(bidOp < g_fibo_nivel_venda)
         g_fibo_venda_armada = true;
      return false;
     }

   if(!g_fibo_compra_armada && askOp > g_fibo_nivel_compra)
      g_fibo_compra_armada = true;
   if(!g_fibo_venda_armada && bidOp < g_fibo_nivel_venda)
      g_fibo_venda_armada = true;

   bool cruzouCompra = g_fibo_compra_armada && !g_fibo_operou_compra &&
                     (g_fibo_prev_ask > g_fibo_nivel_compra) && (askOp <= g_fibo_nivel_compra);
   bool cruzouVenda = g_fibo_venda_armada && !g_fibo_operou_venda &&
                     (g_fibo_prev_bid < g_fibo_nivel_venda) && (bidOp >= g_fibo_nivel_venda);

   g_fibo_prev_ask = askOp;
   g_fibo_prev_bid = bidOp;

   if(cruzouCompra)
     {
      g_fibo_operou_compra = true;
      MR_Fibo_FillSignalBuy(out_signal, askOp);
      return true;
     }

   if(cruzouVenda)
     {
      g_fibo_operou_venda = true;
      MR_Fibo_FillSignalSell(out_signal, bidOp);
      return true;
     }

   return false;
  }
