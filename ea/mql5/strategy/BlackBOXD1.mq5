//+------------------------------------------------------------------+
//| BlackBOXD1.mq5 — Mercado da Riqueza                              |
//| v6 — reescrita do zero. Um arquivo, lógica literal.              |
//+------------------------------------------------------------------+
#property copyright "Mercado da Riqueza"
#property link      "https://mercadodariqueza.com"
#property version   "6.01"
#property strict

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
#include <Trade/OrderInfo.mqh>

//--- inputs
input group "=== Geral ==="
input bool   AtivarRobo           = true;
input ulong  MagicNumber          = 20260531;
input bool   MostrarLogs          = true;

input group "=== Estratégia D-1 ==="
input double PercentualFibo       = 0.20;
input ENUM_TIMEFRAMES TimeframeReferencia = PERIOD_D1;

input group "=== Direção ==="
input bool   PermitirCompra       = true;
input bool   PermitirVenda        = true;

input group "=== Lote ==="
input double LoteEntrada          = 1.0;

input group "=== Stop Loss (pontos = ticks do contrato) ==="
input double StopLossPontos       = 14.0;

input group "=== Take 1 ==="
input double Take1Pontos          = 10.0;
input double LoteTake1            = 1.0;

input group "=== Take 2 (0 = desligado) ==="
input double Take2Pontos          = 0.0;
input double LoteTake2            = 1.0;

input group "=== Horário ==="
input bool   UsarHorarioOperacional = true;
input string HoraInicio           = "09:15";
input string HoraFim              = "17:30";

//--- comentários fixos (correlação takes/deals)
#define CMT_ENT_BUY   "BBX_ENT_BUY"
#define CMT_ENT_SELL  "BBX_ENT_SELL"
#define CMT_TAKE1_BUY "BBX_T1_BUY"
#define CMT_TAKE2_BUY "BBX_T2_BUY"
#define CMT_TAKE1_SELL "BBX_T1_SELL"
#define CMT_TAKE2_SELL "BBX_T2_SELL"

CTrade        g_trade;
CPositionInfo g_pos;
COrderInfo    g_ord;

bool COMPRADO_NO_DIA = false;
bool VENDIDO_NO_DIA  = false;

double g_tickSize = 0.0;
double g_point    = 0.0;
int    g_digits   = 0;
int    g_horaIni  = 0;
int    g_horaFim  = 0;
datetime g_diaKey = 0;

double g_maxD1 = 0.0, g_minD1 = 0.0;
double g_compra = 0.0, g_venda = 0.0;

ulong g_posTicketAtual = 0;
bool  g_take1Enviado    = false;
bool  g_take1Executado  = false;
bool  g_take2Enviado    = false;
bool  g_take2Executado  = false;

//+------------------------------------------------------------------+
double BBX_TickSize()
  {
   double t = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(t <= 0.0)
      t = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   return t;
  }

double BBX_NormPx(const double px)
  {
   double t = BBX_TickSize();
   if(t <= 0.0)
      return NormalizeDouble(px, g_digits);
   return NormalizeDouble(MathRound(px / t) * t, g_digits);
  }

double BBX_NormVol(const double vol)
  {
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0.0)
      return vol;
   double v = MathFloor(vol / step + 1e-8) * step;
   if(v < vmin) v = vmin;
   if(v > vmax) v = vmax;
   return v;
  }

double BBX_DistPontos(const double pontos)
  {
   if(pontos <= 0.0)
      return 0.0;
   return pontos * BBX_TickSize();
  }

double BBX_PrecoMid()
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(bid <= 0.0 || ask <= 0.0)
      return 0.0;
   return BBX_NormPx((bid + ask) * 0.5);
  }

bool BBX_ParseHora(const string h, int &minDia)
  {
   string p[];
   if(StringSplit(h, ':', p) != 2)
      return false;
   int hh = (int)StringToInteger(p[0]);
   int mm = (int)StringToInteger(p[1]);
   if(hh < 0 || hh > 23 || mm < 0 || mm > 59)
      return false;
   minDia = hh * 60 + mm;
   return true;
  }

bool BBX_DentroHorario()
  {
   if(!UsarHorarioOperacional)
      return true;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   int now = dt.hour * 60 + dt.min;
   return (now >= g_horaIni && now < g_horaFim);
  }

datetime BBX_ChaveDia()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return StringToTime(IntegerToString(dt.year) + "." +
                       IntegerToString(dt.mon) + "." +
                       IntegerToString(dt.day));
  }

void BBX_Log(const string msg)
  {
   if(MostrarLogs)
      Print("[BlackBOXD1] ", msg);
  }

void BBX_RecalcularNiveis()
  {
   g_maxD1 = iHigh(_Symbol, TimeframeReferencia, 1);
   g_minD1 = iLow(_Symbol, TimeframeReferencia, 1);
   if(g_maxD1 <= 0.0 || g_minD1 <= 0.0)
      return;

   double amp  = g_maxD1 - g_minD1;
   double fibo = amp * PercentualFibo;
   g_compra = BBX_NormPx(g_minD1 + fibo);
   g_venda  = BBX_NormPx(g_maxD1 - fibo);
  }

bool BBX_PrecoNaFaixa()
  {
   double px = BBX_PrecoMid();
   if(px <= 0.0 || g_compra <= 0.0 || g_venda <= 0.0)
      return false;
   return (px >= g_compra && px <= g_venda);
  }

bool BBX_TemPosicao(int &dir, double &volEntrada, double &pxEntrada, ulong &ticket)
  {
   dir = 0;
   volEntrada = 0.0;
   pxEntrada = 0.0;
   ticket = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0 || !g_pos.SelectByTicket(tk))
         continue;
      if(g_pos.Symbol() != _Symbol || (ulong)g_pos.Magic() != MagicNumber)
         continue;

      ticket     = tk;
      volEntrada = g_pos.Volume();
      pxEntrada  = g_pos.PriceOpen();
      if(g_pos.PositionType() == POSITION_TYPE_BUY)
         dir = 1;
      else if(g_pos.PositionType() == POSITION_TYPE_SELL)
         dir = -1;
      return true;
     }
   return false;
  }

void BBX_ResetEstadoTakes(const ulong ticket)
  {
   if(ticket != g_posTicketAtual)
     {
      g_posTicketAtual = ticket;
      g_take1Enviado   = false;
      g_take1Executado = false;
      g_take2Enviado   = false;
      g_take2Executado = false;
     }
  }

void BBX_LimparEstadoTakes()
  {
   g_posTicketAtual = 0;
   g_take1Enviado   = false;
   g_take1Executado = false;
   g_take2Enviado   = false;
   g_take2Executado = false;
  }

void BBX_AtualizarTakeExecutado(const string cmt, const ENUM_ORDER_TYPE tipo,
                                const bool enviado, bool &executado, bool &enviadoFlag)
  {
   if(executado)
      return;
   if(BBX_OrdemPendenteExiste(cmt, tipo))
     {
      enviadoFlag = true;
      return;
     }
   if(enviadoFlag)
      executado = true;
  }

bool BBX_OrdemPendenteExiste(const string comentario, const ENUM_ORDER_TYPE tipo)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong tk = OrderGetTicket(i);
      if(tk == 0 || !g_ord.Select(tk))
         continue;
      if(g_ord.Symbol() != _Symbol || (ulong)g_ord.Magic() != MagicNumber)
         continue;
      if(g_ord.Comment() == comentario && g_ord.OrderType() == tipo)
         return true;
     }
   return false;
  }

bool BBX_CancelarPorComentario(const string comentario)
  {
   bool ok = true;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong tk = OrderGetTicket(i);
      if(tk == 0 || !g_ord.Select(tk))
         continue;
      if(g_ord.Symbol() != _Symbol || (ulong)g_ord.Magic() != MagicNumber)
         continue;
      if(g_ord.Comment() != comentario)
         continue;
      if(!g_trade.OrderDelete(tk))
         ok = false;
     }
   return ok;
  }

void BBX_CancelarEntradas()
  {
   BBX_CancelarPorComentario(CMT_ENT_BUY);
   BBX_CancelarPorComentario(CMT_ENT_SELL);
  }

void BBX_CancelarTakes()
  {
   BBX_CancelarPorComentario(CMT_TAKE1_BUY);
   BBX_CancelarPorComentario(CMT_TAKE2_BUY);
   BBX_CancelarPorComentario(CMT_TAKE1_SELL);
   BBX_CancelarPorComentario(CMT_TAKE2_SELL);
  }

bool BBX_EnviarEntrada(const int dir, const double precoNivel)
  {
   ENUM_ORDER_TYPE tipo = (dir > 0) ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
   string cmt = (dir > 0) ? CMT_ENT_BUY : CMT_ENT_SELL;

   if(BBX_OrdemPendenteExiste(cmt, tipo))
      return false;

   double px  = BBX_NormPx(precoNivel);
   double vol = BBX_NormVol(LoteEntrada);
   double sl  = (dir > 0) ? BBX_NormPx(px - BBX_DistPontos(StopLossPontos))
                          : BBX_NormPx(px + BBX_DistPontos(StopLossPontos));

   if(dir > 0 && sl >= px)
      return false;
   if(dir < 0 && sl <= px)
      return false;

   g_trade.SetExpertMagicNumber(MagicNumber);
   bool ok = false;
   if(dir > 0)
      ok = g_trade.BuyLimit(vol, px, _Symbol, sl, 0.0, ORDER_TIME_GTC, 0, cmt);
   else
      ok = g_trade.SellLimit(vol, px, _Symbol, sl, 0.0, ORDER_TIME_GTC, 0, cmt);

   if(ok)
      BBX_Log("Entrada " + cmt + " px=" + DoubleToString(px, g_digits) +
              " sl=" + DoubleToString(sl, g_digits) + " vol=" + DoubleToString(vol, 2));
   else
      BBX_Log("Falha entrada " + cmt + " ret=" + IntegerToString((int)g_trade.ResultRetcode()));
   return ok;
  }

bool BBX_EnviarTake(const int dirPos, const string cmt, const double pxTake, const double vol)
  {
   ENUM_ORDER_TYPE tipo = (dirPos > 0) ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_BUY_LIMIT;
   if(BBX_OrdemPendenteExiste(cmt, tipo))
      return false;

   double px  = BBX_NormPx(pxTake);
   double lot = BBX_NormVol(vol);
   if(lot <= 0.0)
      return false;

   g_trade.SetExpertMagicNumber(MagicNumber);
   bool ok = false;
   if(dirPos > 0)
      ok = g_trade.SellLimit(lot, px, _Symbol, 0, 0, ORDER_TIME_GTC, 0, cmt);
   else
      ok = g_trade.BuyLimit(lot, px, _Symbol, 0, 0, ORDER_TIME_GTC, 0, cmt);

   if(ok)
      BBX_Log("Take " + cmt + " px=" + DoubleToString(px, g_digits) +
              " vol=" + DoubleToString(lot, 2));
   return ok;
  }

void BBX_GerenciarTakes(const int dir, const double pxEntrada, const double volPos, const ulong ticket)
  {
   BBX_ResetEstadoTakes(ticket);
   BBX_CancelarEntradas();

   double volRestante = BBX_NormVol(volPos);
   ENUM_ORDER_TYPE tipoTake = (dir > 0) ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_BUY_LIMIT;

   if(dir > 0)
      COMPRADO_NO_DIA = true;
   else if(dir < 0)
      VENDIDO_NO_DIA = true;
   else
      return;

   string cmt1 = (dir > 0) ? CMT_TAKE1_BUY : CMT_TAKE1_SELL;
   string cmt2 = (dir > 0) ? CMT_TAKE2_BUY : CMT_TAKE2_SELL;

   BBX_AtualizarTakeExecutado(cmt1, tipoTake, g_take1Enviado, g_take1Executado, g_take1Enviado);
   BBX_AtualizarTakeExecutado(cmt2, tipoTake, g_take2Enviado, g_take2Executado, g_take2Enviado);

   // Take 1 — preço = entrada ± Take1Pontos, volume = LoteTake1
   if(!g_take1Executado && Take1Pontos > 0.0 && LoteTake1 > 0.0)
     {
      double lot1 = BBX_NormVol(MathMin(LoteTake1, volRestante));
      if(lot1 > 0.0 && !BBX_OrdemPendenteExiste(cmt1, tipoTake))
        {
         double px1 = (dir > 0) ? pxEntrada + BBX_DistPontos(Take1Pontos)
                                : pxEntrada - BBX_DistPontos(Take1Pontos);
         if(BBX_EnviarTake(dir, cmt1, px1, lot1))
            g_take1Enviado = true;
        }
     }

   // Take 2 — preço = entrada ± Take2Pontos (a partir da entrada, não do Take 1)
   if(!g_take2Executado && Take2Pontos > 0.0 && LoteTake2 > 0.0)
     {
      double lot2 = BBX_NormVol(MathMin(LoteTake2, volRestante));
      if(lot2 > 0.0 && !BBX_OrdemPendenteExiste(cmt2, tipoTake))
        {
         double px2 = (dir > 0) ? pxEntrada + BBX_DistPontos(Take2Pontos)
                                : pxEntrada - BBX_DistPontos(Take2Pontos);
         if(BBX_EnviarTake(dir, cmt2, px2, lot2))
            g_take2Enviado = true;
        }
     }
  }

// Prioridade a cada tick: posição aberta → flags do dia + takes
bool BBX_VerificarPosicaoETakes()
  {
   int dir = 0;
   double volPos = 0.0, pxEntrada = 0.0;
   ulong ticket = 0;

   if(!BBX_TemPosicao(dir, volPos, pxEntrada, ticket))
     {
      BBX_LimparEstadoTakes();
      return false;
     }

   BBX_GerenciarTakes(dir, pxEntrada, volPos, ticket);
   return true;
  }

void BBX_NovoDia()
  {
   COMPRADO_NO_DIA = false;
   VENDIDO_NO_DIA  = false;
   BBX_LimparEstadoTakes();
   BBX_CancelarEntradas();
   BBX_CancelarTakes();
   BBX_RecalcularNiveis();
   BBX_Log("Novo dia — níveis compra=" + DoubleToString(g_compra, g_digits) +
           " venda=" + DoubleToString(g_venda, g_digits));
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_tickSize = BBX_TickSize();
   g_point    = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   g_digits   = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);

   if(!BBX_ParseHora(HoraInicio, g_horaIni) || !BBX_ParseHora(HoraFim, g_horaFim))
      return INIT_PARAMETERS_INCORRECT;

   double lt1 = (Take1Pontos > 0.0) ? LoteTake1 : 0.0;
   double lt2 = (Take2Pontos > 0.0) ? LoteTake2 : 0.0;
   if(lt1 + lt2 > LoteEntrada + 1e-8)
      return INIT_PARAMETERS_INCORRECT;

   g_trade.SetExpertMagicNumber(MagicNumber);
   g_diaKey = BBX_ChaveDia();
   BBX_RecalcularNiveis();

   BBX_Log("v6.1 iniciado | " + _Symbol + " | tick=" + DoubleToString(g_tickSize, g_digits));
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   Comment("");
  }

void OnTick()
  {
   if(!AtivarRobo)
      return;

   datetime hoje = BBX_ChaveDia();
   if(hoje != g_diaKey)
     {
      g_diaKey = hoje;
      BBX_NovoDia();
     }

   // 1) A cada tick: posição aberta tem prioridade (takes rodam mesmo fora do horário de entrada)
   if(BBX_VerificarPosicaoETakes())
      return;

   BBX_CancelarTakes();

   if(!BBX_DentroHorario())
      return;

   if(!BBX_PrecoNaFaixa())
      return;

   if(PermitirVenda && !VENDIDO_NO_DIA)
      BBX_EnviarEntrada(-1, g_venda);

   if(PermitirCompra && !COMPRADO_NO_DIA)
      BBX_EnviarEntrada(1, g_compra);
  }

//+------------------------------------------------------------------+
