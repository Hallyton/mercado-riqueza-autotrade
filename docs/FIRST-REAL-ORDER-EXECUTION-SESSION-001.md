# First Ultra-Controlled Real Order Execution — Session 001

**Fase:** 12.6 — First Ultra-Controlled Real Order Execution  
**Status:** `FIRST_REAL_ORDER_ABORTED_BEFORE_SEND`  
**Decisão:** `FIRST_REAL_ORDER_NOT_EXECUTED`  
**Sessão gate:** [`FIRST-REAL-ORDER-GATE-SESSION-001.md`](FIRST-REAL-ORDER-GATE-SESSION-001.md)  
**Branch:** `staging-vps-homologacao`  
**Data abertura sessão:** 2026-05-27  
**Operador:** HALLYTON  
**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`

**Escopo:** primeira ordem real ultra-controlada — 1 cliente, 1 licença, 1 conta, 1 robô, 1 símbolo, 1 magicNumber, **1 contrato**, dispatch **manual**, monitoramento ao vivo, proteção SL/TP obrigatória.

**Registro desta sessão agente:** documentação e pré-checks; **nenhuma ordem real enviada**; **nenhuma instruction REAL criada** nesta sessão; dispatch automático permanece **desativado**; estratégia **caixa preta** preservada.

---

## 1. Pré-check obrigatório de segurança

| Critério | Resultado | Evidência |
|----------|-----------|-----------|
| DATABASE_URL rotacionada no Neon após exposição anterior | OK | Declarado operador HALLYTON (2026-05-27); rotação pós-exposição em conversa anterior |
| DATABASE_URL atualizada no Vercel | OK | Declarado operador; deploy staging operacional (`GET /api/health` → 200) |
| Deploy staging operacional após rotação | OK | Alias `autotrade-staging.mercadodariqueza.com.br` respondendo |
| Nenhum `.env` commitado | OK | Git working tree limpo; `.env` no `.gitignore` |
| Nenhum secret em docs | OK | IDs sensíveis redigidos ou referenciados só no admin |
| Nenhum Bearer/token em logs desta sessão | OK | Política de redaction mantida |
| Nenhuma credencial impressa | OK | Agente não leu/imprimiu `.env` |

**Resultado segurança:** `SECURITY_OK`

**Nota:** credencial **não** reproduzida neste documento. Manter rotação documentada em runbook interno.

---

## 2. Identificação da sessão

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-27 (abertura documental; janela operacional ao vivo a confirmar pelo operador) |
| **Operador responsável** | HALLYTON |
| **Suplente operacional** | PENDENTE — registrar nome/contato antes do dispatch ao vivo |
| **Ambiente** | `https://autotrade-staging.mercadodariqueza.com.br` |
| **Corretora** | XP MT5 |
| **AccountLogin** | `***9973` (redigido; distinto da demo `52609973`) |
| **AccountServer** | Servidor real XP — nome completo **somente** no admin/approval |
| **LicenseId** | `cmpj3wby70005sx18ot5e939p` |
| **DeviceId** | Registrado no admin/device vinculado à licença — **não** colado neste doc |
| **RealTradingApprovalId** | Registrado no admin `/admin/real-trading/approvals` — **não** colado neste doc |
| **RobotInstanceId** | Faixa operacional `910001` |
| **Symbol** | `WDOM26` |
| **MagicNumber** | `910001` |
| **Quantidade** | **1 contrato** |
| **Dispatch** | manual |
| **AutoDispatch** | **disabled** |
| **MasterSignalId** | N/A — dispatch manual sem MasterSignal real |
| **InstructionId** | PENDENTE — criar somente após preflight PASSED ao vivo |
| **ExecutionId** | PENDENTE — pós-OrderSend |
| **ProtectionReportId** | PENDENTE — pós-proteção |
| **Snapshot PRE_MARKET Id** | PENDENTE — capturar do dia no admin antes do dispatch |
| **Snapshot POST_MARKET Id** | PENDENTE — ao fim da sessão/pregão |

---

## 3. Gate comercial

| Critério | Resultado |
|----------|-----------|
| Subscription ACTIVE | OK |
| Pagamento em dia | OK |
| Termos aceitos | OK |
| Cliente sem bloqueio | OK |
| Plano permite o robô | OK |
| Quantidade de robôs dentro do limite | OK (1) |
| Ciência de risco registrada | OK |
| Operador autorizou sessão | OK (HALLYTON — declaração 2026-05-27) |

**Resultado:** `COMERCIAL_OK`

---

## 4. Gate licença/device

*Sem imprimir token ou Bearer.*

| Critério | Resultado | Nota |
|----------|-----------|------|
| License ACTIVE | OK | `cmpj3wby70005sx18ot5e939p` |
| LicenseId correto | OK | |
| Device ativo | OK | Declarado operador |
| Device não revogado | OK | Declarado operador |
| Bearer válido | OK | Validado Fase 12.4 |
| Heartbeat recente | OK | Declarado operador — **reconfirmar imediatamente antes do dispatch** |
| EA online | OK | Declarado operador |
| tradeMode=REAL | OK | Declarado operador — **se DEMO no heartbeat → ABORT `HEARTBEAT_NOT_REAL`** |
| accountLogin confere | OK | Declarado alinhado ao approval |
| accountServer confere | OK | Declarado alinhado ao approval |

**Resultado:** `LICENSE_DEVICE_OK` *(condicionado à reconfirmação T-0 imediata antes do OrderSend)*

---

## 5. Gate Real Trading Guard

| Critério | Resultado |
|----------|-----------|
| ENABLE_REAL_TRADING=true/1 | OK (declarado operador; valor não registrado) |
| REAL_TRADING_ALLOWED_LICENSE_IDS contém a licença da sessão | OK (allowlist por licença, não ampla) |
| Sem allowlist ampla | OK |
| RealTradingApprovalId preenchido | OK (admin — ID não colado) |
| RealTradingApproval status APPROVED | OK |
| allowReal=true | OK |
| accountLogin confere | OK |
| accountServer confere | OK |
| symbol confere (`WDOM26`) | OK |
| magicNumber confere (`910001`) | OK |
| maxContracts=1 | OK |
| minFreeMargin definido | OK |
| marginBufferPercent definido | OK |

**Resultado:** `REAL_GUARD_OK`

---

## 6. Gate conta/margem

| Critério | Resultado |
|----------|-----------|
| PRE_MARKET REAL do dia | OK (declarado operador — conferir Id no admin antes do dispatch) |
| balance / equity / margin / freeMargin | OK (valores **não** reproduzidos neste doc) |
| marginLevel | OK |
| activeMagicNumbers | OK (`910001`) |
| Sem posição conflitante | OK |
| Sem ordem pendente conflitante | OK |
| freeMargin >= requiredMargin + buffer | OK (declarado operador) |
| requestedContracts = 1 | OK |
| symbol correto | OK |
| conta correta | OK |

**Resultado:** `MARGIN_OK` *(revalidar snapshot imediatamente antes da instruction)*

---

## 7. Gate preflight

*Preflight ao vivo deve ser rodado **imediatamente antes** do dispatch manual. Nesta sessão documental do agente, preflight **não** foi executado com credenciais — operador declarou validação concluída.*

| Campo | Valor |
|-------|--------|
| RealTradePreflightId | PENDENTE — registrar após execução ao vivo |
| status | PENDENTE (esperado: `PASSED`) |
| reason | PENDENTE (esperado: `REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE`) |
| subscriptionOk | PENDENTE (esperado: true) |
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
| autoDispatchOk | OK (esperado true = dispatch off permitido pelo gate) |

**Resultado nesta sessão agente:** `PREFLIGHT_BLOCKED` — preflight ao vivo com Id **não** registrado nesta sessão.

**Motivo abort antes do send:** regra 12.6 exige preflight PASSED com Id registrado **antes** da instruction; agente não executou dispatch ao vivo.

---

## 8. Instruction real

**Não criada nesta sessão** — aguardando preflight PASSED ao vivo pelo operador.

Instruction planejada (allowlist, sem estratégia):

| Campo | Valor planejado |
|-------|-----------------|
| tradeMode | REAL |
| licenseId | `cmpj3wby70005sx18ot5e939p` |
| accountLogin / accountServer | Conforme approval |
| symbol | `WDOM26` |
| magicNumber | `910001` |
| requestedContracts | 1 |
| protectionRequired | true |
| requiresProtectionConfirmation | true |
| source | admin/manual |
| expiresAt | curto (definir no dispatch) |

| Campo | Valor |
|-------|--------|
| MasterSignalId | N/A |
| InstructionId | **PENDENTE** |

---

## 9. Entrega ao EA

**Não executada** nesta sessão agente.

| Item | Status |
|------|--------|
| Instruction entregue | Não |
| Status RECEIVED/SENT | N/A |
| Horário | N/A |

---

## 10. Execução da ordem

| Item | Status |
|------|--------|
| Ordem enviada | **NÃO** |
| OrderTicket | PENDENTE |
| DealTicket | PENDENTE |
| ExecutionId | PENDENTE |
| OrderSend falhou | N/A |

**Resultado:** nenhum `OrderSend` nesta sessão. Dispatch automático permanece **off**.

---

## 11. Proteção SL/TP

**Não aplicável** — sem entrada nesta sessão.

| Item | Status |
|------|--------|
| ProtectionReportId | PENDENTE |
| protectionStatus | N/A |
| stopLossPresent | N/A |
| takeProfitPresent | N/A |
| Stop confirmado | N/A |
| Take confirmado | N/A |

---

## 12. Monitoramento ao vivo

| Item | Status nesta sessão agente |
|------|----------------------------|
| MT5/VPS monitorado | PENDENTE — operador ao vivo |
| Painéis admin abertos | PENDENTE |
| HALLYTON presente | Declarado para documentação |
| Horário envio/execução/proteção | N/A |
| Incidente | Nenhum nesta sessão documental |

---

## 13. Kill switch

Confirmado por runbook — [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md):

| Ação | Disponível |
|------|------------|
| Pausar novos dispatches | OK |
| Pausar licença | OK |
| Suspender RealTradingApproval | OK |
| Desligar AutoTrading | OK |
| Remover EA do gráfico | OK |
| Cancelar pendências | OK |
| Posição aberta — procedimento | OK |
| Registro de incidente | OK |
| Preservar logs | OK |

**Kill switch não acionado** — nenhuma ordem enviada.

---

## 14. POST_MARKET

| Item | Status |
|------|--------|
| Snapshot POST_MARKET Id | PENDENTE |
| balance/equity/margin finais | PENDENTE |
| Posições/ordens remanescentes | PENDENTE |

---

## 15. Resultado final da sessão

| Campo | Valor |
|-------|--------|
| Ordem enviada | **NÃO** |
| OrderTicket | — |
| DealTicket | — |
| ExecutionId | — |
| ProtectionReportId | — |
| ProtectionStatus | — |
| Stop confirmado | — |
| Take confirmado | — |
| Resultado operacional | Sessão 12.6 **abortada antes do send** — gates declarados OK pelo operador; preflight ao vivo com Id e dispatch manual **pendentes** |
| Incidentes | Nenhum |
| Rollback usado | Não |
| Nova ordem enviada depois | **NÃO** |
| Dispatch automático | **DESATIVADO** |
| Estratégia preservada | **SIM** |

### Status final

**`FIRST_REAL_ORDER_ABORTED_BEFORE_SEND`**

**`FIRST_REAL_ORDER_NOT_EXECUTED`**

### Gate que bloqueou o send nesta sessão

| Gate | Resultado | Efeito |
|------|-----------|--------|
| Preflight ao vivo | `PREFLIGHT_BLOCKED` (Id não registrado) | **ABORT antes da instruction** |
| Execução agente | N/A | Agente **não** opera MT5/admin autenticado — dispatch manual requer operador ao vivo |

### Próximo passo operacional (antes de reabrir send)

1. Confirmar suplente operacional e janela horária.
2. Reconfirmar heartbeat `tradeMode=REAL` e par conta/servidor.
3. Capturar PRE_MARKET REAL **do dia** (Id no admin).
4. Rodar preflight → **PASSED** → registrar `RealTradePreflightId`.
5. Criar instruction manual (1 contrato) via admin.
6. Monitorar MT5 + admin; confirmar SL/TP → `PROTECTION_CONFIRMED`.
7. Atualizar **este documento** com IDs e commitar resultado final.
8. **Não** ativar dispatch automático; **não** liberar REAL globalmente.

---

## 16. Invariantes

| Item | Status |
|------|--------|
| Ordem real enviada | **Não** |
| MasterSignal real | **Não** |
| Dispatch automático | **Desativado** |
| REAL global liberado | **Não** |
| Mais de 1 contrato | **Não** |
| Segunda ordem | **Não** |
| Estratégia exposta | **Não** |
| Secrets neste documento | **Nenhum** |

---

## Nota — validação adiada (2026-05-30)

Validação de ordem real **adiada** por indisponibilidade do servidor MetaTrader/BTG. **Não** classificar como falha do sistema.

| Item | Valor |
|------|--------|
| Status trilha | `APPROVED_PENDING_LIVE_ORDER_VALIDATION` |
| Decisão | `LIVE_ORDER_VALIDATION_DEFERRED` |
| `FIRST_REAL_ORDER_NOT_EXECUTED` | **Mantido** |
| Ordem real validada | **Não** |

Ver: [`REAL-ORDER-VALIDATION-PENDING-META-SERVER.md`](REAL-ORDER-VALIDATION-PENDING-META-SERVER.md)

---

*Mercado da Riqueza AutoTrade — Session 001 execução 12.6. Trilha aprovada com pendência de validação de ordem; retomar quando Meta/BTG estiver estável.*
