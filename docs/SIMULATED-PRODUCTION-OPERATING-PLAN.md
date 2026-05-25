# Plano Operacional — Produção Simulada Controlada

Documento da **Fase 3.1** para operar o Mercado da Riqueza AutoTrade em modo **produção simulada controlada**, usando staging, conta demo, EA cliente em `DebugMode=true` e dispatch manual pelo admin.

**Status:** plano operacional documentado.  
**Produção real:** não liberada.  
**Ordem real:** não liberada.  
**Dispatch automático:** proibido.

---

## 1. Objetivo

Definir como operar o AutoTrade em modo produção simulada, com comportamento próximo ao fluxo real, mas ainda sem risco de ordem real:

```text
EA Mãe / simulador
  → POST /api/master/signals (intake)
  → admin revisa elegibilidade
  → admin dispara manualmente
  → Instruction MASTER_SIGNAL
  → EA cliente em DebugMode=true
  → execution report
  → tracking EXECUTED / pendente / falha
```

Este plano transforma o gate aprovado em uma rotina repetível de homologação operacional.

---

## 2. Regras absolutas

| Regra | Obrigatório |
|-------|-------------|
| Produção real | **Não liberada** |
| Ordem real | **Não liberada** |
| EA cliente | Obrigatoriamente `DebugMode=true` |
| Dispatch automático | **Proibido** — `POST /api/master/signals` é somente intake |
| Revisão admin | Obrigatória antes de qualquer dispatch |
| Secrets | Nunca em logs, prints, commits ou chat |
| DARF / billing / dashboard cliente | Fora desta fase |

Se qualquer regra absoluta for violada, a sessão deve ser interrompida e documentada como bloqueada.

---

## 3. Ambiente oficial

| Item | Valor |
|------|-------|
| URL staging | `https://autotrade-staging.mercadodariqueza.com.br` |
| Conta MT5 | `52609973 @ XPMT5-DEMO` |
| Perfil operacional | `conservador` |
| Símbolo padrão | `WDOM26` |
| Source intake | `MASTER_EA` |
| Source instruction | `MASTER_SIGNAL` |
| Plano | `start`, com `allow_demo` habilitado para homologação |
| EA Mãe | `MR_AutoTrade_Master_Signal` |
| EA cliente | `MR_AutoTrade_Executor` em `DebugMode=true` |

Não usar banco local, localhost, produção real ou domínio diferente do staging oficial durante a rotina.

---

## 4. Rotina operacional sugerida

Executar por sessão ou rotina diária, sempre registrando evidências.

| # | Passo | Resultado esperado |
|---|-------|--------------------|
| 1 | Pré-check Git/staging | Branch correta, sem alterações pendentes; staging acessível |
| 2 | Confirmar EA cliente online | Heartbeat `ONLINE` no painel/log |
| 3 | Confirmar `DebugMode=true` | Nenhuma ordem real possível |
| 4 | Confirmar EA Mãe pronto | WebRequest staging liberado, secret local preenchido, `InpSendOnInit=false` |
| 5 | Enviar 1 sinal mestre | `POST /api/master/signals` aceito |
| 6 | Validar intake no painel | `VALIDATED` / `NOT_DISPATCHED`, com 0 dispatches/instructions/executions |
| 7 | Admin revisar elegibilidade | Licença esperada visível ou motivo de skip documentado |
| 8 | Admin disparar manualmente | `MasterSignalDispatch` e `Instruction MASTER_SIGNAL` criados |
| 9 | EA cliente receber instruction | GET `/api/v1/ea/instructions` OK |
| 10 | Confirmar nenhuma ordem real | Log de DebugMode; sem ticket real |
| 11 | Confirmar tracking | `EXECUTED`, pendente ou falha explicada |
| 12 | Registrar evidência | Template preenchido e anexos sem secrets |

---

## 5. Quantidade de ciclos recomendada

Antes de considerar a Fase 3 operacionalmente aprovada:

- Mínimo de **10 ciclos simulados aprovados**.
- Execução em pelo menos **3 dias diferentes**.
- Pelo menos **2 cenários de expiração**.
- Pelo menos **2 testes de retry/idempotência**.
- Pelo menos **1 teste de rollback operacional**.

Os ciclos podem usar EA Mãe MQL5 ou simulador HTTP, mas a rotina principal deve incluir o EA Mãe MQL5.

---

## 6. Cenários obrigatórios

| Cenário | Validação esperada |
|---------|--------------------|
| Sinal `BUY` válido | Intake `VALIDATED`, dispatch admin, tracking final rastreável |
| Sinal `SELL` válido | Mesmo fluxo do BUY, sem ordem real |
| Sinal expirado | Dispatch bloqueado com motivo claro |
| Retry do mesmo `MasterSignal` | Idempotente, sem duplicidade indevida |
| Disparo admin repetido | Sem nova instruction duplicada |
| EA cliente offline | Tracking permanece pendente; sem perda de auditoria |
| EA cliente online novamente | Instruction recebida/reportada quando elegível |
| WebRequest bloqueado | Falha clara no EA; nenhum dado sensível exposto |
| Secret inválido | HTTP 401; sem persistir sinal válido |
| Usuário admin sem permissão | Dispatch negado |
| Sem licença elegível | Sem instruction; motivo de skip documentado |
| Tracking `EXECUTED` | Execution report refletido no painel |
| Tracking pendente | Estado pendente claro e rastreável |
| Rollback operacional | EAs removidos/parados, WebRequest/secret/token tratados conforme runbook |

---

## 7. Evidências a registrar por ciclo

Copiar e preencher por ciclo. Não colar secrets nem connection strings.

```text
Data/hora:
Responsável:
Ambiente: https://autotrade-staging.mercadodariqueza.com.br
MasterSignalId:
InstructionId:
LicenseId:
MT5: 52609973 @ XPMT5-DEMO
EA cliente DebugMode: true / false
Resultado intake:
Resultado dispatch:
Resultado EA:
Resultado tracking:
Prints/logs relevantes (sem secrets):
Status final: APPROVED / APPROVED_WITH_NOTES / BLOCKED / FAILED
Observações:
```

Evidências mínimas:

- Linha do `MasterSignal` no painel.
- Detalhe do sinal com tracking.
- Instruction `MASTER_SIGNAL`.
- Log do EA cliente mostrando DebugMode / execution report.
- Resultado de retry ou motivo de bloqueio quando aplicável.

---

## 8. Critérios para considerar Fase 3 aprovada

| Critério | Meta |
|----------|------|
| Ciclos simulados | 10 ciclos aprovados |
| Ordem real | 0 ordens reais |
| Dispatch automático | 0 ocorrências |
| Duplicidade indevida | 0 instructions duplicadas por retry |
| Secrets expostos | 0 ocorrências |
| Rastreabilidade | 100% dos sinais visíveis no painel |
| Rollback | Testado pelo menos 1 vez |
| Falhas | Documentadas, tratadas e revalidadas quando necessário |

Fase 3 só deve avançar se todas as metas forem satisfeitas e a equipe concordar que o fluxo é repetível.

---

## 9. Critérios de bloqueio

A operação simulada deve parar imediatamente se ocorrer:

- Qualquer ordem real enviada.
- EA cliente com `DebugMode=false`.
- Dispatch automático no `POST /api/master/signals`.
- Instruction duplicada por retry ou disparo repetido.
- Secret exposto em log, print, commit ou chat.
- Tracking inconsistente ou não auditável.
- Admin sem permissão conseguindo disparar.
- Uso de banco local por engano.
- Uso de domínio ou ambiente diferente do staging oficial.
- Impacto em DARF, billing ou dashboard cliente fora do escopo.

Cada bloqueio deve gerar registro com causa provável, evidência e decisão de correção antes de novo ciclo.

---

## 10. Próxima decisão após Fase 3

Somente após a Fase 3 aprovada:

- Discutir presets operacionais internos.
- Discutir estratégia real do EA Mãe, sempre mantendo o modelo caixa preta.
- Discutir beta fechado e controles de risco adicionais.
- Definir novo gate para qualquer mudança envolvendo produção real.

Mesmo após a Fase 3, **produção real não deve ser liberada automaticamente**. Qualquer avanço para conta real, ordem real ou produção pública exige fase própria, autorização explícita e documentação de compliance/risco.

---

## Referências

| Documento | Uso |
|-----------|-----|
| [`SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md) | Checklist e critérios do gate |
| [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md) | Resultado aprovado do gate |
| [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) | Plano macro das fases |
| [`MASTER-EA-MQL5-V1.md`](MASTER-EA-MQL5-V1.md) | EA Mãe emissor manual |
| [`MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md) | Arquitetura caixa preta |

---

*Mercado da Riqueza AutoTrade — operação simulada controlada em staging. Produção real permanece fora de escopo.*
