# Demo Environment Certification — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 9.3 — Demo Environment Certification  
**Branch de referência:** `staging-vps-homologacao`  
**RC:** [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md) — `RC_VERSION_LOCKED_FOR_DEMO_STAGING`  
**Branding:** [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) — `BRANDING_INSTITUTIONAL_READY_FOR_DEMO_RC`

**Ambiente oficial:** `https://autotrade-staging.mercadodariqueza.com.br`

**Escopo desta fase:** certificação documental exclusivamente — sem alteração de código, backend, frontend, EAs, schema, env, deploy, Real Trading Guard, tracking ou contratos da RC.

---

## 1. Objetivo

Certificar formalmente o ambiente **DEMO/STAGING** do Mercado da Riqueza AutoTrade para:

- Demonstrações institucionais  
- Onboarding **beta** controlado  
- Validações operacionais documentadas  

**Sem** uso de conta real, produção real ou dinheiro real.

---

## 2. Escopo certificado

| Área | Certificado para DEMO/STAGING |
|------|------------------------------|
| Backend | APIs homologadas em staging (auth, persistência, halts) |
| APIs EA | Ativação, heartbeat, instructions, executions |
| MasterSignal | Intake, validação, idempotência |
| Dispatch manual | Admin trigger — sem automático |
| Tracking consolidado | Fluxo auditável até `EXECUTED` |
| Real Trading Guard | Bloqueio `REAL` por padrão |
| Runbook operacional | [`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md) validado |
| VPS/MT5 | Hardening operacional com restrições documentadas |
| AutoTrading controlado | Política e sessão 8.8 aprovada |
| Dashboard Admin | Master signals, dispatch, guard, tracking |
| Observabilidade | Tracking, auditoria, estados de ordem/instrução |
| Logs redigidos | Política de não expor secrets no repositório |

---

## 3. Evidências utilizadas

### Sessões operacionais (MasterSignalId)

| MasterSignalId | Foco | Tracking de referência |
|----------------|------|------------------------|
| `real-guard-demo-smoke-002` | Real Trading Guard + fluxo DEMO | `EXECUTED` |
| `runbook-demo-session-001` | Runbook operacional diário | `EXECUTED` |
| `autotrading-policy-demo-001` | AutoTrading controlado (política 8.8) | `EXECUTED` |

### Relatórios e marcos documentais

| Documento | Contribuição à certificação |
|-----------|----------------------------|
| [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md) | Guard validado; DEMO elegível; REAL bloqueado |
| [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md) | Auditoria técnica pré-real com restrições |
| [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md) | Hardening VPS/MT5 `VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS` |
| [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) | Status executivo consolidado |
| [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md) | Baseline RC congelada |
| [`PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md) | Evidência runbook |
| [`VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md`](VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md) | Evidência AutoTrading |

---

## 4. Certificações obtidas

| Certificação | Status |
|--------------|--------|
| DEMO dispatch validado | OK — dispatch manual admin nas sessões de referência |
| DEMO tracking validado | OK — tracking `EXECUTED` consistente |
| DEMO execution validada | OK — execution report + `DebugMode=true` |
| Rollback documentado | OK — procedimentos e halts; não acionado nas sessões de referência |
| Real Trading Guard validado | OK — REAL bloqueado; DEMO não bloqueado indevidamente |
| Runbook validado | OK — Fase 7.11 |
| AutoTrading controlado validado | OK — Fase 8.8 |
| VPS/MT5 validado | OK — com restrições (Fase 8.9) |
| Logs sem secrets no Git | OK — política de redaction e sigilo |
| Observabilidade aprovada | OK — tracking e auditoria pré-real |

---

## 5. Itens explicitamente NÃO certificados

- **Conta real**  
- **Dinheiro real**  
- **Produção real**  
- **Dispatch automático**  
- **Múltiplos clientes reais**  
- **Escala comercial**  
- **Operação pública** ou marketing de performance  

Qualquer item acima exige **novo gate** explícito e documentação dedicada.

---

## 6. Ambiente certificado

| Parâmetro | Valor |
|-----------|--------|
| `tradeMode` | `DEMO` |
| `DebugMode` | `true` (EA cliente em homologação) |
| Conta homologada | `52609973 @ XPMT5-DEMO` |
| URL | `https://autotrade-staging.mercadodariqueza.com.br` |
| `ENABLE_REAL_TRADING` | Não configurado |
| Allowlist conta real | Não configurada |

---

## 7. Badges de certificação

| Badge | Significado |
|-------|-------------|
| `DEMO_ENVIRONMENT_CERTIFIED` | Ambiente demo/staging certificado (esta fase) |
| `RC_DEMO_STAGING` | Release Candidate congelada |
| `REAL_ACCOUNT_BLOCKED` | Conta real não aprovada |
| `REAL_TRADING_GUARD_ACTIVE` | Guard ativo no backend |
| `MANUAL_DISPATCH_ONLY` | Sem dispatch automático |
| `GOVERNANCE_REQUIRED` | Gate obrigatório antes de qualquer real |

---

## 8. Limitações

- Conta real **bloqueada** (`REAL_ACCOUNT_NOT_APPROVED`).  
- Produção real **bloqueada**.  
- Dispatch automático **desativado**.  
- Gate **jurídico** pendente para conta real.  
- Gate **financeiro** pendente; limites financeiros **indefinidos**.  
- Checklist individual de conta real **não utilizado**.  
- Evidências visuais VPS/MT5 sem anexo no Git (sigilo — Fase 8.7).  
- Suplente operacional **A DEFINIR**.

---

## 9. Uso permitido

- Demonstrações institucionais (parceiros, corretoras, investidores)  
- Apresentações alinhadas a [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md)  
- Onboarding **DEMO** / beta controlado  
- Testes operacionais **controlados** (runbook, política AutoTrading)  
- Homologações técnicas em staging  

Sempre com disclaimers DEMO/STAGING e sem promessa de rentabilidade.

---

## 10. Uso proibido

- **Dinheiro real** ou conta real sem gate aprovado  
- **Operação comercial ampla** ou múltiplos clientes reais  
- **Marketing** prometendo resultados, lucro ou performance garantida  
- **Produção financeira** ou ambiente de produção real  
- Ativação de **dispatch automático** sem gate e testes dedicados  
- Divulgação de secrets, tokens ou logs brutos  

---

## 11. Próximas fases

| Fase | Nome |
|------|------|
| **9.4** | Demo Client Flow |
| **9.5** | RC Final Report |

---

## 12. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `DEMO_ENVIRONMENT_CERTIFIED` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **RC** | `RC_VERSION_LOCKED_FOR_DEMO_STAGING` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — certificação do ambiente DEMO/STAGING (Fase 9.3). Documentação apenas. Conta real, produção real e dispatch automático permanecem bloqueados.*
