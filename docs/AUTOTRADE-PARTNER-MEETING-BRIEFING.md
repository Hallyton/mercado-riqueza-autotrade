# Roteiro de Reunião — Mercado da Riqueza AutoTrade

Documento da **Fase 5.9** para preparar reunião com corretora, jurídico, parceiro técnico ou investidor.

Este briefing **NÃO** libera conta real, **NÃO** libera produção real, **NÃO** libera dinheiro real e **NÃO** ativa dispatch automático.

---

## 1. Objetivo da reunião

A reunião tem como objetivo:

- apresentar o projeto Mercado da Riqueza AutoTrade;
- demonstrar o fluxo técnico validado;
- apresentar evidências de staging/demo;
- alinhar riscos e responsabilidades;
- entender requisitos da corretora/parceiro;
- definir próximos passos;
- reforçar que conta real ainda não está liberada.

---

## 2. Resumo do projeto

O Mercado da Riqueza AutoTrade é uma plataforma de automação controlada baseada em:

- EA Mãe ou simulador enviando `MasterSignal`;
- backend validando e registrando o sinal;
- admin revisando elegibilidade;
- dispatch manual;
- EA cliente recebendo instruction;
- execution report;
- tracking no painel.

Modelo operacional:

- estratégia caixa preta;
- cliente não parametriza lógica;
- admin mantém controle;
- rastreabilidade completa;
- foco em segurança e governança.

---

## 3. Status atual

| Campo | Valor |
|-------|-------|
| Status técnico | VALIDADO EM STAGING / DEMO |
| Conta real | `REAL_ACCOUNT_NOT_APPROVED` |
| Produção real | NÃO LIBERADA |
| Dispatch automático | NÃO ATIVADO |
| Conta demo `DebugMode=false` | VALIDADA |
| Governança conta real | DOCUMENTADA, MAS NÃO APROVADA |

---

## 4. O que já foi validado

- MasterSignal intake.
- Idempotência.
- Dispatch manual admin.
- Elegibilidade por licença/perfil.
- Instruction `MASTER_SIGNAL`.
- EA cliente recebendo instruction.
- Execution report.
- Tracking `EXECUTED`.
- Sinal expirado bloqueado.
- Profile mismatch bloqueado.
- EA offline/reconexão.
- Rollback operacional.
- Beta demo com `DebugMode=true`.
- Conta demo com `DebugMode=false`.
- Falha segura por AutoTrading disabled.

---

## 5. O que NÃO está liberado

- conta real;
- dinheiro real;
- produção real;
- dispatch automático;
- múltiplos clientes;
- múltiplos ativos;
- perfil agressivo;
- escala comercial;
- copy trade público;
- promessa de rentabilidade;
- operação sem revisão jurídica/operacional.

---

## 6. Perguntas para a corretora

- Quais requisitos a corretora exige para automação via MetaTrader 5?
- Há regras específicas para robôs em conta real?
- Há limites de quantidade, contratos, horários ou ativos?
- Existe API/relatório para auditoria das ordens?
- A corretora permite operação por EA em conta de cliente?
- Há exigência de termo específico com o cliente?
- Há exigência de suitability/perfil do investidor?
- Há limitações para mini dólar/WDO?
- Existe ambiente demo/homologação recomendado?
- Como tratar rollback ou emergência operacional?
- Há suporte para VPS/MetaTrader?
- Há algum requisito regulatório ou de compliance interno?

---

## 7. Perguntas para jurídico

- O termo operacional atual é suficiente como base?
- Que disclaimers são obrigatórios?
- Como registrar aceite do cliente?
- Como descrever estratégia caixa preta sem expor lógica?
- Como limitar responsabilidade por falhas técnicas?
- Como tratar ausência de promessa de rentabilidade?
- Como documentar risco de mercado?
- Como documentar risco tecnológico?
- Como tratar autorização para operação limitada?
- Como tratar LGPD e dados de conta/execução?
- O modelo pode ser apresentado como tecnologia, sinal, consultoria ou automação?
- Há necessidade de revisão regulatória antes de real?

---

## 8. Perguntas para parceiro técnico

- O fluxo atual é adequado para operação controlada?
- Há pontos de falha técnica relevantes?
- O tracking é suficiente para auditoria?
- Os logs são suficientes?
- O rollback é suficiente?
- O controle de idempotência é suficiente?
- O modelo de dispatch manual está seguro?
- Há risco de duplicidade?
- O EA cliente precisa de melhorias antes de qualquer real?
- O EA Mãe precisa de melhorias?
- Há necessidade de auditoria de código?
- Há necessidade de observabilidade adicional?

---

## 9. Riscos a discutir

- risco de mercado;
- risco tecnológico;
- risco de conexão;
- risco de MetaTrader/VPS;
- risco de ordem duplicada;
- risco de divergência de conta;
- risco de ativo/perfil incorreto;
- risco de secret exposto;
- risco de dispatch indevido;
- risco de rollback falhar;
- risco de interpretação comercial/regulatória.

---

## 10. Documentos de apoio

- [`docs/AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md)
- [`docs/PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md)
- [`docs/SIMULATED-PRODUCTION-FINAL-REPORT.md`](SIMULATED-PRODUCTION-FINAL-REPORT.md)
- [`docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md)
- [`docs/REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md)
- [`docs/REAL-ACCOUNT-RISK-GATE-SUMMARY.md`](REAL-ACCOUNT-RISK-GATE-SUMMARY.md)
- [`docs/REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md`](REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md)
- [`docs/REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md)
- [`docs/REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md`](REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md)
- [`docs/MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md)

---

## 11. Decisões esperadas da reunião

- continuar apenas em demo;
- encaminhar para jurídico;
- encaminhar para área técnica da corretora;
- definir limites mínimos;
- revisar termo;
- definir participante piloto;
- solicitar auditoria técnica;
- pausar conta real;
- aprovar apenas próxima rodada documental;
- não avançar para real neste momento.

---

## 12. Próximos passos possíveis

A. Manter somente demo e continuar validações.  
B. Enviar pacote para revisão jurídica.  
C. Enviar pacote para parceiro técnico.  
D. Criar versão comercial/documental para apresentação.  
E. Definir limites financeiros preliminares.  
F. Preencher checklist individual de um participante futuro.  
G. Preparar auditoria técnica.  
H. Não avançar para conta real.

---

## 13. Mensagem central da reunião

O projeto já demonstrou capacidade técnica em staging/demo, inclusive com ordem em conta demo via `DebugMode=false`, mas adota uma postura conservadora: conta real só pode ser discutida após revisão jurídica, operacional, técnica, definição de limites e aprovação manual específica.

---

## 14. Status final do briefing

**Status:** `MEETING_BRIEFING_READY`

**Decisão atual:** `REAL_ACCOUNT_NOT_APPROVED`

---

*Mercado da Riqueza AutoTrade — roteiro de reunião para parceiros. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
