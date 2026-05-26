# Plano de Revisão Jurídica e Operacional — Conta Real

Documento da **Fase 5.5** para definir o roteiro de revisão jurídica, operacional e de risco antes de qualquer eventual aprovação futura de sessão real ultra-controlada.

Este plano **NÃO** libera conta real.  
Este plano **NÃO** libera produção real.  
Este plano **NÃO** libera ordem com dinheiro real.  
Este plano **NÃO** ativa dispatch automático.  
Este plano apenas organiza as revisões necessárias antes de qualquer decisão futura.

---

## 1. Contexto

- Fase 5.1 criou o Gate de Conta Real Ultra-Controlada.
- Fase 5.2 criou a minuta de aceite e limites.
- Fase 5.3 criou o checklist individual.
- Fase 5.4 consolidou o status `REAL_ACCOUNT_NOT_APPROVED`.
- Nenhuma conta real foi usada.
- Nenhuma ordem real foi enviada.
- Produção real segue bloqueada.

---

## 2. Objetivo da revisão

A revisão deve garantir que, antes de qualquer conta real:

- riscos jurídicos sejam avaliados;
- riscos operacionais sejam avaliados;
- limites sejam definidos;
- responsabilidades sejam documentadas;
- aceite seja formalizado;
- rollback esteja claro;
- decisão final seja manual e registrada.

---

## 3. Documentos a revisar

- [`docs/REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md`](REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md)
- [`docs/REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md)
- [`docs/REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md`](REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md)
- [`docs/REAL-ACCOUNT-RISK-GATE-SUMMARY.md`](REAL-ACCOUNT-RISK-GATE-SUMMARY.md)
- [`docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md)
- [`docs/MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md)

---

## 4. Revisão jurídica

Checklist jurídico:

- [ ] Validar linguagem de risco.
- [ ] Validar ausência de promessa de rentabilidade.
- [ ] Validar autorização limitada.
- [ ] Validar responsabilidades do participante.
- [ ] Validar responsabilidades do Mercado da Riqueza.
- [ ] Validar uso de estratégia caixa preta.
- [ ] Validar ciência de risco tecnológico.
- [ ] Validar ciência de risco de mercado.
- [ ] Validar procedimento de pausa/cancelamento.
- [ ] Validar necessidade de assinatura formal.
- [ ] Validar se o documento pode ser usado com cliente externo.
- [ ] Validar aderência regulatória antes de qualquer uso real.

**Status inicial:** `PENDING_LEGAL_REVIEW`

---

## 5. Revisão operacional

Checklist operacional:

- [ ] Confirmar quem será o responsável pela sessão.
- [ ] Confirmar horário permitido.
- [ ] Confirmar ativo permitido.
- [ ] Confirmar perfil permitido.
- [ ] Confirmar quantidade máxima.
- [ ] Confirmar número máximo de sinais.
- [ ] Confirmar regra de encerramento.
- [ ] Confirmar regra de rollback.
- [ ] Confirmar quem pode disparar pelo admin.
- [ ] Confirmar quem acompanha o MT5 em tempo real.
- [ ] Confirmar como registrar evidências.
- [ ] Confirmar como pausar tudo em emergência.

**Status inicial:** `PENDING_OPERATIONAL_REVIEW`

---

## 6. Revisão técnica

Checklist técnico:

- [ ] Confirmar ambiente correto.
- [ ] Confirmar conta correta.
- [ ] Confirmar servidor correto.
- [ ] Confirmar licença correta.
- [ ] Confirmar device correto.
- [ ] Confirmar WebRequest.
- [ ] Confirmar EA instalado.
- [ ] Confirmar logs visíveis.
- [ ] Confirmar tracking funcionando.
- [ ] Confirmar dispatch manual.
- [ ] Confirmar dispatch automático desativado.
- [ ] Confirmar rollback técnico.
- [ ] Confirmar secret protegido.

**Status inicial:** `PENDING_TECHNICAL_REVIEW`

---

## 7. Limites que precisam ser definidos

```text
Capital máximo autorizado:
A DEFINIR — BLOQUEIA CONTA REAL

Perda máxima por sessão:
A DEFINIR — BLOQUEIA CONTA REAL

Perda máxima diária:
A DEFINIR — BLOQUEIA CONTA REAL

Quantidade máxima:
A DEFINIR — BLOQUEIA CONTA REAL

Número máximo de sinais:
A DEFINIR — BLOQUEIA CONTA REAL

Ativo permitido:
A DEFINIR — BLOQUEIA CONTA REAL

Horário permitido:
A DEFINIR — BLOQUEIA CONTA REAL

Responsável pela aprovação:
A DEFINIR — BLOQUEIA CONTA REAL
```

---

## 8. Critérios para liberar revisão final de risco

Só pode ir para revisão final se:

- revisão jurídica concluída;
- revisão operacional concluída;
- revisão técnica concluída;
- limites numéricos definidos;
- participante identificado;
- conta identificada;
- termo aceito;
- checklist individual preenchido;
- rollback confirmado;
- responsável definido;
- dispatch automático confirmado como desativado.

---

## 9. Critérios de bloqueio

Bloquear se:

- revisão jurídica pendente;
- limites indefinidos;
- termo não aceito;
- conta não identificada;
- participante não identificado;
- conta com posição/ordem desconhecida;
- dispatch automático ativo;
- ausência de responsável ao vivo;
- rollback não testado;
- tracking inconsistente;
- EA sem logs;
- secret exposto;
- tentativa de múltiplos sinais;
- tentativa de múltiplos clientes;
- tentativa de operar perfil agressivo.

---

## 10. Status do plano

**Status inicial:** `PENDING_REVIEWS`

Status possíveis:

- `PENDING_REVIEWS`
- `READY_FOR_RISK_COMMITTEE_REVIEW`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

`READY_FOR_RISK_COMMITTEE_REVIEW` ainda **NÃO** libera conta real. Apenas indica que os documentos estão prontos para uma decisão final futura.

---

## 11. Próxima ação recomendada

Revisar os documentos com jurídico/operacional, definir limites numéricos e preencher o checklist individual somente se houver intenção real de avançar.

---

*Mercado da Riqueza AutoTrade — plano de revisão jurídica e operacional para conta real. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
