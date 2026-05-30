# First Real Order Gate T-0 Revalidation — Mercado da Riqueza AutoTrade

**Fase:** 12.5.2 — T-0 Real Order Gate Revalidation  
**Status:** `T0_REVALIDATION_COMPLETE`  
**Decisão:** `FIRST_REAL_ORDER_NOT_EXECUTED`  
**Gate T-0:** `BLOCKED_FOR_FIRST_REAL_ORDER`  
**Sessão:** 001 — [`FIRST-REAL-ORDER-GATE-SESSION-001.md`](FIRST-REAL-ORDER-GATE-SESSION-001.md)  
**Branch:** `staging-vps-homologacao`  
**Data da revalidação:** 2026-05-30  
**Operador:** HALLYTON  
**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`

**Escopo desta fase:** revalidação **T-0 documental e operacional** imediatamente antes da 12.6 — **sem enviar ordem real**, sem MasterSignal real, dispatch automático off, caixa preta preservada.

---

## Aviso de segurança — credencial exposta

**Registro obrigatório:** em conversa operacional anterior, **`DATABASE_URL` do Neon staging foi exposta**. Antes de **qualquer** operação real (Fase 12.6):

1. **Rotacionar** a credencial no painel **Neon** (nova connection string).
2. **Atualizar** `DATABASE_URL` (e variáveis derivadas) no **Vercel** — projeto staging — **sem** commitar `.env`.
3. **Revogar** strings antigas após deploy estável com a nova URL.
4. **Confirmar** que scripts/terminais compartilhados não retêm a URL antiga.

Até concluir rotação + atualização Vercel: **SECURITY_BLOCKED** — **bloqueia 12.6**.

---

## 1. Pendências críticas da Session 001 (revalidação T-0)

| Item | Resultado T-0 | Nota |
|------|---------------|------|
| RealTradingApprovalId | PENDENTE — BLOQUEIA 12.6 | Registrar ID em `/admin/real-trading/approvals` (não colar neste doc) |
| Horário da sessão | PENDENTE — BLOQUEIA 12.6 | Definir janela operacional 12.6 |
| Suplente operacional | PENDENTE — BLOQUEIA 12.6 | Nome + contato do suplente |
| InstructionId | PENDENTE — BLOQUEIA 12.6 | Criar após gate aprovado; proibido nesta fase |
| ExecutionId | PENDENTE — BLOQUEIA 12.6 | Pós-execução 12.6 |
| ProtectionReportId | PENDENTE — BLOQUEIA 12.6 | Pós-proteção 12.6 |
| Heartbeat REAL | PENDENTE — BLOQUEIA 12.6 | Confirmar `tradeMode=REAL` no último heartbeat (admin/EA); se DEMO → BLOCK |
| PRE_MARKET REAL do dia | PENDENTE — BLOQUEIA 12.6 | Snapshot **do dia** da sessão 12.6 em `/admin/real-trading/snapshots` |
| Preflight PASSED | PENDENTE — BLOQUEIA 12.6 | Rodar preflight T-0 com fixture REAL; não executado nesta fase |
| HALLYTON presente | PENDENTE — BLOQUEIA 12.6 | Presença contínua obrigatória na 12.6 |
| MT5/VPS monitorado | PENDENTE — BLOQUEIA 12.6 | MT5 aberto e monitorado na janela 12.6 |
| Painéis admin abertos | PENDENTE — BLOQUEIA 12.6 | snapshots, preflights, protection, instructions |
| Kill switch confirmado | OK | Procedimento documentado — [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md) |

---

## 2. Credenciais e segurança

| Critério | Resultado T-0 |
|----------|-------------|
| DATABASE_URL rotacionada após exposição | PENDENTE — BLOQUEIA 12.6 |
| Vercel atualizado com nova DATABASE_URL | PENDENTE — BLOQUEIA 12.6 |
| Neon atualizado (credencial antiga revogada) | PENDENTE — BLOQUEIA 12.6 |
| Nenhum secret em docs | OK |
| Nenhum token em logs públicos | OK (política; revalidar MT5/journal T-0) |
| Nenhum Bearer em terminal compartilhado | OK (política operacional) |
| Arquivo `.dat` preservado apenas localmente | OK |
| Nenhum `.env` commitado | OK |

**Resultado:** `SECURITY_BLOCKED`

**Motivo:** rotação pós-exposição de `DATABASE_URL` **não confirmada** nesta revalidação.

---

## 3. Licença e device

*Sem imprimir token ou Bearer.*

| Critério | Resultado T-0 |
|----------|-------------|
| License ACTIVE | OK (referência Session 001) |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Device ativo | OK* (*confirmar T-0 no admin*) |
| Device não revogado | PENDENTE — BLOQUEIA 12.6 |
| Bearer válido | PENDENTE — BLOQUEIA 12.6 |
| Heartbeat recente | PENDENTE — BLOQUEIA 12.6 |
| tradeMode=REAL | PENDENTE — BLOQUEIA 12.6 |
| accountLogin confere | PENDENTE — BLOQUEIA 12.6 |
| accountServer confere | PENDENTE — BLOQUEIA 12.6 |
| EA online | PENDENTE — BLOQUEIA 12.6 |

**Resultado:** `LICENSE_DEVICE_BLOCKED`

**Motivo:** heartbeat REAL, Bearer e par conta/servidor **não revalidados ao vivo** nesta fase 12.5.2 (dry-run documental). Se último heartbeat conhecido for DEMO → permanece BLOCKED.

---

## 4. Real Trading Guard

| Critério | Resultado T-0 |
|----------|-------------|
| ENABLE_REAL_TRADING=true/1 | PENDENTE — BLOQUEIA 12.6 |
| REAL_TRADING_ALLOWED_LICENSE_IDS contém a licença | PENDENTE — BLOQUEIA 12.6 |
| RealTradingApprovalId preenchido | PENDENTE — BLOQUEIA 12.6 |
| Approval APPROVED | PENDENTE — BLOQUEIA 12.6 |
| allowReal=true | PENDENTE — BLOQUEIA 12.6 |
| accountLogin aprovado | PENDENTE — BLOQUEIA 12.6 |
| accountServer aprovado | PENDENTE — BLOQUEIA 12.6 |
| symbol aprovado (`WDOM26`) | OK (planejado) |
| magicNumber aprovado (`910001`) | OK (planejado) |
| maxContracts=1 | OK (planejado) |
| minFreeMargin definido | PENDENTE — BLOQUEIA 12.6 |
| marginBufferPercent definido | PENDENTE — BLOQUEIA 12.6 |
| Sem allowlist ampla | OK (política) |

**Resultado:** `REAL_GUARD_BLOCKED`

**Motivo:** `RealTradingApprovalId` e confirmação env/allowlist **não verificados** nesta revalidação (sem acesso admin T-0 nesta fase documental).

---

## 5. PRE_MARKET e margem

| Critério | Resultado T-0 |
|----------|-------------|
| PRE_MARKET REAL **do dia** | PENDENTE — BLOQUEIA 12.6 |
| accountLogin | PENDENTE — BLOQUEIA 12.6 |
| accountServer | PENDENTE — BLOQUEIA 12.6 |
| balance / equity / margin / freeMargin | PENDENTE — BLOQUEIA 12.6 |
| marginLevel | PENDENTE — BLOQUEIA 12.6 |
| activeMagicNumbers (`910001`) | PENDENTE — BLOQUEIA 12.6 |
| requiredMargin | PENDENTE — BLOQUEIA 12.6 |
| marginBuffer | PENDENTE — BLOQUEIA 12.6 |
| freeMargin >= requiredMargin + buffer | PENDENTE — BLOQUEIA 12.6 |
| Sem posições conflitantes | PENDENTE — BLOQUEIA 12.6 |
| Sem ordens pendentes conflitantes | PENDENTE — BLOQUEIA 12.6 |

**Resultado:** `MARGIN_BLOCKED`

**Nota:** snapshot PRE_MARKET de homologação DEMO (Fase 12.4) **não substitui** PRE_MARKET REAL do dia da sessão 12.6.

---

## 6. Preflight (dry-run — sem ordem)

*Preflight **não** executado contra banco/EA ao vivo nesta fase (sem rotação de credencial confirmada + sessão T-0 operacional pendente).*

| Campo | Valor T-0 |
|-------|-----------|
| PreflightId | PENDENTE |
| status | PENDENTE |
| reason | PENDENTE |
| subscriptionOk | PENDENTE |
| paymentOk | PENDENTE |
| termsOk | PENDENTE |
| licenseOk | PENDENTE |
| deviceOk | PENDENTE |
| realApprovalOk | PENDENTE |
| allowlistOk | PENDENTE |
| snapshotOk | PENDENTE |
| accountOk | PENDENTE |
| symbolOk | PENDENTE |
| magicNumberOk | PENDENTE |
| marginOk | PENDENTE |
| maxContractsOk | PENDENTE |
| eaOnline | PENDENTE |
| protectionPreviousOk | PENDENTE |
| autoDispatchOk | OK (esperado `false` — `ENABLE_AUTO_DISPATCH` off) |

**Resultado esperado na 12.6:** `PASSED` · reason `REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE`

**Resultado T-0 desta fase:** `PREFLIGHT_BLOCKED`

---

## 7. EA Executor

| Critério | Resultado T-0 |
|----------|-------------|
| EA compilado MetaEditor | OK (declarado Session 001) |
| 0 erros | OK (declarado) |
| EX5 instalado VPS | OK (declarado) |
| WebRequest autorizado | OK (declarado) |
| AutoTrading controlado | OK (declarado) |
| EA recebe instruction | PENDENTE — BLOQUEIA 12.6 (REAL T-0) |
| EA valida conta/servidor/symbol/magic | OK (contrato 12.3; demo validado) |
| EA usa magicNumber na ordem | PENDENTE — BLOQUEIA 12.6 |
| EA envia execution report | PENDENTE — BLOQUEIA 12.6 (REAL) |
| EA envia protection report | PENDENTE — BLOQUEIA 12.6 (REAL) |
| EA não loga secrets | OK (política + 12.4) |
| EA não expõe estratégia | OK |

**Resultado:** `EXECUTOR_BLOCKED`

**Motivo:** trilha REAL T-0 (instruction → execution → protection) **não exercitada** nesta fase.

---

## 8. Supervisão e rollback

| Critério | Resultado T-0 |
|----------|-------------|
| HALLYTON presente | PENDENTE — BLOQUEIA 12.6 |
| Suplente ou dispensa formal | PENDENTE — BLOQUEIA 12.6 |
| VPS acessível | OK (declarado) |
| MT5 aberto | PENDENTE — BLOQUEIA 12.6 |
| Painel admin aberto | PENDENTE — BLOQUEIA 12.6 |
| Snapshots / preflights / protection / instructions | PENDENTE — BLOQUEIA 12.6 |
| Corretora/plataforma acessível | OK (declarado) |
| AutoTrading pode ser desligado | OK (runbook) |
| License pausável | OK (admin) |
| RealTradingApproval suspensível | OK (admin) |
| EA removível do gráfico | OK (runbook) |
| Pendentes canceláveis | OK (MT5 manual) |
| Procedimento posição aberta | OK (documentado) |
| Registro de incidente | OK (audit) |

**Resultado:** `SUPERVISION_ROLLBACK_BLOCKED`

---

## 9. Decisão T-0

| Bloco | Resultado | Aprovado? |
|-------|-----------|-----------|
| SECURITY | `SECURITY_BLOCKED` | **Não** |
| LICENSE_DEVICE | `LICENSE_DEVICE_BLOCKED` | **Não** |
| REAL_GUARD | `REAL_GUARD_BLOCKED` | **Não** |
| MARGIN | `MARGIN_BLOCKED` | **Não** |
| PREFLIGHT | `PREFLIGHT_BLOCKED` | **Não** |
| EXECUTOR | `EXECUTOR_BLOCKED` | **Não** |
| SUPERVISION_ROLLBACK | `SUPERVISION_ROLLBACK_BLOCKED` | **Não** |

### Decisão final T-0

**`BLOCKED_FOR_FIRST_REAL_ORDER`**

**`FIRST_REAL_ORDER_NOT_EXECUTED`** — conforme regra da fase 12.5.2.

**Não aprovado:** `APPROVED_FOR_FIRST_REAL_ORDER`

### Ações obrigatórias antes de reabrir T-0 ou iniciar 12.6

1. **Rotacionar `DATABASE_URL`** (Neon + Vercel) — ver aviso § início.
2. Preencher `RealTradingApprovalId`, horário e suplente.
3. Confirmar heartbeat **`tradeMode=REAL`** e par conta/servidor vs approval.
4. Capturar **PRE_MARKET REAL do dia** e rodar **preflight PASSED**.
5. Sessão ao vivo: HALLYTON presente, MT5 + admin monitorados.
6. Repetir T-0 imediatamente antes do dispatch na 12.6.

---

## 10. Invariantes

| Item | Status |
|------|--------|
| Ordem real enviada | **Não** |
| MasterSignal real | **Não** |
| Dispatch automático | **Desativado** |
| Real Trading Guard alterado | **Não** |
| Estratégia caixa preta | **Preservada** |
| Secrets neste documento | **Nenhum** |

---

*Mercado da Riqueza AutoTrade — T-0 revalidation Session 001. Próxima etapa: fechar pendências acima, depois Fase 12.6.*
