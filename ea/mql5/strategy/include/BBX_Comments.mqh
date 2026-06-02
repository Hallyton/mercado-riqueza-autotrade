//+------------------------------------------------------------------+
//| BBX_Comments.mqh — comentários padronizados de ordens/deals     |
//+------------------------------------------------------------------+
#ifndef BBX_COMMENTS_MQH
#define BBX_COMMENTS_MQH

#define BBX_CMT_ENT_BUY           "BBX_ENT_BUY"
#define BBX_CMT_ENT_SELL          "BBX_ENT_SELL"
#define BBX_CMT_T1_BUY_POS        "BBX_T1_BUY_POS"
#define BBX_CMT_T2_BUY_POS        "BBX_T2_BUY_POS"
#define BBX_CMT_T1_SELL_POS       "BBX_T1_SELL_POS"
#define BBX_CMT_T2_SELL_POS       "BBX_T2_SELL_POS"
#define BBX_CMT_EOD_CLOSE         "BBX_EOD_CLOSE"
#define BBX_CMT_EMERGENCY_CLOSE   "BBX_EMERGENCY_CLOSE"
#define BBX_CMT_CLEANUP           "BBX_CLEANUP"

string BBX_ComentarioEntradaCompra()
  {
   return BBX_CMT_ENT_BUY;
  }

string BBX_ComentarioEntradaVenda()
  {
   return BBX_CMT_ENT_SELL;
  }

string BBX_ComentarioTake1Compra()
  {
   return BBX_CMT_T1_BUY_POS;
  }

string BBX_ComentarioTake2Compra()
  {
   return BBX_CMT_T2_BUY_POS;
  }

string BBX_ComentarioTake1Venda()
  {
   return BBX_CMT_T1_SELL_POS;
  }

string BBX_ComentarioTake2Venda()
  {
   return BBX_CMT_T2_SELL_POS;
  }

string BBX_ComentarioFimDia()
  {
   return BBX_CMT_EOD_CLOSE;
  }

string BBX_ComentarioEmergencia()
  {
   return BBX_CMT_EMERGENCY_CLOSE;
  }

string BBX_ComentarioCleanup()
  {
   return BBX_CMT_CLEANUP;
  }

string BBX_ComentarioTake(const ENUM_BBX_PARTIAL_FLAG tipo, const int direcaoPos)
  {
   if(tipo == BBX_PARTIAL_TAKE1)
      return (direcaoPos == BBX_DIR_BUY) ? BBX_ComentarioTake1Compra() : BBX_ComentarioTake1Venda();
   if(tipo == BBX_PARTIAL_TAKE2)
      return (direcaoPos == BBX_DIR_BUY) ? BBX_ComentarioTake2Compra() : BBX_ComentarioTake2Venda();
   return "";
  }

bool BBX_EhComentarioTake1(const string comment)
  {
   return (comment == BBX_CMT_T1_BUY_POS || comment == BBX_CMT_T1_SELL_POS);
  }

bool BBX_EhComentarioTake2(const string comment)
  {
   return (comment == BBX_CMT_T2_BUY_POS || comment == BBX_CMT_T2_SELL_POS);
  }

bool BBX_EhComentarioEntrada(const string comment)
  {
   return (comment == BBX_CMT_ENT_BUY || comment == BBX_CMT_ENT_SELL);
  }

bool BBX_EhComentarioTake(const string comment)
  {
   return BBX_EhComentarioTake1(comment) || BBX_EhComentarioTake2(comment);
  }

bool BBX_EhComentarioDoEA(const string comment)
  {
   if(StringFind(comment, "BBX_") == 0)
      return true;
   return false;
  }

ENUM_BBX_PARTIAL_FLAG BBX_ClassificarTakePorComentario(const string comment)
  {
   if(BBX_EhComentarioTake1(comment))
      return BBX_PARTIAL_TAKE1;
   if(BBX_EhComentarioTake2(comment))
      return BBX_PARTIAL_TAKE2;
   return BBX_PARTIAL_NONE;
  }

bool BBX_ComentarioTakeCombinaPosicao(const string comment, const int direcaoPos)
  {
   if(direcaoPos == BBX_DIR_BUY)
      return (comment == BBX_CMT_T1_BUY_POS || comment == BBX_CMT_T2_BUY_POS);
   if(direcaoPos == BBX_DIR_SELL)
      return (comment == BBX_CMT_T1_SELL_POS || comment == BBX_CMT_T2_SELL_POS);
   return false;
  }

int BBX_DirecaoPosicaoPorComentarioTake(const string comment)
  {
   if(comment == BBX_CMT_T1_BUY_POS || comment == BBX_CMT_T2_BUY_POS)
      return BBX_DIR_BUY;
   if(comment == BBX_CMT_T1_SELL_POS || comment == BBX_CMT_T2_SELL_POS)
      return BBX_DIR_SELL;
   return BBX_DIR_NONE;
  }

bool BBX_ValidarTakeComentarioPosicao(const string comment)
  {
   ENUM_BBX_PARTIAL_FLAG takeTipo = BBX_ClassificarTakePorComentario(comment);
   if(takeTipo == BBX_PARTIAL_NONE)
      return false;
   int dirTake = BBX_DirecaoPosicaoPorComentarioTake(comment);
   if(dirTake == BBX_DIR_NONE)
      return false;
   if(g_state.direcaoPosicao != BBX_DIR_NONE && g_state.direcaoPosicao != dirTake)
      return false;
   return true;
  }

string BBX_ExitKindTexto(const ENUM_BBX_EXIT_KIND kind)
  {
   switch(kind)
     {
      case BBX_EXIT_TAKE1:            return "Take1";
      case BBX_EXIT_TAKE2:            return "Take2";
      case BBX_EXIT_STOP_LOSS:        return "StopLoss";
      case BBX_EXIT_EOD_CLOSE:        return "FimDia";
      case BBX_EXIT_EMERGENCY_CLOSE:  return "Emergencia";
      case BBX_EXIT_MANUAL:           return "Manual";
      case BBX_EXIT_UNKNOWN:          return "Desconhecido";
      default:                        return "—";
     }
  }

ENUM_BBX_EXIT_KIND BBX_ClassificarSaidaSemTake(const ulong dealTicket, const string orderComment)
  {
   if(orderComment == BBX_CMT_EOD_CLOSE ||
      g_state.ultimoComentarioFechamento == BBX_CMT_EOD_CLOSE)
      return BBX_EXIT_EOD_CLOSE;
   if(orderComment == BBX_CMT_EMERGENCY_CLOSE ||
      g_state.ultimoComentarioFechamento == BBX_CMT_EMERGENCY_CLOSE)
      return BBX_EXIT_EMERGENCY_CLOSE;

   if(HistoryDealSelect(dealTicket))
     {
      long reason = HistoryDealGetInteger(dealTicket, DEAL_REASON);
      if(reason == DEAL_REASON_SL || reason == DEAL_REASON_SO)
         return BBX_EXIT_STOP_LOSS;
      if(reason == DEAL_REASON_CLIENT)
         return BBX_EXIT_MANUAL;
      if(reason == DEAL_REASON_EXPERT)
        {
         if(g_state.ultimoComentarioFechamento == BBX_CMT_EOD_CLOSE)
            return BBX_EXIT_EOD_CLOSE;
         if(g_state.ultimoComentarioFechamento == BBX_CMT_EMERGENCY_CLOSE)
            return BBX_EXIT_EMERGENCY_CLOSE;
        }
     }
   return BBX_EXIT_UNKNOWN;
  }

bool BBX_ObterOrdemDoDeal(const ulong dealTicket, ulong &orderTicket, string &comment)
  {
   comment = "";
   orderTicket = 0;
   if(dealTicket == 0 || !HistoryDealSelect(dealTicket))
      return false;
   orderTicket = (ulong)HistoryDealGetInteger(dealTicket, DEAL_ORDER);
   if(orderTicket == 0 || !HistoryOrderSelect(orderTicket))
      return false;
   if(HistoryOrderGetString(orderTicket, ORDER_SYMBOL) != g_symbol)
      return false;
   if((ulong)HistoryOrderGetInteger(orderTicket, ORDER_MAGIC) != MagicNumber)
      return false;
   comment = HistoryOrderGetString(orderTicket, ORDER_COMMENT);
   return true;
  }

bool BBX_ObterComentarioOrdemDeal(const ulong dealTicket, string &comment)
  {
   ulong orderTicket = 0;
   return BBX_ObterOrdemDoDeal(dealTicket, orderTicket, comment);
  }

bool BBX_OrdemPertenceEA(const ulong ticket)
  {
   if(ticket == 0 || !g_ordInfo.Select(ticket))
      return false;
   if(g_ordInfo.Symbol() != g_symbol)
      return false;
   if((ulong)g_ordInfo.Magic() != MagicNumber)
      return false;
   return BBX_EhComentarioDoEA(g_ordInfo.Comment());
  }

#endif
