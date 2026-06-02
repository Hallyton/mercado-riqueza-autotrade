//+------------------------------------------------------------------+
//| BBX_Safety.mqh — v1: SL nativo na posição (TRADE_ACTION_SLTP)    |
//+------------------------------------------------------------------+
#ifndef BBX_SAFETY_MQH
#define BBX_SAFETY_MQH

double BBX_SafetyCalcularStop(const int direcao, const double precoEntrada)
  {
   if(direcao == BBX_DIR_BUY)
      return BBX_PrecoComPontos(precoEntrada, StopLossPontos, false);
   if(direcao == BBX_DIR_SELL)
      return BBX_PrecoComPontos(precoEntrada, StopLossPontos, true);
   return 0.0;
  }

bool BBX_SafetyValidarStopEntrada(const int direcao, const double precoEntrada,
                                  const double stop, string &motivo)
  {
   motivo = "";
   if(stop <= 0.0)
     { motivo = "Stop Loss zero"; return false; }

   double px = BBX_NormalizePrice(precoEntrada);
   double sl = BBX_NormalizePrice(stop);
   double minDist = BBX_DistanciaMinimaPreco();

   if(direcao == BBX_DIR_BUY)
     {
      if(sl >= px - minDist + 1e-12)
        { motivo = "SL compra deve ficar abaixo da entrada (distância mínima do broker)"; return false; }
     }
   else if(direcao == BBX_DIR_SELL)
     {
      if(sl <= px + minDist - 1e-12)
        { motivo = "SL venda deve ficar acima da entrada (distância mínima do broker)"; return false; }
     }
   else
     { motivo = "Direção inválida"; return false; }
   return true;
  }

bool BBX_SafetyExistePosicao()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!g_posInfo.SelectByTicket(ticket))
         continue;
      if(g_posInfo.Symbol() != g_symbol)
         continue;
      if((ulong)g_posInfo.Magic() != MagicNumber)
         continue;
      return true;
     }
   return false;
  }

void BBX_SafetyGarantirStopNativo()
  {
   if(!BBX_GarantirPosicaoAtual())
      return;
   if(!g_posInfo.SelectByTicket(g_state.positionTicket))
      return;

   double slAtual = g_posInfo.StopLoss();
   if(slAtual > 0.0)
     {
      g_state.slConfirmed = true;
      return;
     }

   static datetime ultimaFalha = 0;
   if(ultimaFalha > 0 && (TimeCurrent() - ultimaFalha) < 1)
      return;

   int dir = g_state.direcaoPosicao;
   double px = g_posInfo.PriceOpen();
   double sl = BBX_SafetyCalcularStop(dir, px);
   string motivo = "";

   if(!BBX_SafetyValidarStopEntrada(dir, px, sl, motivo))
     {
      BBX_LogUnico("sl_aplicar_" + IntegerToString((int)g_state.positionTicket),
                   "SL ausente na posição — não aplicável: " + motivo, true);
      return;
     }

   BBX_LogInfo("Posição sem SL — aplicando sl=" + DoubleToString(sl, g_digits) +
               " entrada=" + DoubleToString(px, g_digits));
   if(BBX_TradeAplicarStopPosicao(g_state.positionTicket, sl, "Aplicar SL posição"))
     {
      g_state.slConfirmed = true;
      ultimaFalha = 0;
      BBX_LogInfo("SL aplicado na posição");
     }
   else
      ultimaFalha = TimeCurrent();
  }

void BBX_SafetyFecharPosicao(const string motivo, const string comentarioDeal = "")
  {
   BBX_SyncStateFromMarket();
   ulong ticket = g_state.positionTicket;
   if(ticket == 0)
      return;

   string cmt = comentarioDeal;
   if(cmt == "")
     {
      if(StringFind(motivo, "encerramento operacional") >= 0)
         cmt = BBX_ComentarioFimDia();
      else
         cmt = BBX_ComentarioEmergencia();
     }

   BBX_LogInfo("Fechando posição comentario=" + cmt + " motivo=" + motivo);
   if(BBX_PositionCloseComComentario(ticket, cmt))
     {
      BBX_ExitCancelarPendentesPosicaoZerada(motivo);
      BBX_StateAposFechamento();
     }
  }

void BBX_SafetyCancelarTodasOrdensEA(const string motivo)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !BBX_OrdemPertenceEA(ticket))
         continue;
      string cmt = g_ordInfo.Comment();
      if(BBX_TradeRemoverOrdem(ticket, "Cancelar ordem EA " + cmt))
         BBX_LogInfo("Cancelando ordem EA comentario=" + cmt + " motivo=" + motivo);
     }
   g_state.entryTicketBuy = 0;
   g_state.entryTicketSell = 0;
   g_state.take1Ticket = 0;
   g_state.take2Ticket = 0;
   g_state.t1Sent = g_state.t2Sent = false;
  }

void BBX_SafetyProcessarEncerramentoDia()
  {
   if(g_state.encerramentoExecutado)
      return;
   g_state.encerramentoExecutado = true;
   BBX_LogInfo("Encerramento operacional 17:30");
   if(BBX_SafetyExistePosicao())
      BBX_SafetyFecharPosicao("horário de encerramento operacional");
   BBX_EntryCancelarTodas("encerramento operacional");
   BBX_ExitCancelarTodasSaidas("encerramento operacional");
  }

void BBX_SafetyProcessarCancelamentoOrdens()
  {
   if(g_state.cancelamentoOrdensExecutado)
      return;
   g_state.cancelamentoOrdensExecutado = true;
   BBX_LogInfo("Varredura final 17:45");
   BBX_SafetyCancelarTodasOrdensEA("HoraCancelarOrdens");
  }

#endif
