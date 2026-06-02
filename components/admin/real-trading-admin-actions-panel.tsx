"use client";

import { CloseNoOrderActionPanel } from "@/components/admin/close-no-order-action-panel";
import { VoidFalseExecutionActionPanel } from "@/components/admin/void-false-execution-action-panel";
import {
  CLOSE_NO_ORDER_REASON_CODE,
  type CloseNoOrderEligibility,
} from "@/lib/admin/real-manual-close-no-order";
import {
  VOID_FALSE_EXECUTION_REASON_CODE,
  type VoidFalseExecutionEligibility,
} from "@/lib/admin/real-manual-void-false-execution";

export function RealTradingAdminActionsPanel({
  instructionId,
  source,
  status,
  executionStatus,
  protectionStatus,
  canCloseNoOrder,
  closeEligibility,
  canVoidFalseExecution,
  voidEligibility,
  resolutionReasonCode,
}: {
  instructionId: string;
  source: string | null;
  status: string;
  executionStatus: string | null;
  protectionStatus: string | null;
  canCloseNoOrder: boolean;
  closeEligibility: CloseNoOrderEligibility;
  canVoidFalseExecution: boolean;
  voidEligibility: VoidFalseExecutionEligibility;
  resolutionReasonCode?: string | null;
}) {
  const showClose = closeEligibility.showAdminActionsCard && canCloseNoOrder;
  const showVoid = voidEligibility.canVoidFalseExecution;
  const showVoidBlocked =
    voidEligibility.showAdminActionsCard &&
    !voidEligibility.canVoidFalseExecution &&
    voidEligibility.blockReason;

  if (resolutionReasonCode) {
    const voided = resolutionReasonCode === VOID_FALSE_EXECUTION_REASON_CODE;
    const closed = resolutionReasonCode === CLOSE_NO_ORDER_REASON_CODE;
    return (
      <div
        className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 text-sm text-emerald-200"
        data-testid={
          voided ? "void-false-execution-success" : "close-no-order-success"
        }
      >
        {voided ? (
          <>
            Instruction anulada por falso positivo de execução. Nenhuma ordem
            pendente, nenhuma posição aberta e nenhuma exposição de risco foram
            atestadas pelo operador.
          </>
        ) : closed ? (
          <>Instruction encerrada sem ordem apregoada · motivo {resolutionReasonCode}</>
        ) : (
          <>Resolução administrativa registrada · motivo {resolutionReasonCode}</>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showVoid && (
        <VoidFalseExecutionActionPanel
          instructionId={instructionId}
          canVoidFalseExecution={canVoidFalseExecution}
          eligibility={voidEligibility}
        />
      )}
      {showVoidBlocked && !showVoid && (
        <VoidFalseExecutionActionPanel
          instructionId={instructionId}
          canVoidFalseExecution={false}
          eligibility={voidEligibility}
        />
      )}
      {showClose && (
        <CloseNoOrderActionPanel
          instructionId={instructionId}
          source={source}
          status={status}
          executionStatus={executionStatus}
          protectionStatus={protectionStatus}
          canCloseNoOrder={canCloseNoOrder}
          eligibility={closeEligibility}
        />
      )}
      {!showClose && !showVoid && !showVoidBlocked && closeEligibility.blockReason && (
        <p className="text-sm text-muted-foreground">{closeEligibility.blockReason}</p>
      )}
    </div>
  );
}
