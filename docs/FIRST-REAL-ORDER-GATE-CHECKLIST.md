# First Ultra-Controlled Real Order Gate Checklist — Mercado da Riqueza AutoTrade

**Status:** `REAL_ORDER_GATE_PENDING_APPROVAL`  
**Decisão:** `FIRST_REAL_ORDER_NOT_EXECUTED`  
**Fase:** 12.5 — First Ultra-Controlled Real Order Gate Checklist  
**Branch de referência:** `staging-vps-homologacao`  
**Data do documento:** 2026-05-30  

Documentos relacionados: [`CONTROLLED-REAL-PILOT-DRY-RUN-RESULTS.md`](CONTROLLED-REAL-PILOT-DRY-RUN-RESULTS.md), [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md), [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md).

---

## 1. Objetivo

Definir o checklist obrigatório antes da **primeira ordem real ultra-controlada** no Mercado da Riqueza AutoTrade, garantindo que a ordem só possa ser executada se **todos** os critérios comerciais, técnicos, operacionais, de risco e proteção estiverem OK.

**Esta fase não executa ordem real.** Registra o gate operacional e os campos de aprovação para a Fase 12.6.

---

## 2. Escopo

### Permitido nesta fase

- Revisar e preencher checklist;
- Validar configuração (env, allowlist, approval, EA, admin);
- Confirmar status no admin (snapshots, preflights, protection, instructions);
- Confirmar preflight, EA online, snapshot, approval e kill switch;
- Documentar decisão de gate.

### Proibido nesta fase

- Enviar ordem real ao mercado;
- Ativar dispatch automático;
- Liberar múltiplos clientes, robôs ou contratos;
- Executar fora do runbook;
- Operar sem supervisão;
- Alterar estratégia ou expor lógica do robô;
- Expor secrets (token, Bearer, `DATABASE_URL`, senhas, envs);
- Alterar Real Trading Guard sem autorização explícita;
- Executar MasterSignal real nesta fase.

---

## 3. Identificação da sessão

Preencher **antes** da Fase 12.6 (execução autorizada):

| Campo | Valor |
|-------|--------|
| **Data planejada** | _a preencher_ |
| **Operador responsável** | HALLYTON |
| **Suplente operacional** | _a preencher_ |
| **Ambiente** | _a preencher_ |
| **Corretora/servidor real** | _a preencher_ |
| **Conta real** | _a preencher_ |
| **LicenseId** | _a preencher_ |
| **RealTradingApprovalId** | _a preencher_ |
| **RobotInstanceId** (se aplicável) | _a preencher_ |
| **MagicNumber** | _a preencher_ |
| **Símbolo** | _a preencher_ |
| **Quantidade** | _a preencher (máx. 1 contrato nesta fase)_ |
| **Horário previsto** | _a preencher_ |
| **MasterSignalId** (se aplicável) | _a preencher_ |
| **InstructionId** | _a preencher_ |
| **ExecutionId** | _a preencher_ |
| **ProtectionReportId** | _a preencher_ |

**Regra:** não registrar tokens, senhas, URLs de banco ou valores de env neste documento.

---

## 4. Critérios comerciais

| # | Critério | OK |
|---|----------|-----|
| 1 | Assinatura ACTIVE | [ ] |
| 2 | Pagamento em dia | [ ] |
| 3 | Cliente sem bloqueio | [ ] |
| 4 | Termos aceitos | [ ] |
| 5 | Plano permite o robô contratado | [ ] |
| 6 | Quantidade de robôs dentro do limite | [ ] |
| 7 | Cliente ciente de risco | [ ] |
| 8 | Não há promessa de rentabilidade | [ ] |
| 9 | Operação autorizada pelo responsável | [ ] |

**Resultado:** `COMERCIAL_OK` ou `COMERCIAL_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 5. Critérios de licença e device

| # | Critério | OK |
|---|----------|-----|
| 1 | License ACTIVE | [ ] |
| 2 | LicenseId está correto | [ ] |
| 3 | Device vinculado à licença correta | [ ] |
| 4 | Device não revogado | [ ] |
| 5 | Bearer token válido | [ ] |
| 6 | Heartbeat recente | [ ] |
| 7 | EA online | [ ] |
| 8 | `tradeMode=REAL` confirmado no heartbeat | [ ] |
| 9 | Conta/servidor informados pelo EA conferem com a conta real aprovada | [ ] |

**Resultado:** `LICENSE_DEVICE_OK` ou `LICENSE_DEVICE_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 6. Critérios Real Trading Guard

| # | Critério | OK |
|---|----------|-----|
| 1 | `ENABLE_REAL_TRADING=true` ou `1` no ambiente correto | [ ] |
| 2 | LicenseId está em `REAL_TRADING_ALLOWED_LICENSE_IDS` | [ ] |
| 3 | RealTradingApproval está APPROVED | [ ] |
| 4 | RealTradingApproval.allowReal=true | [ ] |
| 5 | Approval confere userId | [ ] |
| 6 | Approval confere licenseId | [ ] |
| 7 | Approval confere accountLogin | [ ] |
| 8 | Approval confere accountServer | [ ] |
| 9 | Approval confere symbol | [ ] |
| 10 | Approval confere magicNumber | [ ] |
| 11 | Approval confere maxContracts | [ ] |
| 12 | Approval confere minFreeMargin | [ ] |
| 13 | Approval confere marginBufferPercent | [ ] |
| 14 | Não existe allowlist ampla | [ ] |
| 15 | REAL não está liberado globalmente | [ ] |

**Resultado:** `REAL_GUARD_OK` ou `REAL_GUARD_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 7. Critérios de conta e margem

| # | Critério | OK |
|---|----------|-----|
| 1 | Snapshot PRE_MARKET REAL do dia salvo | [ ] |
| 2 | Snapshot PRE_TRADE, se aplicável | [ ] |
| 3 | accountLogin confere | [ ] |
| 4 | accountServer confere | [ ] |
| 5 | environment=REAL | [ ] |
| 6 | balance registrado | [ ] |
| 7 | equity registrado | [ ] |
| 8 | margin registrada | [ ] |
| 9 | freeMargin registrada | [ ] |
| 10 | marginLevel registrado, se disponível | [ ] |
| 11 | freeMargin >= requiredMargin + buffer | [ ] |
| 12 | requestedContracts <= maxContracts | [ ] |
| 13 | Não há posição conflitante | [ ] |
| 14 | Não há ordem pendente conflitante | [ ] |
| 15 | activeMagicNumbers confere | [ ] |
| 16 | Margem suficiente para 1 contrato | [ ] |

**Resultado:** `MARGIN_OK` ou `MARGIN_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 8. Critérios de instrução

| # | Critério | OK |
|---|----------|-----|
| 1 | Dispatch manual | [ ] |
| 2 | Dispatch automático desativado | [ ] |
| 3 | MasterSignal revisado, se aplicável | [ ] |
| 4 | Instruction criada para a licença correta | [ ] |
| 5 | Instruction tradeMode=REAL | [ ] |
| 6 | Instruction contém accountLogin | [ ] |
| 7 | Instruction contém accountServer | [ ] |
| 8 | Instruction contém symbol | [ ] |
| 9 | Instruction contém magicNumber | [ ] |
| 10 | Instruction contém requestedContracts=1 | [ ] |
| 11 | Instruction protectionRequired=true | [ ] |
| 12 | Instruction requiresProtectionConfirmation=true | [ ] |
| 13 | Instruction não contém estratégia, parâmetros internos ou lógica do robô | [ ] |
| 14 | Instruction dentro da validade | [ ] |

**Resultado:** `INSTRUCTION_OK` ou `INSTRUCTION_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 9. Critérios de EA Executor

| # | Critério | OK |
|---|----------|-----|
| 1 | EA compilado no MetaEditor com 0 erros | [ ] |
| 2 | EA instalado na VPS/MT5 correta | [ ] |
| 3 | WebRequest autorizado para URL operacional correta | [ ] |
| 4 | AutoTrading controlado | [ ] |
| 5 | EA recebe instruction | [ ] |
| 6 | EA valida accountLogin | [ ] |
| 7 | EA valida accountServer | [ ] |
| 8 | EA valida symbol | [ ] |
| 9 | EA valida magicNumber | [ ] |
| 10 | EA usa magicNumber na ordem | [ ] |
| 11 | EA envia execution report | [ ] |
| 12 | EA envia ExecutionProtectionReport | [ ] |
| 13 | EA não loga Bearer/token/activation code | [ ] |
| 14 | EA não expõe estratégia | [ ] |

**Resultado:** `EXECUTOR_OK` ou `EXECUTOR_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 10. Critérios de proteção SL/TP

| # | Critério | OK |
|---|----------|-----|
| 1 | Stop obrigatório | [ ] |
| 2 | Take obrigatório | [ ] |
| 3 | Stop anexado ou ordem de proteção criada | [ ] |
| 4 | Take anexado ou ordem de proteção criada | [ ] |
| 5 | stopLossPresent=true | [ ] |
| 6 | takeProfitPresent=true | [ ] |
| 7 | stopLossPrice ou stopOrderTicket válido | [ ] |
| 8 | takeProfitPrice ou takeOrderTicket válido | [ ] |
| 9 | protectionStatus=PROTECTION_CONFIRMED | [ ] |
| 10 | Em PROTECTION_FAILED, bloquear novas ordens | [ ] |
| 11 | Em PROTECTION_PENDING, bloquear novas ordens | [ ] |
| 12 | Erro de proteção aparece no admin de forma redigida | [ ] |

**Resultado:** `PROTECTION_OK` ou `PROTECTION_BLOCKED`  
**Resultado atual:** _não avaliado_ (validação staging DEMO concluída na Fase 12.4; REAL pendente na 12.6)

**Referência 12.4:** `PROTECTION_CONFIRMED` e `PROTECTION_FAILED` validados em staging (conta DEMO); admin `/admin/real-trading/protection` exibindo reports.

---

## 11. Critérios de supervisão

| # | Critério | OK |
|---|----------|-----|
| 1 | HALLYTON presente durante toda a sessão | [ ] |
| 2 | VPS acessível | [ ] |
| 3 | MT5 aberto e monitorado | [ ] |
| 4 | Painel admin aberto | [ ] |
| 5 | Página snapshots aberta | [ ] |
| 6 | Página preflights aberta | [ ] |
| 7 | Página protection aberta | [ ] |
| 8 | Página instructions/executions aberta | [ ] |
| 9 | Corretora/plataforma acessível | [ ] |
| 10 | Procedimento de pausa conhecido | [ ] |
| 11 | Kill switch conhecido | [ ] |
| 12 | Plano de rollback conhecido | [ ] |

**Resultado:** `SUPERVISION_OK` ou `SUPERVISION_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 12. Kill switch e rollback

| # | Critério | OK |
|---|----------|-----|
| 1 | Como pausar novos dispatches está definido | [ ] |
| 2 | Como pausar licença está definido | [ ] |
| 3 | Como suspender RealTradingApproval está definido | [ ] |
| 4 | Como desligar AutoTrading está definido | [ ] |
| 5 | Como remover EA do gráfico está definido | [ ] |
| 6 | Como cancelar ordem pendente está definido | [ ] |
| 7 | Como lidar com posição aberta está definido | [ ] |
| 8 | Como registrar incidente está definido | [ ] |
| 9 | Como preservar logs está definido | [ ] |
| 10 | Responsável por rollback definido | [ ] |

**Resultado:** `ROLLBACK_OK` ou `ROLLBACK_BLOCKED`  
**Resultado atual:** _não avaliado_

---

## 13. Decisão de gate

A primeira ordem real só poderá ocorrer se **todos** os blocos estiverem OK:

| Bloco | OK |
|-------|-----|
| COMERCIAL_OK | [ ] |
| LICENSE_DEVICE_OK | [ ] |
| REAL_GUARD_OK | [ ] |
| MARGIN_OK | [ ] |
| INSTRUCTION_OK | [ ] |
| EXECUTOR_OK | [ ] |
| PROTECTION_OK | [ ] |
| SUPERVISION_OK | [ ] |
| ROLLBACK_OK | [ ] |

### Resultado possível

- `APPROVED_FOR_FIRST_REAL_ORDER` — todos os blocos OK + autorização explícita do operador
- `BLOCKED_FOR_FIRST_REAL_ORDER` — qualquer bloco falhou ou fase 12.5 ainda em preparação

### Status inicial deste documento

**`BLOCKED_FOR_FIRST_REAL_ORDER`**

**Motivo:** Primeira ordem real ainda não executada nesta fase. Checklist em preparação operacional; critérios comerciais, REAL guard, margem REAL, instruction REAL e supervisão da sessão ainda não preenchidos.

---

## 14. Campos de resultado da primeira ordem real futura

Preencher **somente** após execução autorizada na **Fase 12.6**:

| Campo | Valor |
|-------|--------|
| Data/hora da ordem | _a preencher_ |
| Símbolo | _a preencher_ |
| Quantidade | _a preencher_ |
| MagicNumber | _a preencher_ |
| OrderTicket | _a preencher_ |
| DealTicket | _a preencher_ |
| Preço de entrada | _a preencher_ |
| Stop confirmado | _a preencher_ |
| Take confirmado | _a preencher_ |
| ProtectionReportId | _a preencher_ |
| Resultado do preflight | _a preencher_ |
| Resultado da execution | _a preencher_ |
| Resultado da protection | _a preencher_ |
| Incidente | _a preencher_ |
| Ação de rollback | _a preencher_ |
| Observações | _a preencher_ |

---

## 15. Restrições permanentes

- Estratégia permanece **caixa preta** — cliente não acessa lógica interna.
- Dispatch automático permanece **desativado** até nova fase autorizada.
- Conta real **não** é liberada para múltiplos clientes nesta etapa.
- Esta fase **não** autoriza escala comercial nem operação ampla.
- Esta fase **não** substitui revisão jurídica/comercial.
- Nenhum secret, token ou parâmetro estratégico deve constar neste documento ou em logs públicos.

---

## 16. Próxima etapa

**Fase 12.6 — First Ultra-Controlled Real Order Execution**

Somente poderá iniciar se:

- Checklist 12.5 aprovado (`APPROVED_FOR_FIRST_REAL_ORDER`);
- Todos os gates estiverem OK;
- Operador confirmar autorização explícita;
- Conta real e margem validadas no dia;
- EA compilado, instalado e monitorado;
- RealTradingApproval correto e ativo;
- Preflight **PASSED**;
- Stop/take obrigatórios e `PROTECTION_CONFIRMED` em conta **REAL**.

**Nesta fase (12.5):** nenhuma ordem real enviada. Dispatch automático desativado. Real Trading Guard inalterado.
