//+------------------------------------------------------------------+
//| BBX_State.mqh — estado central do ciclo operacional              |
//+------------------------------------------------------------------+
#ifndef BBX_STATE_MQH
#define BBX_STATE_MQH

void BBX_StateInicializar()
  {
   ZeroMemory(g_state);
   g_state.phase = BBX_STATE_FLAT;
   g_state.direcaoPosicao = BBX_DIR_NONE;
   g_state.criticalBlock = false;
   COMPRADO_NO_DIA = false;
   VENDIDO_NO_DIA = false;
   g_bloqEntCompra = false;
   g_bloqEntVenda = false;
  }

string BBX_StateParaTexto(const ENUM_BBX_CYCLE_STATE st)
  {
   switch(st)
     {
      case BBX_STATE_FLAT:              return "FLAT";
      case BBX_STATE_PENDENTE:          return "PENDENTE";
      case BBX_STATE_ABERTA:            return "ABERTA";
      case BBX_STATE_TAKE1_ENVIADO:     return "TAKE1_ENVIADO";
      case BBX_STATE_TAKE1_EXECUTADO:   return "TAKE1_EXECUTADO";
      case BBX_STATE_TAKE2_ENVIADO:     return "TAKE2_ENVIADO";
      case BBX_STATE_TAKE2_EXECUTADO:   return "TAKE2_EXECUTADO";
      case BBX_STATE_RESTO_TS:          return "RESTO_TS";
      case BBX_STATE_FECHADA:           return "FECHADA";
      case BBX_STATE_BLOQUEIO_CRITICO:  return "BLOQUEIO_CRITICO";
      default:                          return "—";
     }
  }

void BBX_AtualizarVolumeRestante()
  {
   g_state.volumeAtual = BBX_NormalizeVolume(g_state.volumeAtual);
   if(g_state.volumeAtual < 0.0)
      g_state.volumeAtual = 0.0;
  }

void BBX_SyncStateFromMarket()
  {
   g_state.positionTicket = 0;
   g_state.volumeAtual = 0.0;
   g_state.direcaoPosicao = BBX_DIR_NONE;
   g_state.slConfirmed = false;

   int posCount = 0;
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

      posCount++;
      g_state.positionTicket = ticket;
      g_state.volumeAtual = g_posInfo.Volume();
      g_state.precoEntrada = g_posInfo.PriceOpen();
      g_state.slConfirmed = (g_posInfo.StopLoss() > 0.0);
      if(g_posInfo.PositionType() == POSITION_TYPE_BUY)
        {
         g_state.direcaoPosicao = BBX_DIR_BUY;
         COMPRADO_NO_DIA = true;
        }
      else if(g_posInfo.PositionType() == POSITION_TYPE_SELL)
        {
         g_state.direcaoPosicao = BBX_DIR_SELL;
         VENDIDO_NO_DIA = true;
        }
     }

   if(posCount > 1 && BBX_ContaHedging())
     {
      BBX_LogCritico("Múltiplas posições EA detectadas");
      g_state.criticalBlock = true;
      g_state.phase = BBX_STATE_BLOQUEIO_CRITICO;
     }

   if(g_state.positionTicket > 0 && g_state.volumeEntrada <= 0.0)
      g_state.volumeEntrada = g_state.volumeAtual;

   BBX_AtualizarVolumeRestante();
  }

bool BBX_GarantirPosicaoAtual()
  {
   BBX_SyncStateFromMarket();
   return (g_state.positionTicket > 0);
  }

void BBX_StateResetDia()
  {
   g_state.operacoesDia = 0;
   g_state.encerramentoExecutado = false;
   g_state.cancelamentoOrdensExecutado = false;
   g_state.tentativasStop = 0;
   g_state.entryTicketBuy = 0;
   g_state.entryTicketSell = 0;
   g_state.take1Ticket = 0;
   g_state.take2Ticket = 0;
   g_state.t1Sent = g_state.t1Done = false;
   g_state.t2Sent = g_state.t2Done = false;
   g_state.beApplied = false;
   g_state.trailingActive = false;
   g_state.flagEntradaExecutada = false;
   g_state.flagSaidaParcial = false;
   g_state.flagCancelarContraria = false;
   g_state.flagParcialTipo = BBX_PARTIAL_NONE;
   g_state.flagParcialOrderTicket = 0;
   g_state.flagParcialDealVol = 0.0;
   g_state.precoEntrada = 0.0;
   g_state.volumeEntrada = 0.0;
   g_state.ultimoComentarioFechamento = "";
   g_state.entradaConfirmadaEm = 0;
   COMPRADO_NO_DIA = false;
   VENDIDO_NO_DIA = false;
   g_bloqEntCompra = false;
   g_bloqEntVenda = false;
   if(!g_state.criticalBlock)
      g_state.phase = BBX_STATE_FLAT;
  }

void BBX_StateResetCicloPosicao()
  {
   g_state.t1Sent = g_state.t1Done = false;
   g_state.t2Sent = g_state.t2Done = false;
   g_state.take1Ticket = 0;
   g_state.take2Ticket = 0;
   g_state.beApplied = false;
   g_state.trailingActive = false;
   g_state.slConfirmed = false;
  }

void BBX_StateAposFechamento()
  {
   g_state.positionTicket = 0;
   g_state.volumeAtual = 0.0;
   g_state.direcaoPosicao = BBX_DIR_NONE;
   g_state.slConfirmed = false;
   BBX_StateResetCicloPosicao();
   g_state.phase = g_state.criticalBlock ? BBX_STATE_BLOQUEIO_CRITICO : BBX_STATE_FECHADA;
  }

void BBX_StateMarcarEntradaExecutada(const int direcao)
  {
   g_state.flagEntradaExecutada = true;
   g_state.dirEntradaExecutada = direcao;
   g_state.flagCancelarContraria = false;
   g_state.operacoesDia++;
   g_state.tentativasStop = 0;
   g_state.entradaConfirmadaEm = TimeCurrent();
   if(direcao == BBX_DIR_BUY)
      COMPRADO_NO_DIA = true;
   else if(direcao == BBX_DIR_SELL)
      VENDIDO_NO_DIA = true;
  }

void BBX_StateMarcarSaidaParcial(const ENUM_BBX_PARTIAL_FLAG tipo,
                                  const ulong orderTicket,
                                  const double dealVol)
  {
   g_state.flagSaidaParcial = true;
   g_state.flagParcialTipo = tipo;
   g_state.flagParcialOrderTicket = orderTicket;
   g_state.flagParcialDealVol = dealVol;
  }

void BBX_StateLimparTicketOrdem(const ulong ticket)
  {
   if(g_state.entryTicketBuy == ticket)
      g_state.entryTicketBuy = 0;
   if(g_state.entryTicketSell == ticket)
      g_state.entryTicketSell = 0;
   if(g_state.take1Ticket == ticket)
     {
      g_state.take1Ticket = 0;
      g_state.t1Sent = false;
     }
   if(g_state.take2Ticket == ticket)
     {
      g_state.take2Ticket = 0;
      g_state.t2Sent = false;
     }
  }

#endif
