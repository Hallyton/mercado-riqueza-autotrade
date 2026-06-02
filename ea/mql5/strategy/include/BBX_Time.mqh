//+------------------------------------------------------------------+
//| BBX_Time.mqh — horário operacional e virada de dia               |
//+------------------------------------------------------------------+
#ifndef BBX_TIME_MQH
#define BBX_TIME_MQH

bool BBX_StringParaMinutos(const string horario, int &minutosDia)
  {
   string parts[];
   if(StringSplit(horario, ':', parts) != 2)
      return false;
   int h = (int)StringToInteger(parts[0]);
   int m = (int)StringToInteger(parts[1]);
   if(h < 0 || h > 23 || m < 0 || m > 59)
      return false;
   minutosDia = h * 60 + m;
   return true;
  }

int BBX_MinutosAtuaisDoDia()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return dt.hour * 60 + dt.min;
  }

bool BBX_DentroHorarioEntrada()
  {
   if(!UsarHorarioOperacional)
      return true;
   int now = BBX_MinutosAtuaisDoDia();
   // Entradas permitidas de HoraInicio até 17:29:59 (bloqueio a partir de HoraFim = 17:30:00)
   return (now >= g_horaInicioMin && now < g_horaFimMin);
  }

bool BBX_HorarioEncerramentoAtingido()
  {
   return false;
  }

bool BBX_HorarioCancelarOrdensAtingido()
  {
   return false;
  }

bool BBX_DetectarNovoDia()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   datetime key = StringToTime(IntegerToString(dt.year) + "." +
                               IntegerToString(dt.mon) + "." +
                               IntegerToString(dt.day));
   if(key != g_state.dayKey)
     {
      g_state.dayKey = key;
      return true;
     }
   return false;
  }

#endif
