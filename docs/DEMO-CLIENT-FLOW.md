# Demo Client Flow — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 9.4 — Demo Client Flow  
**Branch de referência:** `staging-vps-homologacao`  
**RC:** [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md)  
**Certificação:** [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) — `DEMO_ENVIRONMENT_CERTIFIED`  
**Branding:** [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`

**Escopo:** documentação institucional/operacional apenas — sem alteração de código, contratos da RC, env ou deploy.

---

## 1. Objetivo

Definir a **jornada completa** de um **cliente beta DEMO** no Mercado da Riqueza AutoTrade, desde orientação institucional, cadastro/ativação, vínculo MT5 DEMO, EA cliente, heartbeat, dispatch manual e tracking até encerramento de sessão — **sem** uso de conta real, dinheiro real ou dispatch automático.

---

## 2. Escopo

### Este fluxo cobre apenas

- Cliente **DEMO** / beta controlado  
- Conta MT5 **DEMO**  
- Licença **DEMO**  
- EA cliente (executor licenciado)  
- Activation / device  
- Heartbeat  
- Instruction (`MASTER_SIGNAL`)  
- Dispatch **manual** (admin)  
- Tracking consolidado  
- Suporte operacional  
- Rollback documentado  
- Encerramento de sessão (checklist pós-sessão)

### Não cobre

- Conta **real**  
- Dinheiro **real**  
- Produção **financeira**  
- Dispatch **automático**  
- Múltiplos clientes **reais**  
- Operação comercial **aberta**

---

## 3. Persona do cliente DEMO

| Campo | Valor |
|-------|--------|
| **Cliente** | Cliente Staging / Cliente Beta DEMO |
| **Referência homologação** | `cliente.staging@mercadodariqueza.com.br` (staging) |
| **Conta MT5** | `52609973 @ XPMT5-DEMO` |
| **Perfil de exposição** | `conservador` |
| **Ambiente** | DEMO/STAGING |
| **Status** | BETA DEMO / RC DEMO-STAGING |
| **`tradeMode`** | `DEMO` |
| **`DebugMode`** | `true` (homologação) |

---

## 4. Jornada do cliente DEMO

| # | Etapa |
|---|--------|
| 1 | Cliente recebe **orientação institucional** ([`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md)). |
| 2 | Cliente entende que o ambiente é **DEMO** (sem conta real). |
| 3 | Cliente recebe **licença DEMO** (assinatura/plano staging). |
| 4 | Cliente instala e anexa **EA cliente** no MT5 **DEMO**. |
| 5 | Cliente **ativa** device/licença (activation code no dashboard). |
| 6 | Backend **valida** licença e device. |
| 7 | EA envia **heartbeat** (`ONLINE`). |
| 8 | Admin confirma cliente **online**. |
| 9 | EA Mãe ou **simulador CLI** envia **MasterSignal**. |
| 10 | Backend registra **`VALIDATED`** / **`NOT_DISPATCHED`**. |
| 11 | Admin revisa **elegibilidade** (preview, Real Trading Guard, `tradeMode=DEMO`). |
| 12 | Admin executa **dispatch manual**. |
| 13 | EA cliente recebe **Instruction** `MASTER_SIGNAL`. |
| 14 | **`DebugMode=true`** impede ordem real no broker. |
| 15 | EA envia **execution report** (`POST /api/v1/ea/executions`). |
| 16 | Painel admin mostra tracking **`EXECUTED`**. |
| 17 | Operador registra **evidência textual** (sem secrets no Git). |
| 18 | Sessão **encerrada** com checklist pós-sessão ([`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md), política AutoTrading). |

---

## 5. Pré-requisitos do cliente DEMO

- [ ] Conta MT5 **DEMO** ativa (`52609973 @ XPMT5-DEMO` ou conta beta designada).  
- [ ] MetaTrader 5 instalado.  
- [ ] **WebRequest** autorizado para `https://autotrade-staging.mercadodariqueza.com.br`.  
- [ ] EA cliente (`MR_AutoTrade_Executor.mq5`) instalado e anexado ao gráfico esperado.  
- [ ] **Activation code** válido (gerado no dashboard).  
- [ ] **Conta correta** vinculada no dashboard (login/servidor).  
- [ ] **`DebugMode=true`** em homologação.  
- [ ] **`tradeMode=DEMO`** confirmado no fluxo admin.  
- [ ] **Sem ordem real** esperada nesta fase.  
- [ ] **Sem conta real** vinculada.  
- [ ] **Aceite** dos termos / avisos DEMO.  
- [ ] Entendimento de que **não há promessa de rentabilidade**.

---

## 6. Pré-requisitos administrativos

- [ ] Admin logado (operador autorizado — **HALLYTON**).  
- [ ] **Real Trading Guard** visível no painel.  
- [ ] **Dispatch automático** desativado.  
- [ ] **Runbook** disponível ([`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md)).  
- [ ] Operador **HALLYTON** responsável pela sessão.  
- [ ] **MasterSignalId** único por sessão.  
- [ ] **Checklist pré-sessão** preenchido.  
- [ ] **Rollback** conhecido.  
- [ ] **Logs** coletados sem secrets.  
- [ ] **Evidência textual** preparada (sem prints commitados, se política de sigilo).

---

## 7. Fluxo técnico resumido

```text
EA Mãe / Simulador CLI
  → POST /api/master/signals
  → MasterSignal VALIDATED (NOT_DISPATCHED)
  → Admin preview (elegibilidade, tradeMode=DEMO, guard)
  → Dispatch manual (admin)
  → Instruction MASTER_SIGNAL
  → EA Cliente GET /api/v1/ea/instructions
  → DebugMode=true (sem ordem real)
  → POST /api/v1/ea/executions (execution report)
  → Tracking EXECUTED
```

---

## 8. Estados esperados

### Antes do dispatch

| Campo | Valor esperado |
|-------|----------------|
| MasterSignal | `VALIDATED` |
| Dispatch | `NOT_STARTED` / `NOT_DISPATCHED` |
| Instructions | `0` |
| Executions | `0` |

### Após dispatch

| Campo | Valor esperado |
|-------|----------------|
| Dispatches | `1` |
| Instructions | `1` |
| Source | `MASTER_SIGNAL` |

### Após execution report

| Campo | Valor esperado |
|-------|----------------|
| Tracking | `EXECUTED` |
| Dispatches / instruções / executadas | `1 / 1 / 1` |
| Pendentes | `0` |
| Falhas | `0` |

---

## 9. Evidências de referência

| MasterSignalId | Demonstra |
|----------------|-----------|
| `real-guard-demo-smoke-002` | DEMO funcionando; Real Trading Guard **não** bloqueia DEMO indevidamente |
| `runbook-demo-session-001` | Runbook + fluxo ponta a ponta; tracking `EXECUTED` |
| `autotrading-policy-demo-001` | AutoTrading controlado; dispatch manual; `DebugMode=true` |

**Conclusão das evidências:** fluxo DEMO validado; **conta real não usada**; dispatch **manual**; tracking **`EXECUTED`**.

Documentos: [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md), [`PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md), [`VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md`](VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md).

---

## 10. Experiência do cliente DEMO

Em linguagem simples: o cliente beta DEMO **acompanha** o funcionamento do ambiente homologado — vê o EA **conectado** (heartbeat), recebe **instruções** apenas em conta **DEMO** e acompanha o **tracking operacional** no dashboard (status e resultado agregado, **sem** exposição de lógica estratégica). Não há conta real nem dinheiro real. O foco é validar conectividade, governança, dispatch manual e rastreabilidade.

---

## 11. Mensagem para cliente beta DEMO

> Você está participando de uma validação em ambiente **DEMO/STAGING** do Mercado da Riqueza AutoTrade. **Nenhuma conta real** será utilizada. O objetivo é validar conectividade, fluxo operacional, tracking e governança. **Não há promessa de rentabilidade** e qualquer uso com dinheiro real permanece **bloqueado**.

*(Alinhado a [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).)*

---

## 12. Suporte e incidentes

**Pausar a sessão imediatamente** se:

- EA ficar **offline** ou heartbeat parar.  
- **Tracking** inconsistente ou incompleto.  
- **`DebugMode`** incorreto ou divergente do aprovado.  
- **Conta** MT5 divergente da licenciada.  
- **Secret** exposto (token, activation code, bearer).  
- **Real Trading Guard** mostrar anomalia (bloqueio indevido de DEMO ou sinal de REAL sem gate).  
- WebRequest apontando para domínio não autorizado.  
- AutoTrading ligado fora de sessão autorizada.

Registrar incidente de forma **textual**; não commitar logs brutos ou prints com dados sensíveis.

---

## 13. Rollback do cliente DEMO

1. **Parar** novos dispatches / sinais da sessão.  
2. **Remover** EA do gráfico ou garantir `DebugMode=true`.  
3. **Desligar** AutoTrading (se estava ligado na sessão).  
4. Confirmar **nenhuma ordem/posição** inesperada no terminal DEMO.  
5. **Revogar** device/token no servidor, se necessário (troca de conta, comprometimento).  
6. **Registrar** incidente e evidência textual.  
7. **Preservar** histórico de tracking/instruções no admin (não apagar auditoria).  
8. **Encerrar** sessão com checklist pós-sessão.

---

## 14. Itens proibidos no Demo Client Flow

- Uso de **conta real**.  
- Envio de **ordem real** (fora de política `DebugMode` e gates).  
- **Dispatch automático**.  
- **Promessa** de performance ou rentabilidade.  
- **Múltiplos clientes reais** ou operação comercial aberta.  
- **Exposição** de token, `device_token`, activation code ou secrets.  
- **Alteração** de EA (parâmetros, URL, símbolo) sem autorização do responsável técnico.  
- Operação **fora do runbook** ou sem operador autorizado presente.

---

## 15. Critérios para considerar o fluxo DEMO pronto

| Critério | Status RC |
|----------|-----------|
| Cliente DEMO identificado | OK |
| Conta DEMO confirmada (`52609973 @ XPMT5-DEMO`) | OK |
| EA cliente ativo | OK (homologação) |
| Heartbeat online | OK |
| `DebugMode=true` | OK |
| `tradeMode=DEMO` | OK |
| WebRequest correto | OK |
| Admin consegue revisar / dispatch | OK |
| Dispatch manual funciona | OK |
| Instruction entregue | OK |
| Execution report recebido | OK |
| Tracking `EXECUTED` | OK (sessões de referência) |
| Rollback documentado | OK |
| Conta real não usada | OK |

---

## 16. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `DEMO_CLIENT_FLOW_DEFINED_FOR_RC` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Certificação ambiente** | `DEMO_ENVIRONMENT_CERTIFIED` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

**Próxima etapa documental:** Fase 9.5 — RC Final Report.

---

*Mercado da Riqueza AutoTrade — fluxo do cliente beta DEMO definido para RC (Fase 9.4). Sem alteração de código. Conta real, produção real e dispatch automático permanecem bloqueados.*
