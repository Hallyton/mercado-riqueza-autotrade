-- Anulação administrativa REAL_MANUAL por falso positivo de execução no broker
ALTER TYPE "OrderLogStatus" ADD VALUE IF NOT EXISTS 'VOIDED_FALSE_EXECUTION';
ALTER TYPE "ExecutionStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
