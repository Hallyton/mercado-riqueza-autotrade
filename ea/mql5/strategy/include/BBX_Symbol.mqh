//+------------------------------------------------------------------+
//| BBX_Symbol.mqh — propriedades e normalização do símbolo          |
//+------------------------------------------------------------------+
#ifndef BBX_SYMBOL_MQH
#define BBX_SYMBOL_MQH

double g_point;
double g_tickSize;
int    g_digits;
double g_volMin;
double g_volMax;
double g_volStep;
int    g_stopsLevel;
int    g_freezeLevel;

bool BBX_CarregarPropriedadesSimbolo()
  {
   g_point       = SymbolInfoDouble(g_symbol, SYMBOL_POINT);
   g_tickSize    = SymbolInfoDouble(g_symbol, SYMBOL_TRADE_TICK_SIZE);
   g_volMin      = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_MIN);
   g_volMax      = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_MAX);
   g_volStep     = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_STEP);
   g_digits      = (int)SymbolInfoInteger(g_symbol, SYMBOL_DIGITS);
   g_stopsLevel  = (int)SymbolInfoInteger(g_symbol, SYMBOL_TRADE_STOPS_LEVEL);
   g_freezeLevel = (int)SymbolInfoInteger(g_symbol, SYMBOL_TRADE_FREEZE_LEVEL);

   if(g_point <= 0.0 || g_tickSize <= 0.0 || g_volMin <= 0.0 || g_volStep <= 0.0)
     {
      BBX_LogCritico("Propriedades do símbolo inválidas");
      return false;
     }
   return true;
  }

double BBX_NormalizePrice(const double price)
  {
   double tick = (g_tickSize > 0.0) ? g_tickSize : g_point;
   if(tick <= 0.0)
      return NormalizeDouble(price, g_digits);
   return NormalizeDouble(MathRound(price / tick) * tick, g_digits);
  }

double BBX_NormalizeVolume(const double volume)
  {
   if(g_volStep <= 0.0)
      return 0.0;
   double v = MathFloor(volume / g_volStep + 1e-8) * g_volStep;
   v = NormalizeDouble(v, 8);
   if(v < g_volMin)
      v = g_volMin;
   if(v > g_volMax)
      v = g_volMax;
   return v;
  }

bool BBX_ValidarVolume(const double volume)
  {
   double v = BBX_NormalizeVolume(volume);
   if(v < g_volMin - 1e-12 || v > g_volMax + 1e-12)
      return false;
   double steps = (v - g_volMin) / g_volStep;
   return MathAbs(steps - MathRound(steps)) < 1e-6;
  }

double BBX_PassoPrecoPontos()
  {
   // B3 (WDO/WIN): "pontos" do usuário = incremento mínimo do contrato (tick), não _Point.
   if(g_tickSize > g_point + 1e-12)
      return g_tickSize;
   return g_point;
  }

double BBX_PontosParaDistanciaPreco(const double pontos)
  {
   if(pontos <= 0.0)
      return 0.0;
   double passo = BBX_PassoPrecoPontos();
   if(passo <= 0.0)
      return 0.0;
   return pontos * passo;
  }

double BBX_PrecoComDistancia(const double precoBase, const double distanciaPreco, const bool somar)
  {
   if(distanciaPreco < 0.0)
      return 0.0;
   double px = somar ? (precoBase + distanciaPreco) : (precoBase - distanciaPreco);
   return BBX_NormalizePrice(px);
  }

double BBX_PrecoComPontos(const double precoBase, const double pontos, const bool somar)
  {
   return BBX_PrecoComDistancia(precoBase, BBX_PontosParaDistanciaPreco(pontos), somar);
  }

double BBX_DistanciaMinimaOrdem()
  {
   double minStops = (double)g_stopsLevel * g_point;
   if(minStops <= 0.0)
      minStops = g_tickSize;
   if(minStops <= 0.0)
      minStops = g_point;

   double minFreeze = 0.0;
   if(g_freezeLevel > 0)
      minFreeze = (double)g_freezeLevel * g_point;

   double tickMargem = (g_tickSize > 0.0) ? g_tickSize : g_point;
   return MathMax(minStops, minFreeze) + tickMargem;
  }

double BBX_DistanciaMinimaPreco()
  {
   return BBX_DistanciaMinimaOrdem();
  }

bool BBX_ObterTickMercado(MqlTick &tick, string &motivo)
  {
   motivo = "";
   if(!SymbolInfoTick(g_symbol, tick))
     {
      motivo = "SymbolInfoTick indisponível";
      return false;
     }
   if(tick.bid <= 0.0 || tick.ask <= 0.0)
     {
      motivo = "Bid ou Ask inválidos";
      return false;
     }
   if(g_tickSize <= 0.0)
     {
      motivo = "SYMBOL_TRADE_TICK_SIZE inválido";
      return false;
     }
   return true;
  }

string BBX_TipoOrdemParaTexto(const ENUM_ORDER_TYPE tipo)
  {
   switch(tipo)
     {
      case ORDER_TYPE_BUY_LIMIT:  return "BUY_LIMIT";
      case ORDER_TYPE_BUY_STOP:   return "BUY_STOP";
      case ORDER_TYPE_SELL_LIMIT: return "SELL_LIMIT";
      case ORDER_TYPE_SELL_STOP:  return "SELL_STOP";
      default:                    return "DESCONHECIDO";
     }
  }

bool BBX_ValidarPrecoOrdemPendente(const ENUM_ORDER_TYPE tipo, double preco,
                                   const string origem, string &motivo, const MqlTick &tick)
  {
   motivo = "";
   if(preco <= 0.0)
     {
      motivo = "preço <= 0";
      return false;
     }
   if(tick.bid <= 0.0 || tick.ask <= 0.0)
     {
      motivo = "Bid ou Ask inválidos";
      return false;
     }
   if(g_tickSize <= 0.0 || g_point <= 0.0)
     {
      motivo = "tick size ou point inválido";
      return false;
     }

   double p = BBX_NormalizePrice(preco);
   double minDist = BBX_DistanciaMinimaOrdem();

   switch(tipo)
     {
      case ORDER_TYPE_BUY_LIMIT:
         if(p >= tick.ask - 1e-12)
           {
            motivo = "BUY LIMIT bloqueada: preço compra não está abaixo do Ask";
            return false;
           }
         if(tick.ask - p < minDist - 1e-12)
           {
            motivo = "BUY_LIMIT: distancia Ask-preco insuficiente";
            return false;
           }
         break;

      case ORDER_TYPE_SELL_LIMIT:
         if(p <= tick.bid + 1e-12)
           {
            motivo = "SELL LIMIT bloqueada: preço venda não está acima do Bid";
            return false;
           }
         if(p - tick.bid < minDist - 1e-12)
           {
            motivo = "SELL_LIMIT: distancia preco-Bid insuficiente";
            return false;
           }
         break;

      default:
         motivo = "Fase 1 aceita somente BUY LIMIT ou SELL LIMIT";
         return false;
     }

   if(g_freezeLevel > 0)
     {
      double freezeDist = (double)g_freezeLevel * g_point;
      double ref = (tipo == ORDER_TYPE_BUY_LIMIT) ? tick.ask : tick.bid;
      if(MathAbs(p - ref) < freezeDist - 1e-12)
        {
         motivo = "preco dentro da SYMBOL_TRADE_FREEZE_LEVEL";
         return false;
        }
     }
   return true;
  }

bool BBX_ValidarPrecoOrdemTake(const ENUM_ORDER_TYPE tipo, const double preco,
                               const double precoEntrada, const int dirPos,
                               string &motivo, const MqlTick &tick)
  {
   motivo = "";
   double p = BBX_NormalizePrice(preco);
   if(p <= 0.0)
     {
      motivo = "preço take inválido";
      return false;
     }

   double minDist = BBX_DistanciaMinimaOrdem();

   if(dirPos == BBX_DIR_BUY && tipo == ORDER_TYPE_SELL_LIMIT)
     {
      if(p <= precoEntrada + minDist - 1e-12)
        { motivo = "Take compra deve ficar acima da entrada + distância mínima"; return false; }
      if(p <= tick.ask + minDist - 1e-12)
        { motivo = "Take SELL LIMIT deve ficar acima do Ask (evita fechamento imediato)"; return false; }
      return true;
     }
   if(dirPos == BBX_DIR_SELL && tipo == ORDER_TYPE_BUY_LIMIT)
     {
      if(p >= precoEntrada - minDist + 1e-12)
        { motivo = "Take venda deve ficar abaixo da entrada - distância mínima"; return false; }
      if(p >= tick.bid - minDist + 1e-12)
        { motivo = "Take BUY LIMIT deve ficar abaixo do Bid (evita fechamento imediato)"; return false; }
      return true;
     }

   motivo = "tipo de ordem take inválido";
   return false;
  }

double BBX_ToleranciaPrecoOrdem()
  {
   double t = (g_tickSize > 0.0) ? g_tickSize : g_point;
   return MathMax(t * 2.0, g_point);
  }

bool BBX_ValidarAmbienteBasico()
  {
   if(!SymbolInfoInteger(g_symbol, SYMBOL_SELECT))
      SymbolSelect(g_symbol, true);
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
     {
      BBX_LogCritico("Trading não permitido no terminal");
      return false;
     }
   if(SymbolInfoInteger(g_symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED)
     {
      BBX_LogCritico("Símbolo com negociação desabilitada");
      return false;
     }
   return true;
  }

bool BBX_PrecosMercadoValidos()
  {
   MqlTick tick;
   string motivo = "";
   if(!BBX_ObterTickMercado(tick, motivo))
     {
      BBX_LogUnico("bid_ask_invalido", "Mercado inválido — ordem não enviada: " + motivo, true);
      return false;
     }
   if(tick.ask < tick.bid - 1e-12)
     {
      BBX_LogUnico("bid_ask_invalido", "Mercado inválido — Ask < Bid", true);
      return false;
     }
   return true;
  }

string BBX_ModoContaTexto()
  {
   long mode = AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   if(mode == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      return "HEDGING";
   if(mode == ACCOUNT_MARGIN_MODE_RETAIL_NETTING)
      return "NETTING";
   if(mode == ACCOUNT_MARGIN_MODE_EXCHANGE)
      return "EXCHANGE";
   return "DESCONHECIDO";
  }

bool BBX_ContaHedging()
  {
   return AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
  }

bool BBX_PositionCloseComComentario(const ulong positionTicket, const string comment)
  {
   if(positionTicket == 0 || !g_posInfo.SelectByTicket(positionTicket))
      return false;

   string sym = g_posInfo.Symbol();
   double vol = g_posInfo.Volume();
   ENUM_POSITION_TYPE ptype = g_posInfo.PositionType();

   MqlTradeRequest req;
   MqlTradeResult res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action       = TRADE_ACTION_DEAL;
   req.position     = positionTicket;
   req.symbol       = sym;
   req.volume       = vol;
   req.deviation    = 20;
   req.magic        = MagicNumber;
   req.comment      = comment;
   req.type_filling = ORDER_FILLING_RETURN;

   if(ptype == POSITION_TYPE_BUY)
     {
      req.type  = ORDER_TYPE_SELL;
      req.price = SymbolInfoDouble(sym, SYMBOL_BID);
     }
   else
     {
      req.type  = ORDER_TYPE_BUY;
      req.price = SymbolInfoDouble(sym, SYMBOL_ASK);
     }

   if(!OrderSend(req, res))
     {
      BBX_LogRetcode("OrderSend fechamento comentario=" + comment, res.retcode, res.comment);
      return false;
     }
   return BBX_RetcodeSucesso(res.retcode);
  }

#endif
