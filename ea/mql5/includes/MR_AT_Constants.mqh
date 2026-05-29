//+------------------------------------------------------------------+
//| MR_AT_Constants.mqh — Mercado da Riqueza AutoTrade Executor      |
//+------------------------------------------------------------------+
#property strict

#define MR_AT_EA_NAME           "MR_AutoTrade_Executor"
#define MR_AT_EA_VERSION        "1.0.0"
#define MR_AT_EA_MAGIC          20260520
#define MR_AT_HTTP_TIMEOUT_MS   15000
#define MR_AT_GV_TOKEN_PREFIX   "MR_AT_TOKEN_"
#define MR_AT_GV_LICENSE_PREFIX "MR_AT_LICENSE_"
#define MR_AT_MAX_INSTRUCTIONS  20
#define MR_AT_LOG_ERROR         0
#define MR_AT_LOG_INFO          1
#define MR_AT_LOG_DEBUG         2

//+------------------------------------------------------------------+
//| Estrutura de instrução autorizada pelo servidor (sem estratégia)  |
//+------------------------------------------------------------------+
struct MRInstruction
  {
   string            instruction_id;
   string            purpose;       // ENTRY | EXIT | ADJUSTMENT
   string            symbol;
   string            side;          // BUY | SELL
   string            order_type;    // MARKET | LIMIT
   double            quantity;
   double            stop_loss;
   double            take_profit;
   string            expires_at;
   string            idempotency_key;
   int               magic_number;  // obrigatório em trade_mode REAL
   string            account_login;
   string            account_server;
   string            trade_mode;    // DEMO | REAL | vazio
   bool              protection_required;
   bool              requires_protection_confirmation;
   double            requested_contracts;
   string            source;        // ex.: MASTER_SIGNAL (sem lógica estratégica)
  };

//+------------------------------------------------------------------+
//| Estado operacional sincronizado com a API                        |
//+------------------------------------------------------------------+
struct MRRuntimeState
  {
   string            device_token;
   string            license_id;
   string            device_id;
   int               heartbeat_interval_sec;
   bool              halt_new_entries;
   bool              halt_all_trading;
   bool              can_accept_new_entries;
   bool              can_manage_open_positions;
   bool              subscription_active;
   datetime            last_heartbeat;
   datetime            last_signal_pull;
  };
