# Release Candidate — Version Freeze (DEMO/STAGING)

**Data:** 2026-05-27  
**Fase:** 9.1 — Release Candidate Version Freeze  
**Branch de referência:** `staging-vps-homologacao`  
**Commit de referência:** `6548c75` — `docs: close vps mt5 hardening validation`

Documentos de consolidação: [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md), [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md), [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md), [`PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md), [`VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md`](VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md).

---

## 1. Objetivo

Congelar a **versão Release Candidate (RC)** do **Mercado da Riqueza AutoTrade** para homologação **DEMO/STAGING**, após conclusão das trilhas:

- **Fases 6.x** — Real Trading Guard  
- **Fases 7.x** — Auditoria Técnica Pré-Conta Real  
- **Fases 8.x** — Hardening Operacional VPS/MT5  

O freeze é **documental e estrutural**: define o baseline homologado antes de qualquer expansão futura (branding, certificação demo, fluxo cliente demo, relatório RC final). **Não** libera conta real, produção real nem dispatch automático.

---

## 2. Escopo congelado

| Área | Incluído no freeze |
|------|-------------------|
| Backend | APIs, auth, persistência homologada em staging |
| APIs EA | `/api/v1/ea/*` — ativação, heartbeat, instructions, executions |
| MasterSignal | Intake, validação, idempotência, painel admin |
| Dispatch manual | Admin trigger — sem dispatch automático |
| Tracking | Estados consolidados (`EXECUTED`, etc.) |
| Real Trading Guard | Bloqueio `REAL` por padrão |
| VPS/MT5 | Hardening operacional documentado |
| Runbook | [`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md) validado |
| AutoTrading controlado | Política e sessão 8.8 aprovada |
| Auditorias | Relatório técnico pré-real (Fase 7) |
| Hardening operacional | Relatório final VPS/MT5 (Fase 8.9) |

**Ambiente oficial de homologação:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Conta de referência:** `52609973 @ XPMT5-DEMO`

---

## 3. Componentes congelados

| Componente | Baseline RC |
|------------|-------------|
| **EA Cliente** | `MR_AutoTrade_Executor.mq5` — executor licenciado; `DebugMode=true` em homologação |
| **EA Mãe** | Integração via `POST /api/master/signals` (simulador CLI / origem `MASTER_EA`) |
| **Tracking** | MasterSignal → dispatch → instruction → execution → tracking consolidado |
| **Policies** | Operadores, AutoTrading, Real Trading Guard, AGENTS.md / caixa preta |
| **Runbooks** | Operacional diário pré-real; validação demo documentada |
| **Dashboard admin** | Master signals, instruções, Real Trading Guard, dispatch manual |
| **VPS/MT5** | Hardening `VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS` |
| **Prisma schema** | Modelos homologados em staging (incl. `MasterSignal`, dispatches, instruções) |
| **Contratos API** | REST `/v1` EA; `/api/master/signals`; admin dispatch — sem alteração de contrato crítico sem revisão |
| **Logs / redaction** | Política de não expor secrets, tokens, senhas ou logs brutos no Git |
| **Rollback** | Documentado (halts, revogação device, rollback operacional VPS — não utilizado nas sessões de referência) |

---

## 4. Restrições mantidas

- Conta real **bloqueada** (`REAL_ACCOUNT_NOT_APPROVED`).
- Produção real **bloqueada**.
- Dinheiro real **bloqueado**.
- Dispatch automático **desativado**.
- AutoTrading **somente controlado** (sessão autorizada, operador presente, checklist pré/pós).
- **Sem** múltiplos clientes reais.
- **Sem** operação comercial real.
- `ENABLE_REAL_TRADING` não configurado; allowlist conta real não configurada.

---

## 5. Estado atual do sistema

| Item | Estado |
|------|--------|
| `tradeMode=DEMO` | Validado |
| `DebugMode=true` | Validado (EA cliente em homologação) |
| `runbook-demo-session-001` | Tracking `EXECUTED` |
| `autotrading-policy-demo-001` | Tracking `EXECUTED` |
| Tracking | Consistente nas sessões de referência (1/1/1) |
| Rollback | Documentado; não acionado nas sessões de referência |
| Real Trading Guard | Ativo |
| Hardening VPS/MT5 | `VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS` |
| Auditoria técnica pré-real | `PRE_REAL_TECHNICAL_AUDIT_APPROVED_WITH_RESTRICTIONS` |
| Operador responsável | HALLYTON |
| Suplente operacional | A DEFINIR |

---

## 6. Objetivo da RC

Preparar, **sem liberar conta real**:

- Demonstrações institucionais  
- Homologação comercial  
- Onboarding futuro controlado  
- Parceria corretora (discussão técnica/documental)  
- Readiness técnico para próximas fases 9.x  

A RC é um **marco de baseline** DEMO/STAGING, não uma liberação de produção com dinheiro real.

---

## 7. Alterações permitidas após freeze

Somente com registro documental e critério de necessidade:

- Correções **críticas** (segurança, indisponibilidade, perda de rastreabilidade)  
- Ajustes de **segurança** e redaction  
- **Documentação** operacional e de produto  
- Ajustes de **observabilidade** (métricas, logs agregados — sem secrets no Git)  
- Ajustes operacionais **DEMO** (sessões, runbook, evidências textuais)  

Alterações estruturais relevantes devem atualizar este documento ou gerar revisão de RC (nova subfase ou tag).

---

## 8. Alterações proibidas após freeze

- Liberar **conta real** ou `tradeMode=REAL` sem novo gate explícito.  
- Ativar **dispatch automático** sem gate e testes dedicados.  
- Alterar **contratos críticos** de API (EA, master signal, dispatch) sem revisão.  
- Quebrar **tracking** ou auditoria de ordens/instruções.  
- Alterar **políticas** (AutoTrading, operadores, Real Trading Guard) sem revisão.  
- Remover **guardrails** (DebugMode em homologação, halts, idempotência, redaction).  
- Commitar prints, logs brutos, tokens ou secrets no repositório.

---

## 9. Próximas fases sugeridas

| Fase | Nome |
|------|------|
| **9.2** | Branding & Institutional Readiness |
| **9.3** | Demo Environment Certification |
| **9.4** | Demo Client Flow |
| **9.5** | RC Final Report |

Todas as fases 9.x subsequentes devem respeitar este freeze e a decisão `REAL_ACCOUNT_NOT_APPROVED` até gate explícito.

---

## 10. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `RC_VERSION_LOCKED_FOR_DEMO_STAGING` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — Release Candidate congelada para DEMO/STAGING (Fase 9.1). Sem alteração de código nesta fase. Conta real, produção real e dispatch automático permanecem bloqueados.*
