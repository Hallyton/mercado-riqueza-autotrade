//+------------------------------------------------------------------+
//| MR_FiboD1_Config.mqh — config runtime da estratégia (site)       |
//+------------------------------------------------------------------+
#property strict

#include "MR_AT_Json.mqh"
#include "MR_AT_Log.mqh"

struct MR_FiboD1Config
  {
   bool              loaded;
   int               version;
   string            configHash;
   double            percentualFibo;
   double            loteTotal;
   double            stopPontos;
   double            alvo1Pontos;
   double            alvo2Pontos;
   double            loteAlvo1;
   double            loteAlvo2;
   double            loteFinal;
   double            trailStepPontos;
   double            trailOffsetPontos;
   string            horarioInicio;
   string            horarioFimEntradas;
   string            horarioZeragem;
   bool              zerarNoFimDoDia;
   bool              prepararNiveisAntesDaAbertura;
   int               minutosAntesParaPreparar;
   int               slippagePoints;
   double            maxSpreadPontos;
   bool              forcarTickDolarB3;
   double            tickOperacionalDolar;
   int               digitosPrecoOperacional;
   bool              bloquearTesterSeLastZero;
   bool              mostrarLinhasNoGrafico;
   bool              removerObjetosAntigos;
   bool              mostrarPainelAdmin;
   int               painelX;
   int               painelY;
   string            corFundoPainel;
  };

MR_FiboD1Config g_mr_fibo_config;
string          g_mr_fibo_last_config_hash = "";

//+------------------------------------------------------------------+
bool MR_Fibo_ExtractJsonObject(const string json, const string key, string &obj_out)
  {
   obj_out = "";
   int p = MR_AT_JsonFindKey(json, key);
   if(p < 0)
      return false;
   int colon = StringFind(json, ":", p);
   if(colon < 0)
      return false;
   int start = colon + 1;
   while(start < StringLen(json))
     {
      ushort ch = StringGetCharacter(json, start);
      if(ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t')
        {
         start++;
         continue;
        }
      if(ch != '{')
         return false;
      break;
     }

   int depth = 0;
   int obj_end = -1;
   int len = StringLen(json);
   for(int i = start; i < len; i++)
     {
      ushort ch = StringGetCharacter(json, i);
      if(ch == '{')
         depth++;
      else if(ch == '}')
        {
         depth--;
         if(depth == 0)
           {
            obj_end = i;
            break;
           }
        }
     }
   if(obj_end < 0)
      return false;
   obj_out = StringSubstr(json, start, obj_end - start + 1);
   return true;
  }

//+------------------------------------------------------------------+
void MR_Fibo_ApplyDefaults(MR_FiboD1Config &cfg)
  {
   cfg.loaded = false;
   cfg.version = 0;
   cfg.configHash = "";
   cfg.percentualFibo = 0.20;
   cfg.loteTotal = 5.0;
   cfg.stopPontos = 7.0;
   cfg.alvo1Pontos = 5.0;
   cfg.alvo2Pontos = 10.0;
   cfg.loteAlvo1 = 3.0;
   cfg.loteAlvo2 = 1.0;
   cfg.loteFinal = 1.0;
   cfg.trailStepPontos = 3.0;
   cfg.trailOffsetPontos = 3.0;
   cfg.horarioInicio = "09:15";
   cfg.horarioFimEntradas = "17:30";
   cfg.horarioZeragem = "17:30";
   cfg.zerarNoFimDoDia = true;
   cfg.prepararNiveisAntesDaAbertura = true;
   cfg.minutosAntesParaPreparar = 1;
   cfg.slippagePoints = 30;
   cfg.maxSpreadPontos = 0.0;
   cfg.forcarTickDolarB3 = true;
   cfg.tickOperacionalDolar = 0.5;
   cfg.digitosPrecoOperacional = 1;
   cfg.bloquearTesterSeLastZero = true;
   cfg.mostrarLinhasNoGrafico = true;
   cfg.removerObjetosAntigos = true;
   cfg.mostrarPainelAdmin = true;
   cfg.painelX = 10;
   cfg.painelY = 30;
   cfg.corFundoPainel = "DarkBlue";
  }

//+------------------------------------------------------------------+
bool MR_Fibo_ParseConfigFromEaJson(const string json, MR_FiboD1Config &cfg)
  {
   MR_Fibo_ApplyDefaults(cfg);

   string strategyObj = "";
   if(!MR_Fibo_ExtractJsonObject(json, "strategy_config", strategyObj))
      return false;

   cfg.version = MR_AT_JsonGetInt(json, "strategy_config_version");
   cfg.configHash = MR_AT_JsonGetString(json, "strategy_config_hash");

   string fiboObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "fibo_d1", fiboObj))
      cfg.percentualFibo = MR_AT_JsonGetDouble(fiboObj, "percentual_fibo");

   string riskObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "risk", riskObj))
     {
      cfg.loteTotal = MR_AT_JsonGetDouble(riskObj, "lote_total");
      cfg.stopPontos = MR_AT_JsonGetDouble(riskObj, "stop_pontos");
     }

   string partialsObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "partials_and_trailing", partialsObj))
     {
      cfg.alvo1Pontos = MR_AT_JsonGetDouble(partialsObj, "alvo1_pontos");
      cfg.alvo2Pontos = MR_AT_JsonGetDouble(partialsObj, "alvo2_pontos");
      cfg.loteAlvo1 = MR_AT_JsonGetDouble(partialsObj, "lote_alvo1");
      cfg.loteAlvo2 = MR_AT_JsonGetDouble(partialsObj, "lote_alvo2");
      cfg.loteFinal = MR_AT_JsonGetDouble(partialsObj, "lote_final");
      cfg.trailStepPontos = MR_AT_JsonGetDouble(partialsObj, "trail_step_pontos");
      cfg.trailOffsetPontos = MR_AT_JsonGetDouble(partialsObj, "trail_offset_pontos");
     }

   string hoursObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "operational_hours", hoursObj))
     {
      cfg.horarioInicio = MR_AT_JsonGetString(hoursObj, "horario_inicio");
      cfg.horarioFimEntradas = MR_AT_JsonGetString(hoursObj, "horario_fim_entradas");
      cfg.horarioZeragem = MR_AT_JsonGetString(hoursObj, "horario_zeragem");
      cfg.zerarNoFimDoDia = MR_AT_JsonGetBool(hoursObj, "zerar_no_fim_do_dia");
      cfg.prepararNiveisAntesDaAbertura =
         MR_AT_JsonGetBool(hoursObj, "preparar_niveis_antes_da_abertura");
      cfg.minutosAntesParaPreparar =
         MR_AT_JsonGetInt(hoursObj, "minutos_antes_para_preparar");
     }

   string execObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "execution_and_spread", execObj))
     {
      cfg.slippagePoints = MR_AT_JsonGetInt(execObj, "slippage_points");
      cfg.maxSpreadPontos = MR_AT_JsonGetDouble(execObj, "max_spread_pontos");
     }

   string b3Obj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "b3_dollar_normalization", b3Obj))
     {
      cfg.forcarTickDolarB3 = MR_AT_JsonGetBool(b3Obj, "forcar_tick_dolar_b3");
      cfg.tickOperacionalDolar = MR_AT_JsonGetDouble(b3Obj, "tick_operacional_dolar");
      cfg.digitosPrecoOperacional =
         MR_AT_JsonGetInt(b3Obj, "digitos_preco_operacional");
     }

   string safetyObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "safety", safetyObj))
      cfg.bloquearTesterSeLastZero =
         MR_AT_JsonGetBool(safetyObj, "bloquear_tester_se_last_zero");

   string chartObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "chart_visual", chartObj))
     {
      cfg.mostrarLinhasNoGrafico =
         MR_AT_JsonGetBool(chartObj, "mostrar_linhas_no_grafico");
      cfg.removerObjetosAntigos =
         MR_AT_JsonGetBool(chartObj, "remover_objetos_antigos");
     }

   string panelObj = "";
   if(MR_Fibo_ExtractJsonObject(strategyObj, "admin_panel", panelObj))
     {
      cfg.mostrarPainelAdmin = MR_AT_JsonGetBool(panelObj, "mostrar_painel_admin");
      cfg.painelX = MR_AT_JsonGetInt(panelObj, "painel_x");
      cfg.painelY = MR_AT_JsonGetInt(panelObj, "painel_y");
      cfg.corFundoPainel = MR_AT_JsonGetString(panelObj, "cor_fundo_painel");
     }

   if(cfg.percentualFibo <= 0 || cfg.loteTotal <= 0 || cfg.stopPontos <= 0)
      return false;

   if(StringLen(cfg.horarioInicio) < 4 || StringLen(cfg.horarioFimEntradas) < 4)
      return false;

   cfg.loaded = true;
   return true;
  }

//+------------------------------------------------------------------+
bool MR_Fibo_ApplyConfigFromEaResponse(const string json)
  {
   MR_FiboD1Config parsed;
   if(!MR_Fibo_ParseConfigFromEaJson(json, parsed))
     {
      g_mr_fibo_config.loaded = false;
      return false;
     }

   if(StringLen(parsed.configHash) > 0 &&
      parsed.configHash != g_mr_fibo_last_config_hash)
     {
      MR_AT_LogInfo("FiboConfig",
         "STRATEGY_CONFIG_UPDATED v=" + IntegerToString(parsed.version) +
         " hash=" + StringSubstr(parsed.configHash, 0, 12));
      g_mr_fibo_last_config_hash = parsed.configHash;
     }

   g_mr_fibo_config = parsed;
   return true;
  }

//+------------------------------------------------------------------+
bool MR_Fibo_IsConfigReadyForReal()
  {
   return g_mr_fibo_config.loaded;
  }
