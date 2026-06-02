//+------------------------------------------------------------------+
//| BBX_Panel.mqh — painel gráfico                                   |
//+------------------------------------------------------------------+
#ifndef BBX_PANEL_MQH
#define BBX_PANEL_MQH

void BBX_PanelMostrar()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   string horaAtual = StringFormat("%02d:%02d", dt.hour, dt.min);

   BBX_SyncStateFromMarket();
   g_strat.scenario = BBX_StrategyDetectarCenario();

   string dirPos = "—";
   if(g_state.direcaoPosicao == BBX_DIR_BUY)
      dirPos = "COMPRA";
   else if(g_state.direcaoPosicao == BBX_DIR_SELL)
      dirPos = "VENDA";

   double slPainel = 0.0;
   if(g_state.positionTicket > 0 && g_posInfo.SelectByTicket(g_state.positionTicket))
      slPainel = g_posInfo.StopLoss();

   string txt = "";
   txt += "Mercado da Riqueza\n";
   txt += "BlackBOXD1\n";
   txt += "Versão: " + BBX_EA_VERSION + "\n";
   txt += "────────────────────────\n";
   txt += "Símbolo: " + g_symbol + "\n";
   txt += "Modo conta: " + BBX_ModoContaTexto() + "\n";
   txt += "Estado: " + BBX_StateParaTexto(g_state.phase) + "\n";
   txt += "Robô: " + (AtivarRobo ? "ATIVO" : "PAUSADO") + "\n";
   txt += "Hora: " + horaAtual + "\n";
   txt += "Horário operacional: " + (BBX_DentroHorarioEntrada() ? "SIM" : "NÃO") + "\n";
   txt += "────────────────────────\n";
   txt += "Cenário: " + BBX_StrategyCenarioTexto(g_strat.scenario) + "\n";
   txt += "Máxima D-1: " + DoubleToString(g_strat.maxD1Prev, g_digits) + "\n";
   txt += "Mínima D-1: " + DoubleToString(g_strat.minD1Prev, g_digits) + "\n";
   txt += "Amplitude: " + DoubleToString(g_strat.amplitude, g_digits) + "\n";
   txt += "Compra: " + DoubleToString(g_strat.compra, g_digits) + "\n";
   txt += "Venda: " + DoubleToString(g_strat.venda, g_digits) + "\n";
   txt += "Preço atual: " + DoubleToString(g_strat.precoAtual, g_digits) + "\n";
   txt += "COMPRADO_NO_DIA: " + (COMPRADO_NO_DIA ? "SIM" : "NÃO") + "\n";
   txt += "VENDIDO_NO_DIA: " + (VENDIDO_NO_DIA ? "SIM" : "NÃO") + "\n";
   txt += "────────────────────────\n";
   txt += "Posição: " + dirPos + "\n";
   txt += "Ticket pos: " + IntegerToString((int)g_state.positionTicket) + "\n";
   txt += "Volume: " + DoubleToString(g_state.volumeAtual, 2) + "\n";
   txt += "Preço médio: " + DoubleToString(g_state.precoEntrada, g_digits) + "\n";
   txt += "SL na posição: " + DoubleToString(slPainel, g_digits) +
          " (input " + DoubleToString(StopLossPontos, g_digits) + " pts)\n";
   txt += "SL confirmado: " + (g_state.slConfirmed ? "SIM" : "NÃO") + "\n";
   txt += "Take1: " + (g_state.t1Sent ? "ENV" : "—") + "/" + (g_state.t1Done ? "OK" : "—") + "\n";
   txt += "Take2: " + (g_state.t2Sent ? "ENV" : "—") + "/" + (g_state.t2Done ? "OK" : "—") + "\n";
   if(g_ultimoErro != "")
      txt += "Último erro: " + g_ultimoErro + "\n";
   Comment(txt);
  }

#endif
