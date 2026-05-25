import {
  ExecutionStatus,
  MasterSignalDispatchStatus,
  MasterSignalStatus,
  OrderLogStatus,
  type MasterSignal,
} from "@prisma/client";

export type ConsolidatedTrackingStatus =
  | "NOT_DISPATCHED"
  | "REJECTED_NO_ELIGIBLE_LICENSES"
  | "DISPATCHED_PENDING"
  | "PARTIALLY_EXECUTED"
  | "EXECUTED"
  | "FAILED"
  | "EXPIRED";

export type TrackingSummaryCounts = {
  candidatesCount: number | null;
  eligibleCount: number;
  skippedCount: number;
  dispatchCount: number;
  instructionCount: number;
  executedCount: number;
  failedCount: number;
  pendingCount: number;
  expiredCount: number;
  rejectedCount: number;
};

type InstructionLike = {
  currentStatus: OrderLogStatus;
  expiresAt: Date;
  executions: Array<{ status: ExecutionStatus }>;
};

export function isInstructionExecuted(inst: InstructionLike): boolean {
  if (inst.currentStatus === OrderLogStatus.EXECUTED) return true;
  return inst.executions.some((e) => e.status === ExecutionStatus.FILLED);
}

export function isInstructionFailed(inst: InstructionLike): boolean {
  if (
    inst.currentStatus === OrderLogStatus.REJECTED ||
    inst.currentStatus === OrderLogStatus.CANCELLED
  ) {
    return true;
  }
  return inst.executions.some((e) => e.status === ExecutionStatus.REJECTED);
}

export function isInstructionExpired(inst: InstructionLike, now = new Date()): boolean {
  if (inst.currentStatus === OrderLogStatus.IGNORED) return true;
  if (inst.executions.some((e) => e.status === ExecutionStatus.EXPIRED)) return true;
  if (isInstructionExecuted(inst) || isInstructionFailed(inst)) return false;
  return inst.expiresAt.getTime() <= now.getTime();
}

export function isInstructionPending(inst: InstructionLike, now = new Date()): boolean {
  if (isInstructionExecuted(inst) || isInstructionFailed(inst) || isInstructionExpired(inst, now)) {
    return false;
  }
  return true;
}

export function buildTrackingSummaryFromDispatches(
  dispatches: Array<{
    status: MasterSignalDispatchStatus;
    instruction: InstructionLike | null;
  }>,
  options?: { candidatesCount?: number | null; eligiblePreviewCount?: number }
): TrackingSummaryCounts {
  const skippedCount = dispatches.filter(
    (d) => d.status === MasterSignalDispatchStatus.SKIPPED
  ).length;
  const withInstruction = dispatches.filter((d) => d.instruction != null);
  const now = new Date();

  let executedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let expiredCount = 0;
  let rejectedCount = 0;

  for (const d of withInstruction) {
    const inst = d.instruction!;
    if (isInstructionExecuted(inst)) executedCount++;
    else if (isInstructionFailed(inst)) {
      failedCount++;
      if (inst.currentStatus === OrderLogStatus.REJECTED) rejectedCount++;
    } else if (isInstructionExpired(inst, now)) expiredCount++;
    else if (isInstructionPending(inst, now)) pendingCount++;
  }

  const dispatchFailed = dispatches.filter(
    (d) => d.status === MasterSignalDispatchStatus.FAILED
  ).length;
  failedCount += dispatchFailed;

  const instructionCount = dispatches.filter((d) => d.instruction != null).length;
  const eligibleFromDispatches = dispatches.filter(
    (d) => d.status === MasterSignalDispatchStatus.INSTRUCTION_CREATED
  ).length;

  return {
    candidatesCount: options?.candidatesCount ?? null,
    eligibleCount: options?.eligiblePreviewCount ?? eligibleFromDispatches,
    skippedCount,
    dispatchCount: dispatches.length,
    instructionCount,
    executedCount,
    failedCount,
    pendingCount,
    expiredCount,
    rejectedCount,
  };
}

export function deriveConsolidatedTrackingStatus(input: {
  masterStatus: MasterSignalStatus;
  summary: Pick<
    TrackingSummaryCounts,
    | "dispatchCount"
    | "instructionCount"
    | "executedCount"
    | "failedCount"
    | "pendingCount"
    | "expiredCount"
    | "skippedCount"
  >;
  expiresAt: Date | null;
  now?: Date;
}): ConsolidatedTrackingStatus {
  const now = input.now ?? new Date();
  const { masterStatus, summary, expiresAt } = input;

  if (summary.dispatchCount === 0) {
    if (expiresAt && expiresAt.getTime() <= now.getTime()) return "EXPIRED";
    return "NOT_DISPATCHED";
  }

  if (masterStatus === MasterSignalStatus.REJECTED && summary.instructionCount === 0) {
    return "REJECTED_NO_ELIGIBLE_LICENSES";
  }

  if (masterStatus === MasterSignalStatus.FAILED && summary.instructionCount === 0) {
    return "FAILED";
  }

  if (summary.instructionCount === 0) {
    if (
      summary.skippedCount > 0 &&
      summary.skippedCount === summary.dispatchCount
    ) {
      return "REJECTED_NO_ELIGIBLE_LICENSES";
    }
    if (summary.dispatchCount > 0) return "DISPATCHED_PENDING";
    return "NOT_DISPATCHED";
  }

  if (
    summary.executedCount === summary.instructionCount &&
    summary.instructionCount > 0
  ) {
    return "EXECUTED";
  }

  if (
    summary.expiredCount === summary.instructionCount &&
    summary.instructionCount > 0
  ) {
    return "EXPIRED";
  }

  if (
    summary.failedCount > 0 &&
    summary.executedCount === 0 &&
    summary.pendingCount === 0
  ) {
    return "FAILED";
  }

  if (summary.executedCount > 0 && summary.executedCount < summary.instructionCount) {
    return "PARTIALLY_EXECUTED";
  }

  return "DISPATCHED_PENDING";
}

export function resolveRowExecutionStatus(
  instruction: InstructionLike | null,
  now = new Date()
): string | null {
  if (!instruction) return null;
  if (isInstructionExecuted(instruction)) return "EXECUTED";
  if (isInstructionFailed(instruction)) return "FAILED";
  if (isInstructionExpired(instruction, now)) return "EXPIRED";
  const latest = instruction.executions[0];
  if (latest) return latest.status;
  return "PENDING";
}

export function resolveRowHint(
  dispatchStatus: MasterSignalDispatchStatus,
  instruction: InstructionLike | null,
  reason: string | null
): string | null {
  if (dispatchStatus === MasterSignalDispatchStatus.SKIPPED) {
    return reason ?? "Licença ignorada no dispatch";
  }
  if (!instruction) {
    if (dispatchStatus === MasterSignalDispatchStatus.FAILED) {
      return reason ?? "Falha ao criar instrução";
    }
    return null;
  }
  if (isInstructionExecuted(instruction)) return "Execução reportada pelo EA";
  if (isInstructionPending(instruction)) return "Aguardando EA processar";
  if (isInstructionExpired(instruction)) return "Instrução expirada";
  if (isInstructionFailed(instruction)) return reason ?? "Instrução rejeitada ou falhou";
  return null;
}

export type MasterSignalRowInput = Pick<
  MasterSignal,
  "status" | "expiresAt" | "dispatchedAt"
>;
