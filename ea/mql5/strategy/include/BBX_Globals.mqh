//+------------------------------------------------------------------+
//| BBX_Globals.mqh — objetos e globais compartilhados               |
//+------------------------------------------------------------------+
#ifndef BBX_GLOBALS_MQH
#define BBX_GLOBALS_MQH

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
#include <Trade/OrderInfo.mqh>
#include "BBX_Types.mqh"

CTrade         g_trade;
CPositionInfo  g_posInfo;
COrderInfo     g_ordInfo;

string            g_symbol;
StrategyLevels    g_strat;
TradeCycleState   g_state;

bool COMPRADO_NO_DIA = false;
bool VENDIDO_NO_DIA  = false;
bool g_bloqEntCompra = false;
bool g_bloqEntVenda  = false;

int  g_horaInicioMin = 0;
int  g_horaFimMin = 0;

bool g_processing = false;

#endif
