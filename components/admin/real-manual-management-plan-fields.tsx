"use client";

import {
  MANAGEMENT_PLAN_ERROR_MESSAGES,
  type RealManualManagementPlan,
  validateManagementPlan,
} from "@/lib/admin/real-manual-management-plan";
import { slTpDirectionHint } from "@/lib/admin/real-manual-dispatch-validation";

export type ManagementPlanFormState = RealManualManagementPlan;

export function buildManagementPlanFromForm(state: ManagementPlanFormState): RealManualManagementPlan {
  return state;
}

export function validateManagementPlanForm(input: {
  plan: ManagementPlanFormState;
  requestedContracts: number;
  side: "BUY" | "SELL";
  entryPrice?: number;
}): string | null {
  const result = validateManagementPlan({
    plan: input.plan,
    requestedContracts: input.requestedContracts,
    side: input.side,
    entryPrice: input.entryPrice ?? null,
  });
  return result?.message ?? null;
}

export function RealManualManagementPlanFields({
  plan,
  onChange,
  side,
  entryPrice,
  requestedContracts,
}: {
  plan: ManagementPlanFormState;
  onChange: (plan: ManagementPlanFormState) => void;
  side: "BUY" | "SELL";
  entryPrice?: number;
  requestedContracts: number;
}) {
  const [t1, t2] = plan.takes;
  const oneContractWarning =
    requestedContracts === 1 && t1.enabled && t2.enabled && t1.quantity >= 1 && t2.quantity >= 1
      ? MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE_SPLIT_NOT_AVAILABLE_FOR_ONE_CONTRACT
      : null;

  function update(partial: Partial<RealManualManagementPlan>) {
    onChange({ ...plan, ...partial });
  }

  function updateTake(
    index: 0 | 1,
    partial: Partial<(typeof plan.takes)[number]>
  ) {
    const takes = [...plan.takes] as RealManualManagementPlan["takes"];
    takes[index] = { ...takes[index], ...partial };
    onChange({ ...plan, takes });
  }

  return (
    <div className="space-y-6" data-testid="management-plan-fields">
      <div>
        <h4 className="text-sm font-semibold text-gold">Gestão da operação</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Plano enviado ao EA Executor para SL inicial, takes parciais, breakeven e trailing stop.
        </p>
      </div>

      <section className="space-y-3 rounded border border-white/10 p-4">
        <h5 className="text-sm font-medium">Proteção inicial</h5>
        <label className="block text-sm" data-testid="initial-stop-loss-field">
          <span className="text-muted-foreground">Stop Loss inicial</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={plan.initialStopLoss || ""}
            onChange={(e) =>
              update({
                initialStopLoss: Number(e.target.value) || 0,
              })
            }
            placeholder="Ex.: 4999.0"
            required
          />
        </label>
      </section>

      <section className="space-y-3 rounded border border-white/10 p-4">
        <h5 className="text-sm font-medium">Takes</h5>
        {oneContractWarning && (
          <p className="text-xs text-amber-300" data-testid="one-contract-take-warning">
            {oneContractWarning}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t1.enabled}
            onChange={(e) => updateTake(0, { enabled: e.target.checked })}
            data-testid="take1-enabled"
          />
          Habilitar Take 1
        </label>
        {t1.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm" data-testid="take1-price-field">
              <span className="text-muted-foreground">Take 1 — preço</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={t1.price ?? ""}
                onChange={(e) =>
                  updateTake(0, {
                    price: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label className="block text-sm" data-testid="take1-quantity-field">
              <span className="text-muted-foreground">Take 1 — quantidade</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={t1.quantity}
                onChange={(e) =>
                  updateTake(0, { quantity: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t2.enabled}
            onChange={(e) => updateTake(1, { enabled: e.target.checked })}
            data-testid="take2-enabled"
          />
          Habilitar Take 2
        </label>
        {t2.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm" data-testid="take2-price-field">
              <span className="text-muted-foreground">Take 2 — preço</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={t2.price ?? ""}
                onChange={(e) =>
                  updateTake(1, {
                    price: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label className="block text-sm" data-testid="take2-quantity-field">
              <span className="text-muted-foreground">Take 2 — quantidade</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={t2.quantity}
                onChange={(e) =>
                  updateTake(1, { quantity: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded border border-white/10 p-4">
        <h5 className="text-sm font-medium">Breakeven / BE</h5>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plan.breakEven.enabled}
            onChange={(e) =>
              update({
                breakEven: { ...plan.breakEven, enabled: e.target.checked },
              })
            }
            data-testid="break-even-enabled"
          />
          Habilitar Breakeven
        </label>
        {plan.breakEven.enabled && (
          <>
            <label className="block text-sm">
              <span className="text-muted-foreground">Gatilho</span>
              <select
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
                value={plan.breakEven.trigger}
                onChange={(e) =>
                  update({
                    breakEven: {
                      ...plan.breakEven,
                      trigger: e.target.value as RealManualManagementPlan["breakEven"]["trigger"],
                    },
                  })
                }
                data-testid="break-even-trigger"
              >
                <option value="TAKE1_FILLED">TAKE1_FILLED</option>
                <option value="PRICE_REACHED">PRICE_REACHED</option>
                <option value="MANUAL_DISABLED">MANUAL_DISABLED</option>
              </select>
            </label>
            {plan.breakEven.trigger === "PRICE_REACHED" && (
              <label className="block text-sm" data-testid="break-even-trigger-price">
                <span className="text-muted-foreground">Preço gatilho BE</span>
                <input
                  className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                  value={plan.breakEven.triggerPrice ?? ""}
                  onChange={(e) =>
                    update({
                      breakEven: {
                        ...plan.breakEven,
                        triggerPrice: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-muted-foreground">Offset BE</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={plan.breakEven.offset}
                onChange={(e) =>
                  update({
                    breakEven: {
                      ...plan.breakEven,
                      offset: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
          </>
        )}
      </section>

      <section className="space-y-3 rounded border border-white/10 p-4">
        <h5 className="text-sm font-medium">Trailing Stop / TS</h5>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plan.trailingStop.enabled}
            onChange={(e) =>
              update({
                trailingStop: { ...plan.trailingStop, enabled: e.target.checked },
              })
            }
            data-testid="trailing-stop-enabled"
          />
          Habilitar Trailing Stop
        </label>
        {plan.trailingStop.enabled && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm" data-testid="trailing-trigger-price">
              <span className="text-muted-foreground">Gatilho TS</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={plan.trailingStop.triggerPrice ?? ""}
                onChange={(e) =>
                  update({
                    trailingStop: {
                      ...plan.trailingStop,
                      triggerPrice: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm" data-testid="trailing-distance">
              <span className="text-muted-foreground">Distância</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={plan.trailingStop.distance ?? ""}
                onChange={(e) =>
                  update({
                    trailingStop: {
                      ...plan.trailingStop,
                      distance: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm" data-testid="trailing-step">
              <span className="text-muted-foreground">Passo</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={plan.trailingStop.step ?? ""}
                onChange={(e) =>
                  update({
                    trailingStop: {
                      ...plan.trailingStop,
                      step: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      {!entryPrice && orderTypeNeedsPriceAlert(side) && (
        <p className="text-xs text-amber-200">
          Sem preço de entrada confiável — valide direção BUY/SELL manualmente no MT5.
        </p>
      )}
      {entryPrice != null && (
        <p className="text-xs text-muted-foreground">
          {slTpDirectionHint(side, entryPrice)}
        </p>
      )}
    </div>
  );
}

function orderTypeNeedsPriceAlert(_side: "BUY" | "SELL") {
  return true;
}

export function ManagementPlanSummary({
  plan,
  side,
  orderType,
  orderPrice,
  requestedContracts,
}: {
  plan: RealManualManagementPlan;
  side: string;
  orderType: string;
  orderPrice?: string;
  requestedContracts: number;
}) {
  const [t1, t2] = plan.takes;
  return (
    <div
      className="rounded border border-gold/20 bg-black/30 p-3 text-xs space-y-1"
      data-testid="management-plan-summary"
    >
      <p className="font-semibold text-gold">Resumo do plano de gestão</p>
      <p>
        Entrada: {orderType} {side}
        {orderPrice ? ` @ ${orderPrice}` : ""} · {requestedContracts} contrato(s)
      </p>
      <p>SL inicial: {plan.initialStopLoss || "—"}</p>
      <p>
        T1: {t1.enabled ? `${t1.price ?? "?"} x ${t1.quantity}` : "desabilitado"}
      </p>
      <p>
        T2: {t2.enabled ? `${t2.price ?? "?"} x ${t2.quantity}` : "desabilitado"}
      </p>
      <p>
        BE:{" "}
        {plan.breakEven.enabled
          ? `${plan.breakEven.trigger}${plan.breakEven.triggerPrice ? ` @ ${plan.breakEven.triggerPrice}` : ""} offset ${plan.breakEven.offset}`
          : "desabilitado"}
      </p>
      <p>
        TS:{" "}
        {plan.trailingStop.enabled
          ? `gatilho ${plan.trailingStop.triggerPrice ?? "?"} dist ${plan.trailingStop.distance ?? "?"} step ${plan.trailingStop.step ?? "?"}`
          : "desabilitado"}
      </p>
    </div>
  );
}
