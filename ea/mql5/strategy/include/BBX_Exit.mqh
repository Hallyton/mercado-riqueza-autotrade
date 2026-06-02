//+------------------------------------------------------------------+
//| BBX_Exit.mqh — v1: Take 1 + Take 2 por ordens LIMIT opostas      |
//+------------------------------------------------------------------+
#ifndef BBX_EXIT_MQH
#define BBX_EXIT_MQH

double BBX_ExitCalcularPrecoTake(const int direcaoPos, const double precoEntrada,
                                 const double pontosTake)
  {
   if(pontosTake <= 0.0)
      return 0.0;
   if(direcaoPos == BBX_DIR_BUY)
      return BBX_PrecoComPontos(precoEntrada, pontosTake, true);
   if(direcaoPos == BBX_DIR_SELL)
      return BBX_PrecoComPontos(precoEntrada, pontosTake, false);
   return 0.0;
  }

bool BBX_ExitOrdemTakeExiste(const ENUM_BBX_PARTIAL_FLAG tipo)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !g_ordInfo.Select(ticket))
         continue;
      if(g_ordInfo.Symbol() != g_symbol || (ulong)g_ordInfo.Magic() != MagicNumber)
         continue;
      if(BBX_ClassificarTakePorComentario(g_ordInfo.Comment()) == tipo)
         return true;
     }
   return false;
  }

bool BBX_ExitEnviarTake(const ENUM_BBX_PARTIAL_FLAG tipo, const double pontosTake,
                        const double lote)
  {
   if(!BBX_GarantirPosicaoAtual())
      return false;
   if(!g_posInfo.SelectByTicket(g_state.positionTicket))
      return false;

   if(tipo == BBX_PARTIAL_TAKE1 && g_state.t1Done)
      return false;
   if(tipo == BBX_PARTIAL_TAKE2 && g_state.t2Done)
      return false;

   int dir = g_state.direcaoPosicao;
   double precoEntrada = g_posInfo.PriceOpen();
   double volPos = g_posInfo.Volume();
   double vol = BBX_NormalizeVolume(lote);

   if(vol <= 0.0 || vol > volPos + 1e-8)
     {
      BBX_LogUnico("take_vol_" + IntegerToString((int)tipo),
                   "Take bloqueado: volume " + DoubleToString(vol, 2) +
                   " posição " + DoubleToString(volPos, 2), true);
      return false;
     }

   double pxTake = BBX_ExitCalcularPrecoTake(dir, precoEntrada, pontosTake);
   if(pxTake <= 0.0)
      return false;

   MqlTick tick;
   string motivo = "";
   if(!BBX_ObterTickMercado(tick, motivo))
      return false;

   ENUM_ORDER_TYPE tipoOrdem = (dir == BBX_DIR_BUY) ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_BUY_LIMIT;
   if(!BBX_ValidarPrecoOrdemTake(tipoOrdem, pxTake, precoEntrada, dir, motivo, tick))
     {
      BBX_LogUnico("take_preco_" + IntegerToString((int)tipo), "Take bloqueado: " + motivo, true);
      return false;
     }

   string comentario = BBX_ComentarioTake(tipo, dir);
   if(!BBX_TradeEnviarTakeLimit(tipoOrdem, vol, pxTake, comentario))
      return false;

   ulong ticket = BBX_TradeUltimoOrderTicket();
   if(tipo == BBX_PARTIAL_TAKE1)
     {
      g_state.take1Ticket = ticket;
      g_state.t1Sent = true;
     }
   else
     {
      g_state.take2Ticket = ticket;
      g_state.t2Sent = true;
     }

   BBX_LogInfo("Take enviado comentario=" + comentario +
               " ticket=" + IntegerToString((int)ticket) +
               " preco=" + DoubleToString(pxTake, g_digits) +
               " volume=" + DoubleToString(vol, 2) +
               " entrada=" + DoubleToString(precoEntrada, g_digits) +
               " Ask=" + DoubleToString(tick.ask, g_digits) +
               " Bid=" + DoubleToString(tick.bid, g_digits));
   return true;
  }

void BBX_ExitGarantirTakes()
  {
   if(!BBX_GarantirPosicaoAtual())
      return;

   double lt1 = (Take1Pontos > 0) ? BBX_NormalizeVolume(LoteTake1) : 0.0;
   double lt2 = (Take2Pontos > 0) ? BBX_NormalizeVolume(LoteTake2) : 0.0;
   double le = BBX_NormalizeVolume(LoteEntrada);
   if(lt1 + lt2 > le + 1e-8)
     {
      BBX_LogUnico("take_lotes_cfg", "Take bloqueado: LoteTake1+LoteTake2 > LoteEntrada", true);
      return;
     }

   if(!g_state.t1Done && Take1Pontos > 0 && lt1 > 0.0)
     {
      if(!BBX_ExitOrdemTakeExiste(BBX_PARTIAL_TAKE1))
         BBX_ExitEnviarTake(BBX_PARTIAL_TAKE1, Take1Pontos, LoteTake1);
     }

   if(!g_state.t2Done && Take2Pontos > 0 && lt2 > 0.0)
     {
      if(!BBX_ExitOrdemTakeExiste(BBX_PARTIAL_TAKE2))
         BBX_ExitEnviarTake(BBX_PARTIAL_TAKE2, Take2Pontos, LoteTake2);
     }
  }

void BBX_ExitGerenciarPosicaoAberta()
  {
   if(!BBX_GarantirPosicaoAtual())
      return;
   BBX_ExitGarantirTakes();
   BBX_SafetyGarantirStopNativo();
  }

void BBX_ExitMarcarTakeExecutado(const ENUM_BBX_PARTIAL_FLAG tipo, const double dealVol)
  {
   BBX_SyncStateFromMarket();
   double volAntes = g_state.volumeAtual + dealVol;
   double reducao = volAntes - g_state.volumeAtual;
   if(reducao < g_volStep - 1e-8)
      return;

   if(tipo == BBX_PARTIAL_TAKE1)
     {
      g_state.t1Done = true;
      g_state.t1Sent = false;
      g_state.take1Ticket = 0;
      BBX_LogInfo("Take 1 confirmado volumeReduzido=" + DoubleToString(reducao, 2) +
                  " restante=" + DoubleToString(g_state.volumeAtual, 2));
     }
   else if(tipo == BBX_PARTIAL_TAKE2)
     {
      g_state.t2Done = true;
      g_state.t2Sent = false;
      g_state.take2Ticket = 0;
      BBX_LogInfo("Take 2 confirmado volumeReduzido=" + DoubleToString(reducao, 2) +
                  " restante=" + DoubleToString(g_state.volumeAtual, 2));
     }

   if(!BBX_SafetyExistePosicao())
     {
      BBX_ExitCancelarTodasSaidas("posição encerrada");
      BBX_StateAposFechamento();
     }
  }

void BBX_ExitCancelarTodasSaidas(const string motivo)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !g_ordInfo.Select(ticket))
         continue;
      if(g_ordInfo.Symbol() != g_symbol || (ulong)g_ordInfo.Magic() != MagicNumber)
         continue;
      if(!BBX_EhComentarioTake(g_ordInfo.Comment()))
         continue;
      if(BBX_TradeRemoverOrdem(ticket, "Cancelar Take " + g_ordInfo.Comment()))
        {
         BBX_LogInfo("Cancelando Take comentario=" + g_ordInfo.Comment() + " motivo=" + motivo);
         BBX_StateLimparTicketOrdem(ticket);
        }
     }
  }

void BBX_ExitCancelarOrfas()
  {
   // Desativado na v1 — sem varredura automática de órfãs.
  }

void BBX_ExitCancelarPendentesPosicaoZerada(const string motivo)
  {
   BBX_ExitCancelarTodasSaidas(motivo);
   BBX_EntryCancelarTodas(motivo);
  }

#endif
