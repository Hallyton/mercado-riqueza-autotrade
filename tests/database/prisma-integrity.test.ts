import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  expect(match, `model ${modelName} not found`).not.toBeNull();
  return match![0];
}

function enumBlock(enumName: string): string {
  const match = schema.match(new RegExp(`enum ${enumName} \\{[\\s\\S]*?\\n\\}`));
  expect(match, `enum ${enumName} not found`).not.toBeNull();
  return match![0];
}

describe("Prisma schema — integridade crítica e histórico", () => {
  it("Instruction exige License, idempotency_key único, status atual e trilha de status", () => {
    const instruction = modelBlock("Instruction");
    const statusLog = modelBlock("InstructionStatusLog");

    expect(instruction).toContain("licenseId      String");
    expect(instruction).toContain("idempotencyKey String               @unique");
    expect(instruction).toContain("InstructionSource?");
    expect(instruction).toContain("OrderLogStatus");
    expect(instruction).toContain("license                      License");
    expect(instruction).toContain("statusLogs                   InstructionStatusLog[]");
    expect(instruction).toContain("@@index([licenseId, currentStatus, createdAt])");

    expect(statusLog).toContain("instructionId String");
    expect(statusLog).toContain("status        OrderLogStatus");
    expect(statusLog).toContain("metadata      Json?");
    expect(statusLog).toContain("createdAt     DateTime");
    expect(statusLog).toContain("@@index([instructionId, createdAt])");
  });

  it("Execution não é modelada sem Instruction e License válidas", () => {
    const execution = modelBlock("Execution");

    expect(execution).toContain("instructionId String");
    expect(execution).toContain("licenseId     String");
    expect(execution).toContain("instruction                  Instruction");
    expect(execution).toContain("license                      License");
    expect(execution).toContain("@@index([licenseId, createdAt])");
    expect(execution).toContain("@@index([instructionId])");
  });

  it("MasterSignal permite reconstruir MasterSignal -> Dispatch -> Instruction -> Execution", () => {
    const masterSignal = modelBlock("MasterSignal");
    const dispatch = modelBlock("MasterSignalDispatch");
    const instruction = modelBlock("Instruction");

    expect(masterSignal).toContain("masterSignalId     String               @unique");
    expect(masterSignal).toContain("idempotencyKey     String               @unique");
    expect(masterSignal).toContain("rawPayloadRedacted Json?");
    expect(masterSignal).toContain("dispatches MasterSignalDispatch[]");

    expect(dispatch).toContain("masterSignalId String");
    expect(dispatch).toContain("licenseId      String");
    expect(dispatch).toContain("instructionId  String?                    @unique");
    expect(dispatch).toContain("masterSignal MasterSignal @relation(fields: [masterSignalId], references: [id]");
    expect(dispatch).toContain("license      License      @relation(fields: [licenseId], references: [id]");
    expect(dispatch).toContain("instruction  Instruction? @relation(fields: [instructionId], references: [id], onDelete: SetNull)");
    expect(dispatch).toContain("@@unique([masterSignalId, licenseId])");

    expect(instruction).toContain("executions                   Execution[]");
    expect(instruction).toContain("masterSignalDispatch         MasterSignalDispatch?");
  });

  it("Device e ActivationCode persistem apenas hashes de credenciais operacionais", () => {
    const device = modelBlock("Device");
    const activationCode = modelBlock("ActivationCode");

    expect(device).toContain("tokenHash");
    expect(device).toContain("@map(\"token_hash\")");
    expect(device).toContain("status          DeviceStatus");
    expect(device).not.toContain("deviceToken");
    expect(device).not.toContain(" token ");

    expect(activationCode).toContain("codeHash  String    @map(\"code_hash\")");
    expect(activationCode).not.toContain("code      String");
    expect(activationCode).not.toContain("plain");
  });

  it("AdminAction e AuditLog preservam trilha com metadata e índices de reconstrução", () => {
    const adminAction = modelBlock("AdminAction");
    const auditLog = modelBlock("AuditLog");

    expect(adminAction).toContain("actorId    String");
    expect(adminAction).toContain("metadata   Json?");
    expect(adminAction).toContain("createdAt  DateTime");
    expect(adminAction).toContain("@@index([actorId, createdAt])");
    expect(adminAction).toContain("@@index([targetType, targetId])");

    expect(auditLog).toContain("actorType  AuditActorType");
    expect(auditLog).toContain("entityType String");
    expect(auditLog).toContain("entityId   String?");
    expect(auditLog).toContain("metadata   Json?");
    expect(auditLog).toContain("requestId  String?");
    expect(auditLog).toContain("@@index([entityType, entityId, createdAt])");
  });

  it("enums críticos mantêm estados auditáveis sem campo FAILED fantasma em OrderLogStatus", () => {
    expect(enumBlock("OrderLogStatus")).toContain("RECEIVED");
    expect(enumBlock("OrderLogStatus")).toContain("SENT");
    expect(enumBlock("OrderLogStatus")).toContain("EXECUTED");
    expect(enumBlock("OrderLogStatus")).toContain("REJECTED");
    expect(enumBlock("OrderLogStatus")).toContain("IGNORED");
    expect(enumBlock("OrderLogStatus")).toContain("CANCELLED");

    expect(enumBlock("ExecutionStatus")).toContain("FILLED");
    expect(enumBlock("ExecutionStatus")).toContain("PARTIAL");
    expect(enumBlock("ExecutionStatus")).toContain("REJECTED");
    expect(enumBlock("ExecutionStatus")).toContain("EXPIRED");

    expect(enumBlock("MasterSignalStatus")).toContain("VALIDATED");
    expect(enumBlock("MasterSignalStatus")).toContain("DISPATCHED");
    expect(enumBlock("MasterSignalStatus")).toContain("REJECTED");
    expect(enumBlock("MasterSignalStatus")).toContain("FAILED");

    expect(enumBlock("MasterSignalDispatchStatus")).toContain("SKIPPED");
    expect(enumBlock("MasterSignalDispatchStatus")).toContain("INSTRUCTION_CREATED");
    expect(enumBlock("MasterSignalDispatchStatus")).toContain("FAILED");
  });
});
