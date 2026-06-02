//+------------------------------------------------------------------+
//| BBX_Reconcile.mqh — v1: OnTradeTransaction mínimo                  |
//+------------------------------------------------------------------+
#ifndef BBX_RECONCILE_MQH
#define BBX_RECONCILE_MQH

bool BBX_DealPertenceEA(const ulong dealTicket)
  {
   if(dealTicket == 0 || !HistoryDealSelect(dealTicket))
      return false;
   if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != g_symbol)
      return false;
   if((ulong)HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != MagicNumber)
      return false;
   return true;
  }

void BBX_TradeTransactionHandler(const MqlTradeTransaction &trans,
                                 const MqlTradeRequest &request,
                                 const MqlTradeResult &result)
  {
   if(trans.symbol != g_symbol && trans.symbol != "")
      return;

   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE && trans.order > 0)
      BBX_StateLimparTicketOrdem(trans.order);

   if(trans.type == TRADE_TRANSACTION_POSITION)
     {
      if(BBX_GarantirPosicaoAtual())
        {
         BBX_EntryCancelarTodas("posição aberta");
         BBX_ExitGerenciarPosicaoAberta();
        }
      return;
     }

   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong dealTicket = trans.deal;
   if(!BBX_DealPertenceEA(dealTicket))
      return;

   g_state.ultimoDealTicket = dealTicket;
   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   double dealVol = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);

   if(entry == DEAL_ENTRY_IN)
     {
      int dir = BBX_DIR_NONE;
      if(dealType == DEAL_TYPE_BUY)
         dir = BBX_DIR_BUY;
      else if(dealType == DEAL_TYPE_SELL)
         dir = BBX_DIR_SELL;
      if(dir == BBX_DIR_NONE)
         return;

      BBX_StateResetCicloPosicao();
      g_state.volumeEntrada = dealVol;
      g_state.precoEntrada = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      g_state.entradaConfirmadaEm = TimeCurrent();

      if(dir == BBX_DIR_BUY)
         COMPRADO_NO_DIA = true;
      else
         VENDIDO_NO_DIA = true;
      g_state.operacoesDia++;

      BBX_LogInfo("Entrada confirmada dir=" + (dir == BBX_DIR_BUY ? "COMPRA" : "VENDA") +
                  " preco=" + DoubleToString(g_state.precoEntrada, g_digits) +
                  " vol=" + DoubleToString(dealVol, 2) +
                  " (Takes/SL via POSITION ou timer)");
     }
   else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
     {
      string orderCmt = "";
      ulong orderTicket = 0;
      BBX_ObterOrdemDoDeal(dealTicket, orderTicket, orderCmt);
      ENUM_BBX_PARTIAL_FLAG takeTipo = BBX_ClassificarTakePorComentario(orderCmt);

      if(takeTipo != BBX_PARTIAL_NONE)
         BBX_ExitMarcarTakeExecutado(takeTipo, dealVol);
      else
        {
         BBX_LogInfo("Saída deal=" + IntegerToString((int)dealTicket) +
                     " comentario=" + (orderCmt == "" ? "—" : orderCmt) +
                     " vol=" + DoubleToString(dealVol, 2));
         BBX_SyncStateFromMarket();
         if(!BBX_SafetyExistePosicao())
           {
            BBX_ExitCancelarPendentesPosicaoZerada("posição encerrada");
            BBX_StateAposFechamento();
           }
        }
     }
  }

#endif
