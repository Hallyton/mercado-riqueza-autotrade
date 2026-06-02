# REAL_MANUAL — Disparo em lote controlado

Status: **REAL_MANUAL_BULK_ELIGIBILITY_AND_DISPATCH_IMPLEMENTED**

## Visão geral

O disparo em lote REAL_MANUAL exige **preview obrigatório** antes de qualquer criação de instruction. O operador vê clientes **elegíveis** e **bloqueados**, seleciona manualmente quem receberá instruction e confirma com frases textuais fortes.

- Rota admin: `/admin/real-trading/bulk-dispatch`
- Detalhe do batch: `/admin/real-trading/bulk-dispatch/[batchId]`
- Preview: `POST /api/admin/real-trading/bulk-dispatch/preview` — **não cria instruction**
- Execute: `POST /api/admin/real-trading/bulk-dispatch/execute` — cria **uma instruction REAL_MANUAL por cliente** aprovado

O backend **não envia ordem ao broker**. O EA busca instructions via API. Dispatch automático permanece **desativado**.

## Fluxo operacional

1. Operador preenche parâmetros da ordem (símbolo, lado, tipo, preço se LIMIT/STOP, contratos, managementPlan).
2. Clica **Validar clientes elegíveis** → preview com expiração de **5 minutos**.
3. Revisa tabelas de elegíveis e bloqueados (reason codes + ações de regularização).
4. Desmarca clientes se necessário (todos elegíveis vêm selecionados por padrão).
5. Confirma:
   - `AUTORIZO DISPARO REAL EM LOTE`
   - `AUTORIZO DISPARO REAL EM LOTE PARA X CLIENTES` (X = selecionados)
6. Execute revalida cada licença, cria preflight individual (origem `BULK_DISPATCH`) e instruction com `bulkBatchId`.

Nova tentativa futura exige **novo preview/preflight**.

## Elegibilidade (preview e revalidação no execute)

Critérios incluem: User ACTIVE, Subscription ACTIVE, Payment confirmado, License ACTIVE, plano compatível, RobotInstance elegível, MT5 vinculado, `expectedTradeMode` REAL, símbolo/magic esperados, Device ACTIVE + REAL, heartbeat recente, EA online, RealTradingApproval APPROVED compatível, PRE_MARKET REAL do dia, margem suficiente, sem PROTECTION_FAILED bloqueante, sem REAL_MANUAL aberta, sem posição/ordem pendente conflitante, managementPlan válido.

## Reason codes (bloqueados)

`USER_NOT_ACTIVE`, `SUBSCRIPTION_NOT_ACTIVE`, `PAYMENT_NOT_CONFIRMED`, `LICENSE_NOT_ACTIVE`, `PLAN_NOT_COMPATIBLE`, `ROBOT_INSTANCE_MISSING`, `MT5_ACCOUNT_NOT_LINKED`, `EXPECTED_TRADE_MODE_NOT_REAL`, `EXPECTED_SYMBOL_MISMATCH`, `EXPECTED_MAGIC_MISSING`, `DEVICE_NOT_ACTIVE`, `DEVICE_NOT_REAL`, `HEARTBEAT_STALE`, `EA_OFFLINE`, `REAL_APPROVAL_MISSING`, `REAL_APPROVAL_MISMATCH`, `PRE_MARKET_MISSING`, `MARGIN_INSUFFICIENT`, `PROTECTION_FAILED_BLOCKING`, `OPEN_REAL_INSTRUCTION_EXISTS`, `OPEN_POSITION_OR_PENDING_ORDER_EXISTS`, `REQUESTED_CONTRACTS_EXCEEDS_APPROVAL`, `SYMBOL_MISMATCH`, `MAGIC_MISMATCH`, `MANAGEMENT_PLAN_INVALID`.

## Regularização

Cada bloqueado exibe motivo legível, ação recomendada e links para usuário, licença, approvals, snapshots, protection e instruction aberta quando aplicável. Após regularizar, usar **Revalidar elegibilidade**.

## Idempotência

Chave por batch: `bulk:{batchId}:{licenseId}:{symbol}:{side}:{orderType}:{price|MARKET}:{managementPlanHash}`. Duplo clique retorna instruction existente; bloqueados nunca recebem instruction.

## Modelos

- `RealManualBulkDispatchBatch` — preview/execute metadata, expira em 5 min
- `RealManualBulkDispatchItem` — por licença (ELIGIBLE, BLOCKED, DISPATCHED, BLOCKED_AT_EXECUTE, etc.)
- `Instruction.bulkBatchId` — rastreio e filtro na listagem admin

## Segurança

- ADMIN only
- Bloqueia se `ENABLE_REAL_TRADING=false` ou `ENABLE_AUTO_DISPATCH=true`
- Preview expirado bloqueia execute
- Confirmações textuais obrigatórias
- Testes automatizados não criam instructions reais (mocks)
