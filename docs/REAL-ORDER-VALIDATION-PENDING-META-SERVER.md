# Real Order Validation Pending — MetaTrader Server Unavailable

**Status:** `APPROVED_PENDING_LIVE_ORDER_VALIDATION`  
**Decisão:** `LIVE_ORDER_VALIDATION_DEFERRED`  
**Classificação:** `DEPENDÊNCIA EXTERNA — META/BTG SERVER UNAVAILABLE`  
**Branch:** `staging-vps-homologacao`  
**Data:** 2026-05-30

**Trilha aprovada com pendência:** APROVADO COM PENDÊNCIA DE VALIDAÇÃO DE ORDEM REAL

---

## 1. Contexto

A trilha de preparação para conta real avançou até o ponto de ativação real controlada:

- fluxo de aprovação manual controlada implementado;
- gerenciamento de usuários/admin implementado;
- gerenciamento de licença/devices implementado;
- revogação de device DEMO implementada;
- geração segura de activation code implementada;
- modo operacional esperado REAL implementado;
- validação de conta/servidor/tradeMode na ativação implementada;
- Real Trading Guard preservado;
- dispatch automático preservado como desativado;
- estratégia caixa preta preservada.

Documentos relacionados:

- [`REAL-TRADING-MANUAL-APPROVAL-FLOW.md`](REAL-TRADING-MANUAL-APPROVAL-FLOW.md)
- [`EA-DEVICE-ACTIVATION-AND-REVOCATION.md`](EA-DEVICE-ACTIVATION-AND-REVOCATION.md)
- [`REAL-TRADEMODE-ACTIVATION-FLOW.md`](REAL-TRADEMODE-ACTIVATION-FLOW.md)
- [`ADMIN-USER-MANAGEMENT.md`](ADMIN-USER-MANAGEMENT.md)
- [`FIRST-REAL-ORDER-GATE-SESSION-001.md`](FIRST-REAL-ORDER-GATE-SESSION-001.md)
- [`FIRST-REAL-ORDER-EXECUTION-SESSION-001.md`](FIRST-REAL-ORDER-EXECUTION-SESSION-001.md)

---

## 2. Motivo da pendência

A validação prática da ordem real **não foi realizada** porque o servidor MetaTrader/BTG **não está funcionando** no momento da tentativa operacional.

**Não classificar como falha do sistema.** A plataforma, gates e fluxos administrativos permanecem conforme implementados; a indisponibilidade é **externa** (infraestrutura MetaTrader/corretora).

| Item | Valor |
|------|--------|
| Causa | Indisponibilidade do servidor MetaTrader/BTG |
| Classificação | Dependência externa |
| Ordem real enviada | **Não** |
| Validação de ordem real | **Pendente** — janela operacional futura |

---

## 3. O que está aprovado

- [x] Admin de usuários.
- [x] Admin de licenças.
- [x] Admin de devices/VPS.
- [x] Revogação de device.
- [x] Geração de activation code.
- [x] Modo operacional esperado REAL.
- [x] Validação de accountLogin esperado.
- [x] Validação de accountServer esperado.
- [x] Validação de tradeMode esperado.
- [x] Manual approval flow.
- [x] RealTradingApproval controlado.
- [x] AccountSnapshot validado em staging.
- [x] ExecutionProtectionReport validado em staging.
- [x] PROTECTION_CONFIRMED validado em dry run.
- [x] PROTECTION_FAILED validado em dry run.
- [x] Admin protection validado.
- [x] Guard e preflight preservados.
- [x] Dispatch automático desativado.
- [x] Estratégia caixa preta.

---

## 4. O que permanece pendente

- [ ] Ativação final com servidor Meta/BTG operacional.
- [ ] Heartbeat REAL do novo device BTG.
- [ ] PRE_MARKET REAL com conta/servidor BTG.
- [ ] Real preflight PASSED.
- [ ] Dispatch manual real.
- [ ] ExecutionId real.
- [ ] ProtectionReportId real.
- [ ] PROTECTION_CONFIRMED real.
- [ ] POST_MARKET real.

**Status de execução mantido:** `FIRST_REAL_ORDER_NOT_EXECUTED` — **não** considerar ordem real validada.

---

## 5. Decisão operacional

A trilha fica **aprovada** para continuidade do projeto; a **primeira ordem real** permanece **pendente**.

| Status | Valor |
|--------|--------|
| Trilha preparação conta real | `APPROVED_PENDING_LIVE_ORDER_VALIDATION` |
| Validação ordem ao vivo | `LIVE_ORDER_VALIDATION_DEFERRED` |

### Não autorizado

- operação ampla;
- múltiplos clientes reais;
- dispatch automático;
- escala comercial real;
- liberação global de REAL.

### Autorizado

- avançar para próxima fase de produto/comercial/admin;
- manter pendência de validação real em backlog operacional;
- retomar a ordem real quando servidor Meta/BTG estiver estável.

---

## 6. Próxima fase sugerida

### Fase 13 — Comercialização, Portal do Cliente e Assinatura

**Fase 13.1 — Commercial Client Portal & Subscription Flow**

**Objetivo:** Avançar na estrutura de comercialização e operação do cliente, incluindo planos, assinatura, onboarding, portal do cliente, gestão de robôs, magicNumber, status de licença, status do EA, pagamentos e liberação operacional controlada.

---

## 7. Invariantes

| Item | Status |
|------|--------|
| Ordem real enviada nesta decisão | **Não** |
| Ordem real validada | **Não** |
| Dispatch automático | **Desativado** |
| Real Trading Guard | **Ativo** |
| Estratégia | **Caixa preta** |
| Secrets em documentação | **Nenhum** |
| Retomada validação ordem | Janela operacional futura (Meta/BTG estável) |

---

*Mercado da Riqueza AutoTrade — preparação conta real aprovada; validação de ordem ao vivo adiada por indisponibilidade externa do servidor MetaTrader/BTG.*
