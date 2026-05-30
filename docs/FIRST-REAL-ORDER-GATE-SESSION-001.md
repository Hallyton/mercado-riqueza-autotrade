# First Real Order Gate Session 001 — Mercado da Riqueza AutoTrade

**Fase:** 12.5.1 — Fill First Real Order Gate Checklist  
**Status:** `GATE_SESSION_PENDING_REVIEW`  
**Decisão:** `FIRST_REAL_ORDER_NOT_EXECUTED`  
**Gate da sessão:** `BLOCKED_FOR_FIRST_REAL_ORDER`  
**Branch:** `staging-vps-homologacao`  
**Data do preenchimento:** 2026-05-30  
**Referência checklist mestre:** [`FIRST-REAL-ORDER-GATE-CHECKLIST.md`](FIRST-REAL-ORDER-GATE-CHECKLIST.md)

**Regra desta fase:** preparação e validação documental — **nenhuma ordem real enviada**. Dispatch automático desativado. Estratégia caixa preta preservada.

---

## 1. Identificação da sessão

| Campo | Valor |
|-------|--------|
| **Data planejada** | A definir na Fase 12.6 (revalidação T-0) |
| **Operador responsável** | HALLYTON |
| **Suplente operacional** | PENDENTE — BLOQUEIA 12.6 |
| **Ambiente** | `https://autotrade-staging.mercadodariqueza.com.br` |
| **Corretora/servidor real** | XP MT5 — servidor real (nome completo registrado somente no admin/approval; **não** reproduzido aqui) |
| **Conta real** | Login redigido: `***9973` (últimos dígitos; conta distinta da demo homolog `52609973 @ XPMT5-DEMO`) |
| **LicenseId** | `cmpj3wby70005sx18ot5e939p` |
| **RealTradingApprovalId** | PENDENTE — registrar ID exibido em `/admin/real-trading/approvals` — **BLOQUEIA 12.6** |
| **RobotInstanceId** | Faixa operacional `910001` (instância única; ID formal de instância se aplicável: PENDENTE) |
| **MagicNumber** | `910001` |
| **Símbolo** | `WDOM26` |
| **Quantidade planejada** | **1 contrato** |
| **Horário previsto** | PENDENTE — BLOQUEIA 12.6 |
| **MasterSignalId** | N/A — dispatch manual planejado sem MasterSignal real nesta sessão |
| **InstructionId** | PENDENTE — criar na 12.6 após gate aprovado — **BLOQUEIA 12.6** |
| **ExecutionId** | PENDENTE — pós-execução 12.6 — **BLOQUEIA 12.6** |
| **ProtectionReportId** | PENDENTE — pós-proteção 12.6 — **BLOQUEIA 12.6** |

**Participante de referência:** Cliente Staging (`cliente.staging@mercadodariqueza.com.br`) — ver [`CONTROLLED-BETA-PARTICIPANT-001.md`](CONTROLLED-BETA-PARTICIPANT-001.md). Escopo desta sessão: **primeira ordem real ultra-controlada** (1 contrato), não beta demo.

---

## 2. Bloco comercial

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| Assinatura ACTIVE | OK | Licença staging homolog ativa |
| Pagamento em dia | OK | Ambiente controlado; sem inadimplência conhecida |
| Cliente sem bloqueio | OK | Sem halt total documentado |
| Termos aceitos | OK | Gate comercial exige `TermsAcceptance` — confirmar no admin T-0 |
| Plano permite o robô | OK | Perfil `conservador`; ativo `WDOM26` |
| Quantidade dentro do limite | OK | 1 participante / 1 robô / 1 contrato |
| Ciência de risco | OK | Disclaimers visíveis no produto |
| Sem promessa de rentabilidade | OK | Política de copy/compliance |
| Autorização do responsável | OK | HALLYTON — preparação 12.5.1; **reautorização explícita obrigatória na 12.6** |

**Resultado:** `COMERCIAL_OK`

---

## 3. Bloco licença e device

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| License ACTIVE | OK | `cmpj3wby70005sx18ot5e939p` |
| Device correto | OK | Device EA vinculado à licença (12.4 Bearer validado) |
| Device não revogado | OK | Declarado operador; revalidar T-0 |
| Bearer válido | OK | Validado Fase 12.4 (sem expor token) |
| Heartbeat recente | OK | Declarado operador — revalidar T-0 |
| EA online | OK | Declarado operador — revalidar T-0 |
| `tradeMode=REAL` | OK* | *Declarado operador após vínculo conta real + preflight PASSED; **revalidar heartbeat REAL T-0**. Se DEMO → tratar como BLOCKED |
| Conta/servidor conferem | OK* | *Declarado alinhado ao RealTradingApproval; revalidar T-0 |

**Resultado:** `LICENSE_DEVICE_OK` *(condicionado à revalidação T-0 de `tradeMode=REAL` e par login/servidor)*

**Nota crítica:** documentação histórica de homologação referia `52609973 @ XPMT5-DEMO`. Esta sessão 001 planeja conta **REAL** redigida — não confundir com demo.

---

## 4. Bloco Real Trading Guard

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| `ENABLE_REAL_TRADING=true/1` | OK | Declarado configurado no ambiente operacional (valor **não** registrado neste doc) |
| LicenseId em `REAL_TRADING_ALLOWED_LICENSE_IDS` | OK | Declarado operador — allowlist **por licença**, não ampla |
| RealTradingApproval APPROVED | OK | Declarado criado para conta real correta |
| `allowReal=true` | OK | Declarado operador |
| userId confere | OK | Declarado alinhado ao Cliente Staging |
| licenseId confere | OK | `cmpj3wby70005sx18ot5e939p` |
| accountLogin confere | OK | Declarado alinhado (login redigido) |
| accountServer confere | OK | Declarado alinhado (servidor real) |
| symbol confere | OK | `WDOM26` |
| magicNumber confere | OK | `910001` |
| maxContracts = 1 | OK | Limite ultra-controlado |
| minFreeMargin definido | OK | Declarado no approval |
| marginBufferPercent definido | OK | Declarado no approval |
| Sem allowlist ampla | OK | Apenas licença desta sessão |

**Resultado:** `REAL_GUARD_OK` *(condicionado a registrar `RealTradingApprovalId` no admin)*

---

## 5. Bloco conta e margem

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| Snapshot PRE_MARKET REAL do dia | OK | Declarado operador — conferir em `/admin/real-trading/snapshots` |
| Snapshot PRE_TRADE | N/A | Opcional; criar imediatamente antes da ordem na 12.6 |
| accountLogin | OK | Redigido; confere approval |
| accountServer | OK | Confere approval |
| environment=REAL | OK | Declarado no snapshot REAL |
| balance | OK | Registrado no admin — **valores não reproduzidos neste documento** |
| equity | OK | Idem |
| margin | OK | Idem |
| freeMargin | OK | Idem |
| marginLevel | OK | Se disponível no snapshot |
| requiredMargin | OK | Calculado pelo preflight |
| marginBuffer | OK | Conforme approval |
| freeMargin >= requiredMargin + buffer | OK | Declarado operador — preflight **PASSED** |
| requestedContracts <= maxContracts | OK | 1 ≤ 1 |
| Posição conflitante | OK | Declarado ausente |
| Ordem pendente conflitante | OK | Declarado ausente |
| activeMagicNumbers | OK | `910001` |
| Margem suficiente para 1 contrato | OK | Declarado operador |

**Resultado:** `MARGIN_OK` *(revalidar snapshot e preflight no dia da 12.6)*

---

## 6. Bloco instruction planejada

*Sem criar ordem real nesta fase.*

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| Dispatch manual | OK | Política operacional |
| Dispatch automático desativado | OK | `ENABLE_AUTO_DISPATCH` off — [`REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md`](REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md) |
| MasterSignal revisado | N/A | Dispatch manual sem MasterSignal real |
| Instruction planejada licença correta | OK | `cmpj3wby70005sx18ot5e939p` |
| tradeMode=REAL | OK | Planejado |
| accountLogin / accountServer | OK | Conforme approval |
| symbol | OK | `WDOM26` |
| magicNumber | OK | `910001` |
| requestedContracts=1 | OK | Ultra-controlado |
| protectionRequired=true | OK | Gate REAL |
| requiresProtectionConfirmation=true | OK | Gate REAL |
| Validade | OK | Criar com TTL adequado na 12.6 |
| Sem parâmetros internos/estratégia | OK | Caixa preta — payload allowlist |

**Resultado:** `INSTRUCTION_OK` *(plano)* — **`InstructionId` ainda PENDENTE** (bloqueia execução 12.6)

---

## 7. Bloco EA Executor

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| EA compilado MetaEditor | OK | Declarado operador |
| 0 erros de compilação | OK | Declarado operador |
| EX5 instalado na VPS | OK | Declarado operador |
| WebRequest autorizado | OK | URL staging operacional |
| AutoTrading controlado | OK | Declarado operador |
| EA recebe instruction | OK | Validado em fluxos demo/staging |
| EA valida accountLogin | OK | Contrato 12.3 |
| EA valida accountServer | OK | Contrato 12.3 |
| EA valida symbol | OK | Contrato 12.3 |
| EA valida magicNumber | OK | Contrato 12.3 |
| EA usa magicNumber na ordem | OK | Planejado |
| EA envia execution report | OK | Validado staging (demo); REAL na 12.6 |
| EA envia protection report | OK | Validado 12.4 (`PROTECTION_CONFIRMED`/`FAILED` DEMO) |
| EA não loga secrets | OK | Política EA + 12.4 |
| EA não expõe estratégia | OK | Caixa preta |

**Resultado:** `EXECUTOR_OK`

---

## 8. Bloco proteção SL/TP (plano)

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| Stop obrigatório | OK | Política REAL |
| Take obrigatório | OK | Política REAL |
| Stop anexado ou ordem de proteção | OK | Planejado — EA + broker |
| Take anexado ou ordem de proteção | OK | Planejado |
| Critério PROTECTION_CONFIRMED | OK | SL+TP presentes; preço ou ticket válido em REAL |
| Critério PROTECTION_FAILED | OK | Bloqueio + admin redigido |
| Bloqueio nova ordem em falha | OK | `protectionBlocked` em REAL — [`execution-protection.ts`](../lib/risk/execution-protection.ts) |
| Admin exibirá erro redigido | OK | Validado 12.4 |

**Resultado:** `PROTECTION_PLAN_OK` *(execução REAL de proteção pendente na 12.6)*

---

## 9. Bloco supervisão e rollback

| Critério | Avaliação | Evidência / nota |
|----------|-----------|------------------|
| HALLYTON presente | PENDENTE | Obrigatório durante **toda** a sessão 12.6 |
| VPS acessível | OK | Declarado operador |
| MT5 aberto | PENDENTE | T-0 sessão 12.6 |
| Painel admin aberto | PENDENTE | T-0 sessão 12.6 |
| Snapshots / preflights / protection / instructions | PENDENTE | Abrir T-0 sessão 12.6 |
| Corretora acessível | OK | Declarado operador |
| Kill switch conhecido | OK | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md) |
| Pausar license | OK | Admin + API documentadas |
| Suspender RealTradingApproval | OK | Admin approvals |
| Desligar AutoTrading | OK | MT5 + procedimento VPS |
| Remover EA | OK | Runbook VPS |
| Cancelar pendentes | OK | MT5 manual |
| Posição aberta | OK | Runbook documentado |
| Registrar incidente | OK | Audit + admin |
| Preservar logs | OK | MT5 + plataforma |

**Resultado:** `SUPERVISION_ROLLBACK_BLOCKED` *(itens de presença/monitoramento T-0 pendentes)*

---

## 10. Decisão final da sessão 001

| Bloco | Resultado | Gate 12.6? |
|-------|-----------|------------|
| Comercial | `COMERCIAL_OK` | OK |
| Licença/device | `LICENSE_DEVICE_OK` * | Revalidar T-0 |
| Real Trading Guard | `REAL_GUARD_OK` * | Registrar ApprovalId |
| Conta/margem | `MARGIN_OK` * | Revalidar T-0 |
| Instruction (plano) | `INSTRUCTION_OK` | InstructionId pendente |
| EA Executor | `EXECUTOR_OK` | OK |
| Proteção SL/TP (plano) | `PROTECTION_PLAN_OK` | OK |
| Supervisão/rollback | `SUPERVISION_ROLLBACK_BLOCKED` | **BLOCK** |

### Decisão

**`BLOCKED_FOR_FIRST_REAL_ORDER`**

**Motivos principais:**

1. `FIRST_REAL_ORDER_NOT_EXECUTED` — fase 12.5.1 é preparação; ordem real proibida.
2. Campos críticos **PENDENTE — BLOQUEIA 12.6:** `RealTradingApprovalId`, `Horário previsto`, `Suplente operacional`, `InstructionId`, `ExecutionId`, `ProtectionReportId`.
3. Supervisão T-0 não realizada (`SUPERVISION_ROLLBACK_BLOCKED`).
4. Revalidação obrigatória no dia da 12.6: heartbeat `tradeMode=REAL`, snapshot PRE_MARKET do dia, preflight **PASSED**.

**Não aprovado:** `APPROVED_FOR_FIRST_REAL_ORDER`

---

## 11. Pendências para Fase 12.6

1. Registrar `RealTradingApprovalId` (admin) neste documento ou anexo interno seguro.
2. Definir data, horário e suplente operacional.
3. Revalidar heartbeat `tradeMode=REAL` e par conta/servidor vs approval.
4. Snapshot PRE_MARKET REAL **do dia** da execução.
5. Preflight **PASSED** imediatamente antes do dispatch.
6. Abrir painéis admin e MT5 com HALLYTON presente.
7. Criar instruction manual (1 contrato) — sem MasterSignal real.
8. Executar ordem **somente** após todos os blocos OK + autorização explícita.

---

## 12. Invariantes

| Item | Status |
|------|--------|
| Ordem real enviada nesta fase | **Não** |
| MasterSignal real executado | **Não** |
| Dispatch automático | **Desativado** |
| Real Trading Guard alterado | **Não** |
| Estratégia caixa preta | **Preservada** |
| Secrets expostos neste documento | **Não** |

---

## 13. Fase 12.5.2 — T-0 Revalidation

**Documento:** [`docs/FIRST-REAL-ORDER-GATE-T0-REVALIDATION.md`](FIRST-REAL-ORDER-GATE-T0-REVALIDATION.md)  
**Data:** 2026-05-30  
**Status T-0:** `T0_REVALIDATION_COMPLETE`

| Bloco T-0 | Resultado |
|-----------|-----------|
| SECURITY | `SECURITY_BLOCKED` — **DATABASE_URL** exposta anteriormente; rotação Neon/Vercel **pendente** |
| LICENSE_DEVICE | `LICENSE_DEVICE_BLOCKED` |
| REAL_GUARD | `REAL_GUARD_BLOCKED` |
| MARGIN | `MARGIN_BLOCKED` |
| PREFLIGHT | `PREFLIGHT_BLOCKED` |
| EXECUTOR | `EXECUTOR_BLOCKED` (trilha REAL T-0) |
| SUPERVISION_ROLLBACK | `SUPERVISION_ROLLBACK_BLOCKED` |

### Decisão atualizada da Session 001

**`BLOCKED_FOR_FIRST_REAL_ORDER`** · **`FIRST_REAL_ORDER_NOT_EXECUTED`**

Permanece bloqueada para Fase 12.6 até: (1) rotação de credencial Neon/Vercel; (2) revalidação T-0 **ao vivo** com todos os blocos OK; (3) autorização explícita HALLYTON.

**Status sessão:** `GATE_SESSION_T0_BLOCKED` (substitui `GATE_SESSION_PENDING_REVIEW` para fins operacionais)

---

## 14. Fase 12.6 — First Ultra-Controlled Real Order Execution

**Documento:** [`docs/FIRST-REAL-ORDER-EXECUTION-SESSION-001.md`](FIRST-REAL-ORDER-EXECUTION-SESSION-001.md)  
**Data abertura:** 2026-05-27  
**Status execução:** `FIRST_REAL_ORDER_ABORTED_BEFORE_SEND`

| Item | Valor |
|------|--------|
| Ordem real enviada | **Não** |
| InstructionId | PENDENTE |
| ExecutionId | PENDENTE |
| ProtectionReportId | PENDENTE |
| PreflightId | PENDENTE |
| Resultado final | `FIRST_REAL_ORDER_NOT_EXECUTED` |

### Gates declarados OK pelo operador (pré-send)

| Bloco | Resultado |
|-------|-----------|
| SECURITY | `SECURITY_OK` (rotação DATABASE_URL declarada concluída) |
| COMERCIAL | `COMERCIAL_OK` |
| LICENSE_DEVICE | `LICENSE_DEVICE_OK` * |
| REAL_GUARD | `REAL_GUARD_OK` |
| MARGIN | `MARGIN_OK` * |
| PREFLIGHT | `PREFLIGHT_BLOCKED` — Id não registrado nesta sessão agente |
| EXECUÇÃO | Abortada antes do send |

### Decisão atualizada Session 001

**`FIRST_REAL_ORDER_NOT_EXECUTED`** — execução ao vivo (preflight Id + instruction + OrderSend + proteção) **pendente** operador MT5/admin.

**Status sessão:** `GATE_SESSION_12_6_ABORTED_BEFORE_SEND`

Nenhuma exposição de estratégia ou parâmetros internos nesta fase.

---

*Mercado da Riqueza AutoTrade — Session 001. T-0 revalidado (12.5.2); execução 12.6 abortada antes do send — dispatch ao vivo pendente.*
