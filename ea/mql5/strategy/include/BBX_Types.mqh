//+------------------------------------------------------------------+
//| BBX_Types.mqh — tipos e constantes BlackBOXD1                    |
//| Mercado da Riqueza — uso proprietário                            |
//+------------------------------------------------------------------+
#ifndef BBX_TYPES_MQH
#define BBX_TYPES_MQH

#define BBX_LOG_PREFIX "[BlackBOXD1] "
#define BBX_EA_VERSION "5.0.1-v1"

enum ENUM_BBX_DIR
  {
   BBX_DIR_NONE = 0,
   BBX_DIR_BUY  = 1,
   BBX_DIR_SELL = -1
  };

enum ENUM_BBX_SCENARIO
  {
   BBX_SCENARIO_NONE = 0,
   BBX_CENARIO_ENTRE_NIVEIS,
   BBX_CENARIO_ACIMA_VENDA,
   BBX_CENARIO_ABAIXO_COMPRA
  };

enum ENUM_BBX_CYCLE_STATE
  {
   BBX_STATE_FLAT = 0,
   BBX_STATE_PENDENTE,
   BBX_STATE_ABERTA,
   BBX_STATE_TAKE1_ENVIADO,
   BBX_STATE_TAKE1_EXECUTADO,
   BBX_STATE_TAKE2_ENVIADO,
   BBX_STATE_TAKE2_EXECUTADO,
   BBX_STATE_RESTO_TS,
   BBX_STATE_FECHADA,
   BBX_STATE_BLOQUEIO_CRITICO
  };

enum ENUM_BBX_PARTIAL_FLAG
  {
   BBX_PARTIAL_NONE = 0,
   BBX_PARTIAL_TAKE1,
   BBX_PARTIAL_TAKE2
  };

enum ENUM_BBX_EXIT_KIND
  {
   BBX_EXIT_NONE = 0,
   BBX_EXIT_TAKE1,
   BBX_EXIT_TAKE2,
   BBX_EXIT_STOP_LOSS,
   BBX_EXIT_EOD_CLOSE,
   BBX_EXIT_EMERGENCY_CLOSE,
   BBX_EXIT_MANUAL,
   BBX_EXIT_UNKNOWN
  };

struct StrategyLevels
  {
   double             maxD1Prev;
   double             minD1Prev;
   double             amplitude;
   double             fiboDist;
   double             compra;
   double             venda;
   double             precoAtual;
   ENUM_BBX_SCENARIO  scenario;
  };

struct TradeCycleState
  {
   ENUM_BBX_CYCLE_STATE phase;
   int                  direcaoPosicao;
   ulong                entryTicketBuy;
   ulong                entryTicketSell;
   ulong                positionTicket;
   ulong                take1Ticket;
   ulong                take2Ticket;
   bool                 slConfirmed;
   bool                 t1Sent;
   bool                 t1Done;
   bool                 t2Sent;
   bool                 t2Done;
   bool                 beApplied;
   bool                 trailingActive;
   bool                 criticalBlock;
   double               volumeEntrada;
   double               volumeAtual;
   double               volumeAntesParcial;
   double               precoEntrada;
   int                  operacoesDia;
   int                  tentativasStop;
   bool                 encerramentoExecutado;
   bool                 cancelamentoOrdensExecutado;
   datetime             dayKey;
   datetime             entradaConfirmadaEm;
   bool                 flagEntradaExecutada;
   bool                 flagSaidaParcial;
   bool                 flagCancelarContraria;
   int                  dirEntradaExecutada;
   ENUM_BBX_PARTIAL_FLAG flagParcialTipo;
   ulong                ultimoDealTicket;
   ulong                flagParcialOrderTicket;
   double               flagParcialDealVol;
   string               ultimoComentarioFechamento;
  };

#endif
