//+------------------------------------------------------------------+
//| BBX_Entry.mqh — v1 limpo: só envia se TODAS as condições passam  |
//+------------------------------------------------------------------+
#ifndef BBX_ENTRY_MQH
#define BBX_ENTRY_MQH

bool BBX_EntryIsEntrada(const ulong ticket, int &direcao, double &preco)
  {
   if(!g_ordInfo.Select(ticket))
      return false;
   if(g_ordInfo.Symbol() != g_symbol)
      return false;
   if((ulong)g_ordInfo.Magic() != MagicNumber)
      return false;
   if(!BBX_EhComentarioEntrada(g_ordInfo.Comment()))
      return false;

   ENUM_ORDER_TYPE t = g_ordInfo.OrderType();
   preco = g_ordInfo.PriceOpen();
   if(t == ORDER_TYPE_BUY_LIMIT)
      direcao = BBX_DIR_BUY;
   else if(t == ORDER_TYPE_SELL_LIMIT)
      direcao = BBX_DIR_SELL;
   else
      return false;
   return true;
  }

bool BBX_EntryPendenteNoNivel(const int direcao, const double precoNivel)
  {
   double alvo = BBX_NormalizePrice(precoNivel);
   double tol  = BBX_ToleranciaPrecoOrdem();

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      int dir = BBX_DIR_NONE;
      double px = 0.0;
      if(!BBX_EntryIsEntrada(ticket, dir, px))
         continue;
      if(dir == direcao && MathAbs(BBX_NormalizePrice(px) - alvo) <= tol)
         return true;
     }
   return false;
  }

bool BBX_EntryPrecoNaFaixa()
  {
   BBX_StrategyRecalcular();
   return BBX_StrategyCenarioOperacional(g_strat.scenario);
  }

bool BBX_EntryEnviarLimitComSL(const int direcao, const double precoNivel)
  {
   if(BBX_SafetyExistePosicao())
      return false;

   if(direcao == BBX_DIR_BUY)
     {
      if(COMPRADO_NO_DIA || g_bloqEntCompra || !PermitirCompra)
         return false;
     }
   else if(direcao == BBX_DIR_SELL)
     {
      if(VENDIDO_NO_DIA || g_bloqEntVenda || !PermitirVenda)
         return false;
     }
   else
      return false;

   double px = BBX_NormalizePrice(precoNivel);
   if(px <= 0.0)
      return false;

   if(BBX_EntryPendenteNoNivel(direcao, px))
      return false;

   MqlTick tick;
   string motivo = "";
   if(!BBX_ObterTickMercado(tick, motivo))
      return false;

   ENUM_ORDER_TYPE tipo = (direcao == BBX_DIR_BUY) ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
   if(!BBX_ValidarPrecoOrdemPendente(tipo, px, "ENT", motivo, tick))
     {
      if(direcao == BBX_DIR_BUY)
         g_bloqEntCompra = true;
      else
         g_bloqEntVenda = true;
      BBX_LogUnico("ent_pend_" + IntegerToString(direcao),
                   "Entrada bloqueada: preço pendente inválido — " + motivo, true);
      return false;
     }

   double vol = BBX_NormalizeVolume(LoteEntrada);
   if(!BBX_ValidarVolume(vol))
     {
      if(direcao == BBX_DIR_BUY)
         g_bloqEntCompra = true;
      else
         g_bloqEntVenda = true;
      BBX_LogUnico("ent_vol_" + IntegerToString(direcao), "Entrada bloqueada: volume inválido", true);
      return false;
     }

   double sl = BBX_SafetyCalcularStop(direcao, px);
   if(!BBX_SafetyValidarStopEntrada(direcao, px, sl, motivo))
     {
      if(direcao == BBX_DIR_BUY)
         g_bloqEntCompra = true;
      else
         g_bloqEntVenda = true;
      string dirTxt = (direcao == BBX_DIR_BUY) ? "COMPRA" : "VENDA";
      BBX_LogUnico("ent_sl_" + IntegerToString(direcao) + "_" + IntegerToString((int)g_state.dayKey),
                   "Entrada " + dirTxt + " bloqueada: " + motivo +
                   " | preço=" + DoubleToString(px, g_digits) +
                   " sl=" + DoubleToString(sl, g_digits), true);
      return false;
     }

   string comentario = (direcao == BBX_DIR_BUY) ? BBX_ComentarioEntradaCompra() : BBX_ComentarioEntradaVenda();
   string dirLabel   = (direcao == BBX_DIR_BUY) ? "COMPRA" : "VENDA";

   BBX_LogInfo("Enviando " + BBX_TipoOrdemParaTexto(tipo) +
               " " + dirLabel +
               " preço=" + DoubleToString(px, g_digits) +
               " sl=" + DoubleToString(sl, g_digits) +
               " vol=" + DoubleToString(vol, 2));

   if(!BBX_TradeEnviarEntradaLimit(tipo, vol, px, sl, comentario))
     {
      if(direcao == BBX_DIR_BUY)
         g_bloqEntCompra = true;
      else
         g_bloqEntVenda = true;
      return false;
     }

   ulong ordTicket = BBX_TradeUltimoOrderTicket();
   if(direcao == BBX_DIR_BUY)
      g_state.entryTicketBuy = ordTicket;
   else
      g_state.entryTicketSell = ordTicket;

   BBX_LogInfo("Pendente aceita ticket=" + IntegerToString((int)ordTicket));
   return true;
  }

void BBX_EntryProcessar()
  {
   if(!AtivarRobo)
      return;
   if(BBX_SafetyExistePosicao())
      return;

   BBX_StrategyRecalcular();

   // Regra do usuário: SÓ ENVIA quando preço está entre compra e venda.
   // Fora da faixa: não envia novas — mas NÃO cancela pendentes já colocadas.
   if(!BBX_StrategyCenarioOperacional(g_strat.scenario))
     {
      BBX_StrategyLogSemOperacao(g_strat.scenario);
      return;
     }

   if(COMPRADO_NO_DIA && VENDIDO_NO_DIA)
      return;

   static datetime s_ultimoEnvioEntrada = 0;
   if(s_ultimoEnvioEntrada > 0 && (TimeCurrent() - s_ultimoEnvioEntrada) < 1)
      return;

   bool enviou = false;

   if(PermitirVenda && !VENDIDO_NO_DIA && !g_bloqEntVenda)
      enviou = BBX_EntryEnviarLimitComSL(BBX_DIR_SELL, g_strat.venda) || enviou;

   if(PermitirCompra && !COMPRADO_NO_DIA && !g_bloqEntCompra)
      enviou = BBX_EntryEnviarLimitComSL(BBX_DIR_BUY, g_strat.compra) || enviou;

   if(enviou)
      s_ultimoEnvioEntrada = TimeCurrent();
  }

int BBX_EntryContarPendentes()
  {
   int n = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      int dir = BBX_DIR_NONE;
      double px = 0.0;
      if(BBX_EntryIsEntrada(ticket, dir, px))
         n++;
     }
   return n;
  }

void BBX_EntryCancelarTodas(const string motivo)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      int dir = BBX_DIR_NONE;
      double px = 0.0;
      if(!BBX_EntryIsEntrada(ticket, dir, px))
         continue;
      string cmt = g_ordInfo.Comment();
      if(BBX_TradeRemoverOrdem(ticket, "Cancelar entrada " + cmt))
        {
         BBX_LogUnico("cancel_ent_" + IntegerToString((int)ticket) + "_" + motivo,
                      "Cancelando entrada " + cmt + " motivo=" + motivo, false);
         BBX_StateLimparTicketOrdem(ticket);
        }
     }
  }

void BBX_EntryCancelarPontaContraria(const int direcaoExecutada)
  {
   int contraria = (direcaoExecutada == BBX_DIR_BUY) ? BBX_DIR_SELL : BBX_DIR_BUY;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      int dir = BBX_DIR_NONE;
      double px = 0.0;
      if(!BBX_EntryIsEntrada(ticket, dir, px) || dir != contraria)
         continue;
      if(BBX_TradeRemoverOrdem(ticket, "Cancelar ponta contrária"))
         BBX_StateLimparTicketOrdem(ticket);
     }
  }

#endif
