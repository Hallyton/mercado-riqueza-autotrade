# Fase 14 — Relatório final

**Nome:** Real Trading Operational Readiness & Live Market Controlled Dispatch  
**Subfase:** 14.2 — Live Market Go-Live Readiness  
**Branch:** `staging-vps-homologacao`  
**Status final:** `PHASE_14_REAL_TRADING_OPERATIONAL_READY_FOR_LIVE_MARKET`

---

## 1. Status final da Fase 14

A plataforma está operacionalmente pronta para o operador executar envio **REAL_MANUAL** em mercado ao vivo via disparo em lote controlado, com preview obrigatório, elegíveis/bloqueados visíveis, plano completo de gestão da ordem, checklist de 15 itens, três confirmações textuais e audit trail completo.

**Nenhuma ordem real foi executada durante a implementação ou smoke automatizado** — apenas preview de elegibilidade.

---

## 2. O que foi implementado (Fase 14.2)

| Área | Entrega |
|------|---------|
| Modo operacional | `operationalMode: LIVE_MARKET` em batch e instruction |
| Card readiness | Mercado ao vivo — Checklist final no topo de bulk-dispatch |
| Checklist execute | 15 itens obrigatórios antes do botão execute |
| Confirmação 3 | `ESTOU CIENTE QUE AS INSTRUCTIONS SERAO BUSCADAS PELOS EAS EM CONTAS REAIS` |
| APIs | `GET .../readiness`, `GET .../[batchId]/tracking` |
| Acompanhamento batch | Tracker com refresh manual + polling leve |
| EA payload | `operational_mode`, `bulk_batch_id` |
| Audit | `real_trading.bulk_dispatch.execute_live_market` |
| Docs | Runbook, este relatório, atualizações MASTER/EA-API/bulk |

---

## 3. Fluxo individual REAL_MANUAL

1. Preflight dry-run PASSED em `/admin/real-trading/preflights`.
2. Dispatch manual com managementPlan, SL, takes, BE/TS.
3. Instruction `REAL_MANUAL` + `operationalMode LIVE_MARKET`.
4. EA busca via `GET /api/v1/ea/instructions`.
5. Proteção e management events auditáveis.

---

## 4. Fluxo bulk dispatch

1. Preencher ordem + managementPlan.
2. Preview (5 min) — não cria instruction.
3. Tabelas elegíveis/bloqueados com reason codes e links.
4. Seleção manual + checklist + 3 confirmações.
5. Execute revalida; cria instruction individual por elegível.
6. Acompanhamento em `[batchId]` e instructions filtradas por batchId.

---

## 5. Elegíveis / bloqueados

Preview e execute aplicam os mesmos critérios: User/Subscription/Payment/License ativos, plano compatível, RobotInstance, MT5, REAL mode, device ACTIVE+REAL, heartbeat, EA online, approval, PRE_MARKET, margem, sem protection bloqueante, sem instruction aberta, sem posição conflitante, managementPlan válido.

Bloqueados entre preview e execute recebem `BLOCKED_AT_EXECUTE` / `SKIPPED` — não recebem instruction.

---

## 6. ManagementPlan (SL / T1 / T2 / BE / TS)

- `initialStopLoss` obrigatório.
- Take 1 / Take 2 com quantidades compatíveis.
- Com 1 contrato: apenas T1 quantity=1; T1+T2 bloqueado.
- BE e TS opcionais conforme regras de validação.
- Hash do plano impede alteração entre preview e execute.

---

## 7. Proteção

- `protectionRequired=true`, `requiresProtectionConfirmation=true`.
- PROTECTION_CONFIRMED exige SL inicial.
- PROTECTION_FAILED bloqueia novas REAL_MANUAL.
- ORDER_NOT_PLACED / SKIPPED_NO_POSITION e VOIDED_FALSE_EXECUTION não bloqueiam após novo preflight.

---

## 8. Encerramento sem ordem apregoada

`POST .../close-no-order` com atestação operacional e audit `real_trading.instruction.close_no_order`.

---

## 9. Anulação falso positivo

`POST .../void-false-execution` → `VOIDED_FALSE_EXECUTION`, protection `SKIPPED_NO_POSITION`.

---

## 10. Segurança

- ADMIN only; gates ENABLE_REAL_TRADING / ENABLE_AUTO_DISPATCH.
- Sem exposição de strategy, tokens, Bearer, activation code, DATABASE_URL, ASAAS keys.
- TEST/HOMOLOGATION bloqueados em REAL.
- Idempotência por batch+license+hash.

---

## 11. Audit

Execute live registra `real_trading.bulk_dispatch.execute_live_market` com batchId, contagens, symbol, side, orderType, managementPlanHash, operationalMode, adminId, timestamp (sem secrets).

---

## 12. Rotas admin

| Rota | Função |
|------|--------|
| `/admin/real-trading/bulk-dispatch` | Preview + execute live |
| `/admin/real-trading/bulk-dispatch/[batchId]` | Acompanhamento batch |
| `/admin/real-trading/instructions` | Lista + filtro batchId |
| `/admin/real-trading/instructions/[instructionId]` | Detalhe + ações |
| `/admin/real-trading/protection` | Proteção + batch/gestão |
| `/admin/real-trading/preflights` | Dry-run + dispatch individual |
| `/admin/real-trading/approvals` | Aprovações REAL |

---

## 13. APIs

| Método | Rota |
|--------|------|
| POST | `/api/admin/real-trading/bulk-dispatch/preview` |
| POST | `/api/admin/real-trading/bulk-dispatch/execute` |
| GET | `/api/admin/real-trading/bulk-dispatch/readiness` |
| GET | `/api/admin/real-trading/bulk-dispatch/[batchId]/tracking` |
| POST | `/api/admin/real-trading/dispatch-manual` |
| GET | `/api/v1/ea/instructions` |
| POST | `/api/v1/ea/management-events` |

---

## 14. Testes

`npm test -- --run` — suite inclui checklist live, confirmação 3, operationalMode, execute_live_market audit, bloqueios sem checklist/confirmação, preview sem instruction, idempotência, secrets.

---

## 15. Build

`npm run build` — rotas bulk-dispatch, instructions e APIs compiladas.

---

## 16. Deploy

Staging: `vercel deploy --prod --force` → alias `https://autotrade-staging.mercadodariqueza.com.br`.

Migration: `20260602200000_live_market_operational_mode` (InstructionOperationalMode LIVE_MARKET).

---

## 17. Pendências externas

Dependem de B3/broker/MT5/VPS no momento da operação:

- Mercado aberto e símbolo negociável.
- EA em cada VPS com heartbeat e envio real habilitado.
- Margem e conectividade broker.

Se indisponível: tratar como `PHASE_14_READY_WITH_EXTERNAL_LIVE_MARKET_DEPENDENCY`.

---

## 18. Próxima ação operacional

Operador autenticado ADMIN pode:

1. Abrir `/admin/real-trading/bulk-dispatch`.
2. Executar preview e revisar elegíveis/bloqueados.
3. Após gates OK, checklist e confirmações — **executar envio real ao vivo manualmente**.

Ver [`docs/LIVE-MARKET-GO-LIVE-RUNBOOK.md`](LIVE-MARKET-GO-LIVE-RUNBOOK.md).

---

## Smoke preview (implementação)

Executado via `ENABLE_REAL_TRADING=true npx tsx scripts/ops/live-market-preview-smoke.ts` — **preview only, sem execute**.

| Campo | Resultado |
|-------|-----------|
| batchPreviewId | `cmpxen4ra0001sx4of0i6zvi7` |
| operationalMode | `LIVE_MARKET` |
| totalCandidates | 1 |
| eligibleCount | 0 |
| blockedCount | 1 |
| principal bloqueio | `EXPECTED_TRADE_MODE_NOT_REAL` (licenseId `cmpfvdma70005sx3gqmo4b7va`) |
| execute acionado | **Não** |

**Prontidão:** painel operacional pronto; após regularizar trade mode REAL (e demais gates) nos clientes elegíveis, operador pode executar envio ao vivo manualmente.
