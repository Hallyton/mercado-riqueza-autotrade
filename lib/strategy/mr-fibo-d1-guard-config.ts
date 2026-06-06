import { z } from "zod";
import {
  MR_FIBO_D1_GUARD_CODE,
  MR_FIBO_D1_GUARD_DISPLAY_NAME,
} from "@/lib/risk/autonomous-strategy-reasons";

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const mrFiboD1GuardConfigSchema = z
  .object({
    version: z.number().int().min(1).default(2),
    strategyCode: z.literal(MR_FIBO_D1_GUARD_CODE),
    identification: z.object({
      strategyName: z.string().min(1),
    }),
    fiboD1: z.object({
      percentualFibo: z.number().min(0.01).max(0.99),
    }),
    risk: z.object({
      loteTotal: z.number().positive(),
      stopPontos: z.number().positive(),
    }),
    partialsAndTrailing: z.object({
      alvo1Pontos: z.number().positive(),
      alvo2Pontos: z.number().positive(),
      loteAlvo1: z.number().min(0),
      loteAlvo2: z.number().min(0),
      loteFinal: z.number().min(0),
      trailStepPontos: z.number().positive(),
      trailOffsetPontos: z.number().positive(),
    }),
    operationalHours: z.object({
      horarioInicio: z.string().regex(hhmmRegex),
      horarioFimEntradas: z.string().regex(hhmmRegex),
      horarioZeragem: z.string().regex(hhmmRegex),
      zerarNoFimDoDia: z.boolean(),
      prepararNiveisAntesDaAbertura: z.boolean(),
      minutosAntesParaPreparar: z.number().int().min(0),
    }),
    executionAndSpread: z.object({
      slippagePoints: z.number().min(0),
      maxSpreadPontos: z.number().min(0),
    }),
    b3DollarNormalization: z.object({
      forcarTickDolarB3: z.boolean(),
      tickOperacionalDolar: z.number().positive(),
      digitosPrecoOperacional: z.number().int().min(0),
    }),
    safety: z.object({
      bloquearTesterSeLastZero: z.boolean(),
    }),
    chartVisual: z.object({
      mostrarLinhasNoGrafico: z.boolean(),
      removerObjetosAntigos: z.boolean(),
    }),
    adminPanel: z.object({
      mostrarPainelAdmin: z.boolean(),
      painelX: z.number().int(),
      painelY: z.number().int(),
      corFundoPainel: z.string().min(1),
    }),
  })
  .superRefine((cfg, ctx) => {
    const { loteTotal } = cfg.risk;
    const p = cfg.partialsAndTrailing;
    const sumLots = p.loteAlvo1 + p.loteAlvo2 + p.loteFinal;
    if (sumLots > loteTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Soma dos lotes parciais não pode exceder lote total.",
        path: ["partialsAndTrailing"],
      });
    }
    if (loteTotal === 1 && (p.loteAlvo1 + p.loteAlvo2 + p.loteFinal) !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Com lote total 1, parciais devem somar 1.",
        path: ["partialsAndTrailing"],
      });
    }
    if (p.alvo2Pontos <= p.alvo1Pontos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alvo 2 deve ser maior que Alvo 1.",
        path: ["partialsAndTrailing", "alvo2Pontos"],
      });
    }
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const start = toMinutes(cfg.operationalHours.horarioInicio);
    const endEntries = toMinutes(cfg.operationalHours.horarioFimEntradas);
    const flatten = toMinutes(cfg.operationalHours.horarioZeragem);
    if (start >= endEntries) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário início deve ser anterior ao fim de entradas.",
        path: ["operationalHours", "horarioInicio"],
      });
    }
    if (flatten < endEntries) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário zeragem deve ser >= fim de entradas.",
        path: ["operationalHours", "horarioZeragem"],
      });
    }
  });

export type MrFiboD1GuardConfig = z.infer<typeof mrFiboD1GuardConfigSchema>;

export function buildDefaultMrFiboD1GuardConfig(): MrFiboD1GuardConfig {
  return {
    version: 2,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    identification: {
      strategyName: MR_FIBO_D1_GUARD_DISPLAY_NAME,
    },
    fiboD1: {
      percentualFibo: 0.2,
    },
    risk: {
      loteTotal: 5,
      stopPontos: 7,
    },
    partialsAndTrailing: {
      alvo1Pontos: 5,
      alvo2Pontos: 10,
      loteAlvo1: 3,
      loteAlvo2: 1,
      loteFinal: 1,
      trailStepPontos: 3,
      trailOffsetPontos: 3,
    },
    operationalHours: {
      horarioInicio: "09:15",
      horarioFimEntradas: "17:30",
      horarioZeragem: "17:30",
      zerarNoFimDoDia: true,
      prepararNiveisAntesDaAbertura: true,
      minutosAntesParaPreparar: 1,
    },
    executionAndSpread: {
      slippagePoints: 30,
      maxSpreadPontos: 0,
    },
    b3DollarNormalization: {
      forcarTickDolarB3: true,
      tickOperacionalDolar: 0.5,
      digitosPrecoOperacional: 1,
    },
    safety: {
      bloquearTesterSeLastZero: true,
    },
    chartVisual: {
      mostrarLinhasNoGrafico: true,
      removerObjetosAntigos: true,
    },
    adminPanel: {
      mostrarPainelAdmin: true,
      painelX: 10,
      painelY: 30,
      corFundoPainel: "DarkBlue",
    },
  };
}

export type MrFiboD1GuardConfigValidationContext = {
  maxContracts?: number | null;
  dailyLossLimitCents?: number | null;
  pointValueBrl?: number | null;
};

export function validateMrFiboD1GuardConfigWithContext(
  config: unknown,
  ctx: MrFiboD1GuardConfigValidationContext = {}
): { success: true; data: MrFiboD1GuardConfig } | { success: false; error: z.ZodError } {
  const parsed = mrFiboD1GuardConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  const maxContracts = ctx.maxContracts ?? null;
  if (maxContracts != null && parsed.data.risk.loteTotal > maxContracts) {
    const issue = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: `Lote total (${parsed.data.risk.loteTotal}) excede maxContracts (${maxContracts}).`,
        path: ["risk", "loteTotal"],
      },
    ]);
    return { success: false, error: issue };
  }

  if (
    ctx.dailyLossLimitCents != null &&
    ctx.pointValueBrl != null &&
    ctx.pointValueBrl > 0
  ) {
    const potentialLoss =
      parsed.data.risk.loteTotal *
      parsed.data.risk.stopPontos *
      ctx.pointValueBrl;
    const limitBrl = ctx.dailyLossLimitCents / 100;
    if (potentialLoss > limitBrl) {
      const issue = new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Perda potencial estimada (R$ ${potentialLoss.toFixed(2)}) excede stop diário (R$ ${limitBrl.toFixed(2)}).`,
          path: ["risk", "stopPontos"],
        },
      ]);
      return { success: false, error: issue };
    }
  }

  return { success: true, data: parsed.data };
}

export type EaMrFiboD1GuardStrategyConfig = {
  fibo_d1: { percentual_fibo: number };
  risk: { lote_total: number; stop_pontos: number };
  partials_and_trailing: {
    alvo1_pontos: number;
    alvo2_pontos: number;
    lote_alvo1: number;
    lote_alvo2: number;
    lote_final: number;
    trail_step_pontos: number;
    trail_offset_pontos: number;
  };
  operational_hours: {
    horario_inicio: string;
    horario_fim_entradas: string;
    horario_zeragem: string;
    zerar_no_fim_do_dia: boolean;
    preparar_niveis_antes_da_abertura: boolean;
    minutos_antes_para_preparar: number;
  };
  execution_and_spread: {
    slippage_points: number;
    max_spread_pontos: number;
  };
  b3_dollar_normalization: {
    forcar_tick_dolar_b3: boolean;
    tick_operacional_dolar: number;
    digitos_preco_operacional: number;
  };
  safety: { bloquear_tester_se_last_zero: boolean };
  chart_visual: {
    mostrar_linhas_no_grafico: boolean;
    remover_objetos_antigos: boolean;
  };
  admin_panel: {
    mostrar_painel_admin: boolean;
    painel_x: number;
    painel_y: number;
    cor_fundo_painel: string;
  };
};

export function toEaMrFiboD1GuardStrategyConfig(
  config: MrFiboD1GuardConfig
): EaMrFiboD1GuardStrategyConfig {
  return {
    fibo_d1: { percentual_fibo: config.fiboD1.percentualFibo },
    risk: {
      lote_total: config.risk.loteTotal,
      stop_pontos: config.risk.stopPontos,
    },
    partials_and_trailing: {
      alvo1_pontos: config.partialsAndTrailing.alvo1Pontos,
      alvo2_pontos: config.partialsAndTrailing.alvo2Pontos,
      lote_alvo1: config.partialsAndTrailing.loteAlvo1,
      lote_alvo2: config.partialsAndTrailing.loteAlvo2,
      lote_final: config.partialsAndTrailing.loteFinal,
      trail_step_pontos: config.partialsAndTrailing.trailStepPontos,
      trail_offset_pontos: config.partialsAndTrailing.trailOffsetPontos,
    },
    operational_hours: {
      horario_inicio: config.operationalHours.horarioInicio,
      horario_fim_entradas: config.operationalHours.horarioFimEntradas,
      horario_zeragem: config.operationalHours.horarioZeragem,
      zerar_no_fim_do_dia: config.operationalHours.zerarNoFimDoDia,
      preparar_niveis_antes_da_abertura:
        config.operationalHours.prepararNiveisAntesDaAbertura,
      minutos_antes_para_preparar:
        config.operationalHours.minutosAntesParaPreparar,
    },
    execution_and_spread: {
      slippage_points: config.executionAndSpread.slippagePoints,
      max_spread_pontos: config.executionAndSpread.maxSpreadPontos,
    },
    b3_dollar_normalization: {
      forcar_tick_dolar_b3: config.b3DollarNormalization.forcarTickDolarB3,
      tick_operacional_dolar: config.b3DollarNormalization.tickOperacionalDolar,
      digitos_preco_operacional:
        config.b3DollarNormalization.digitosPrecoOperacional,
    },
    safety: {
      bloquear_tester_se_last_zero: config.safety.bloquearTesterSeLastZero,
    },
    chart_visual: {
      mostrar_linhas_no_grafico: config.chartVisual.mostrarLinhasNoGrafico,
      remover_objetos_antigos: config.chartVisual.removerObjetosAntigos,
    },
    admin_panel: {
      mostrar_painel_admin: config.adminPanel.mostrarPainelAdmin,
      painel_x: config.adminPanel.painelX,
      painel_y: config.adminPanel.painelY,
      cor_fundo_painel: config.adminPanel.corFundoPainel,
    },
  };
}
