//+------------------------------------------------------------------+
//| BBX_Engine.mqh — motor v1: regras literais do usuário            |
//| 1) Sem posição + preço na faixa → pendentes compra/venda         |
//| 2) Com posição → flags do dia + takes                            |
//+------------------------------------------------------------------+
#ifndef BBX_ENGINE_MQH
#define BBX_ENGINE_MQH

void BBX_EngineSyncOrdensTakes()
  {
   g_state.take1Ticket = 0;
   g_state.take2Ticket = 0;
   g_state.t1Sent = false;
   g_state.t2Sent = false;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !g_ordInfo.Select(ticket))
         continue;
      if(g_ordInfo.Symbol() != g_symbol || (ulong)g_ordInfo.Magic() != MagicNumber)
         continue;

      ENUM_BBX_PARTIAL_FLAG tipo = BBX_ClassificarTakePorComentario(g_ordInfo.Comment());
      if(tipo == BBX_PARTIAL_TAKE1)
        {
         g_state.take1Ticket = ticket;
         g_state.t1Sent = true;
        }
      else if(tipo == BBX_PARTIAL_TAKE2)
        {
         g_state.take2Ticket = ticket;
         g_state.t2Sent = true;
        }
     }
  }

void BBX_EngineGerenciarPosicao()
  {
   BBX_SyncStateFromMarket();

   if(g_state.direcaoPosicao == BBX_DIR_SELL)
      VENDIDO_NO_DIA = true;
   else if(g_state.direcaoPosicao == BBX_DIR_BUY)
      COMPRADO_NO_DIA = true;

   BBX_EntryCancelarTodas("posição aberta");
   BBX_ExitGerenciarPosicaoAberta();
  }

void BBX_EngineRun()
  {
   if(g_processing)
      return;
   g_processing = true;

   if(BBX_DetectarNovoDia())
     {
      BBX_LogInfo("Novo dia — reset flags e recálculo D-1");
      BBX_StateResetDia();
      BBX_SyncStateFromMarket();
      BBX_StrategyRecalcular();
     }

   BBX_SyncStateFromMarket();
   BBX_EngineSyncOrdensTakes();

   if(!BBX_DentroHorarioEntrada())
     {
      BBX_EntryCancelarTodas("fora do horário operacional");
      g_processing = false;
      return;
     }

   if(BBX_SafetyExistePosicao())
      BBX_EngineGerenciarPosicao();
   else
      BBX_EntryProcessar();

   g_processing = false;
  }

#endif
