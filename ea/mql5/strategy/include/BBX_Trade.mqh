//+------------------------------------------------------------------+
//| BBX_Trade.mqh — entradas via CTrade (SL na pendente); demais via  |
//| OrderSend com ZeroMemory para takes/cancelamentos.               |
//+------------------------------------------------------------------+
#ifndef BBX_TRADE_MQH
#define BBX_TRADE_MQH

ulong BBX_g_ultimoOrderTicket = 0;

void BBX_TradeConfigurarCTrade()
  {
   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(20);
   g_trade.SetTypeFilling(BBX_TradeTipoPreenchimento());
   g_trade.SetAsyncMode(false);
  }

ENUM_ORDER_TYPE_FILLING BBX_TradeTipoPreenchimento()
  {
   int filling = (int)SymbolInfoInteger(g_symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      return ORDER_FILLING_FOK;
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
  }

bool BBX_TradeEnviar(MqlTradeRequest &req, MqlTradeResult &res, const string acao)
  {
   req.magic     = MagicNumber;
   req.deviation = 20;
   if(req.type_filling == ORDER_FILLING_RETURN || req.type_filling == 0)
      req.type_filling = BBX_TradeTipoPreenchimento();

   ResetLastError();
   if(!OrderSend(req, res))
     {
      BBX_LogRetcode(acao + " OrderSend falhou", (uint)GetLastError(), "GetLastError");
      return false;
     }
   if(!BBX_RetcodeSucesso(res.retcode))
     {
      BBX_LogRetcode(acao, res.retcode, res.comment);
      return false;
     }
   BBX_g_ultimoOrderTicket = res.order;
   return true;
  }

bool BBX_TradeRemoverOrdem(const ulong ticket, const string acao)
  {
   if(ticket == 0)
      return false;

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action = TRADE_ACTION_REMOVE;
   req.order  = ticket;
   req.symbol = g_symbol;

   return BBX_TradeEnviar(req, res, acao);
  }

bool BBX_TradeEnviarPendenteLimit(const ENUM_ORDER_TYPE tipo, const double volume,
                                  const double price, const string comment,
                                  const double sl, const double tp)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action    = TRADE_ACTION_PENDING;
   req.symbol    = g_symbol;
   req.volume    = BBX_NormalizeVolume(volume);
   req.type      = tipo;
   req.price     = BBX_NormalizePrice(price);
   req.sl        = (sl > 0.0) ? BBX_NormalizePrice(sl) : 0.0;
   req.tp        = (tp > 0.0) ? BBX_NormalizePrice(tp) : 0.0;
   req.type_time = ORDER_TIME_GTC;
   req.comment   = comment;

   string acao = "Pendente " + BBX_TipoOrdemParaTexto(tipo) + " " + comment;
   return BBX_TradeEnviar(req, res, acao);
  }

bool BBX_TradeEnviarEntradaLimit(const ENUM_ORDER_TYPE tipo, const double volume,
                                 const double price, const double sl,
                                 const string comment)
  {
   BBX_TradeConfigurarCTrade();

   double vol = BBX_NormalizeVolume(volume);
   double px  = BBX_NormalizePrice(price);
   double slN = (sl > 0.0) ? BBX_NormalizePrice(sl) : 0.0;

   bool ok = false;
   if(tipo == ORDER_TYPE_BUY_LIMIT)
      ok = g_trade.BuyLimit(vol, px, g_symbol, slN, 0.0, ORDER_TIME_GTC, 0, comment);
   else if(tipo == ORDER_TYPE_SELL_LIMIT)
      ok = g_trade.SellLimit(vol, px, g_symbol, slN, 0.0, ORDER_TIME_GTC, 0, comment);
   else
     {
      BBX_LogErro("Entrada: tipo pendente não suportado — " + BBX_TipoOrdemParaTexto(tipo));
      return false;
     }

   if(!ok)
     {
      BBX_LogRetcode("Entrada CTrade " + BBX_TipoOrdemParaTexto(tipo) + " " + comment,
                     g_trade.ResultRetcode(), g_trade.ResultRetcodeDescription());
      return false;
     }

   if(!BBX_RetcodeSucesso(g_trade.ResultRetcode()))
     {
      BBX_LogRetcode("Entrada CTrade " + BBX_TipoOrdemParaTexto(tipo) + " " + comment,
                     g_trade.ResultRetcode(), g_trade.ResultRetcodeDescription());
      return false;
     }

   BBX_g_ultimoOrderTicket = g_trade.ResultOrder();
   return true;
  }

bool BBX_TradeEnviarTakeLimit(const ENUM_ORDER_TYPE tipo, const double volume,
                              const double price, const string comment)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action    = TRADE_ACTION_PENDING;
   req.symbol    = g_symbol;
   req.volume    = BBX_NormalizeVolume(volume);
   req.type      = tipo;
   req.price     = BBX_NormalizePrice(price);
   req.sl        = 0.0;
   req.tp        = 0.0;
   req.type_time = ORDER_TIME_GTC;
   req.comment   = comment;

   string acao = "Take " + BBX_TipoOrdemParaTexto(tipo) + " " + comment;
   return BBX_TradeEnviar(req, res, acao);
  }

bool BBX_TradeModificarSLTP(const ulong posTicket, const double sl, const double tp,
                            const string acao)
  {
   if(posTicket == 0 || !g_posInfo.SelectByTicket(posTicket))
      return false;

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action   = TRADE_ACTION_SLTP;
   req.position = posTicket;
   req.symbol   = g_symbol;
   req.sl       = (sl > 0.0) ? BBX_NormalizePrice(sl) : 0.0;
   req.tp       = (tp > 0.0) ? BBX_NormalizePrice(tp) : 0.0;

   return BBX_TradeEnviar(req, res, acao);
  }

bool BBX_TradeAplicarStopPosicao(const ulong posTicket, const double sl, const string acao)
  {
   if(posTicket == 0 || !g_posInfo.SelectByTicket(posTicket))
      return false;

   double tpAtual = g_posInfo.TakeProfit();
   return BBX_TradeModificarSLTP(posTicket, sl, tpAtual, acao);
  }

ulong BBX_TradeUltimoOrderTicket()
  {
   return BBX_g_ultimoOrderTicket;
  }

#endif
