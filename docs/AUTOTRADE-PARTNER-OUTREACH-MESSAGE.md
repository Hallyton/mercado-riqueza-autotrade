# Mensagens de Abordagem — Mercado da Riqueza AutoTrade

Documento da **Fase 5.11** para criar modelos prontos de comunicação para abordar corretora, jurídico, parceiro técnico ou investidor sobre o Mercado da Riqueza AutoTrade.

As mensagens devem ser profissionais, objetivas e conservadoras. Elas **NÃO** liberam conta real, produção real, dinheiro real ou dispatch automático.

---

## 1. Contexto

O projeto Mercado da Riqueza AutoTrade já possui validações em staging/demo e documentação de governança, mas ainda está em fase de alinhamento com parceiros antes de qualquer conta real.

As mensagens abaixo devem deixar claro que:

- conta real não está liberada;
- produção real não está liberada;
- dinheiro real não está liberado;
- dispatch automático não está ativado;
- o objetivo é reunião técnica/jurídica/operacional;
- não há promessa de rentabilidade;
- qualquer avanço futuro exige revisão e aprovação específica.

---

## 2. Mensagem curta para WhatsApp

```text
Olá, [Nome]. Tudo bem?

Estou entrando em contato para apresentar o Mercado da Riqueza AutoTrade, um projeto de automação controlada via MetaTrader 5, com sinais mestre, dispatch manual, EA cliente e tracking em painel.

Já realizamos validações em staging/demo, inclusive com conta demo em DebugMode=false. Conta real, produção real e dinheiro real ainda não estão liberados.

Gostaria de agendar uma conversa para alinhamento técnico/operacional e entender os requisitos da [corretora/parceiro]. Você teria disponibilidade nos próximos dias?
```

---

## 3. Mensagem para LinkedIn

```text
Olá, [Nome].

Gostaria de apresentar o Mercado da Riqueza AutoTrade, uma plataforma de automação controlada para sinais mestre e execução via MetaTrader 5, com governança operacional, dispatch manual e rastreabilidade.

O projeto já foi validado em ambiente staging/demo, incluindo fluxo completo de sinal, execução em conta demo e tracking no painel. Ainda não há liberação para conta real, produção real ou dispatch automático.

Meu objetivo é marcar uma conversa institucional para alinharmos requisitos técnicos, jurídicos e operacionais antes de qualquer avanço futuro.

Podemos agendar uma reunião?
```

---

## 4. E-mail formal para corretora

**Assunto:** Mercado da Riqueza AutoTrade — Apresentação técnica e alinhamento operacional

```text
Olá, [Nome].

Tudo bem?

Gostaria de apresentar o Mercado da Riqueza AutoTrade, uma plataforma de automação controlada para sinais mestre e execução via MetaTrader, com governança operacional, dispatch manual e rastreabilidade por painel.

O projeto já passou por validações em ambiente staging/demo, incluindo:
- intake de MasterSignal;
- idempotência;
- revisão admin;
- dispatch manual;
- EA cliente recebendo instruction;
- execution report;
- tracking no painel;
- execução em conta demo com DebugMode=false.

Importante: conta real, produção real, dinheiro real e dispatch automático ainda não estão liberados. Não há promessa de rentabilidade. Qualquer avanço com dinheiro real exigirá nova etapa de revisão e aprovação específica.

Gostaríamos de agendar uma reunião para apresentar o fluxo validado, as evidências disponíveis e entender os requisitos técnicos e operacionais da corretora.

Tópicos sugeridos:
- visão geral do AutoTrade;
- fluxo técnico validado;
- requisitos de automação via MetaTrader 5;
- limites operacionais;
- auditoria de ordens;
- rollback e emergência operacional;
- próximos passos possíveis.

Temos documentos de apoio disponíveis para envio antes ou após a reunião.

Atenciosamente,
[Nome]
Mercado da Riqueza
```

---

## 5. E-mail para jurídico/parceiro regulatório

```text
Olá, [Nome].

Gostaria de solicitar uma reunião para avaliação jurídica e regulatória do Mercado da Riqueza AutoTrade, uma plataforma de automação controlada para sinais mestre e execução via MetaTrader.

O projeto já possui validações técnicas em staging/demo e uma documentação inicial de governança para eventual discussão futura de conta real. Neste momento, conta real, produção real, dinheiro real e dispatch automático não estão liberados.

O objetivo da conversa é revisar:
- riscos de mercado;
- riscos tecnológicos;
- ausência de promessa de rentabilidade;
- termo de aceite;
- responsabilidades do participante;
- responsabilidades operacionais internas;
- estratégia caixa preta;
- autorização limitada;
- critérios de pausa/cancelamento;
- requisitos antes de qualquer uso real.

Qualquer avanço com dinheiro real dependerá de revisão jurídica, operacional e técnica, além de aprovação específica separada.

Podemos agendar uma conversa para análise inicial?

Atenciosamente,
[Nome]
Mercado da Riqueza
```

---

## 6. E-mail para parceiro técnico

```text
Olá, [Nome].

Gostaria de apresentar o Mercado da Riqueza AutoTrade para uma avaliação técnica independente.

O fluxo validado segue o modelo:

EA Mãe / simulador
→ backend
→ revisão admin
→ dispatch manual
→ EA cliente
→ execution report
→ tracking no painel

Já validamos intake de MasterSignal, idempotência, elegibilidade por licença/perfil, dispatch manual, execution report, tracking, rollback operacional e execução em conta demo com DebugMode=false.

Conta real, produção real, dinheiro real e dispatch automático ainda não estão liberados. Não há promessa de rentabilidade. O objetivo é revisar arquitetura, logs, rastreabilidade, rollback, idempotência, riscos de duplicidade e pontos de observabilidade antes de qualquer discussão futura sobre uso real.

Podemos agendar uma reunião técnica?

Atenciosamente,
[Nome]
Mercado da Riqueza
```

---

## 7. Mensagem de follow-up pós-reunião

```text
Olá, [Nome].

Obrigado pela reunião sobre o Mercado da Riqueza AutoTrade.

Conforme alinhado, o projeto permanece validado em staging/demo, sem liberação de conta real, produção real, dinheiro real ou dispatch automático.

Próximos passos sugeridos:
- revisar os documentos enviados;
- consolidar dúvidas técnicas/jurídicas/operacionais;
- definir eventuais requisitos adicionais;
- avaliar se faz sentido avançar para uma próxima rodada documental.

Reforço que qualquer avanço com dinheiro real exigirá revisão e aprovação específica separada.

Fico à disposição.

Atenciosamente,
[Nome]
Mercado da Riqueza
```

---

## 8. Lista de anexos/documentos sugeridos

- [`docs/AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md)
- [`docs/AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md)
- [`docs/PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md)
- [`docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md)
- [`docs/REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md)
- [`docs/MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md)

---

## 9. Frases obrigatórias de cautela

Opções de frases para usar nas comunicações:

- “Conta real ainda não está liberada.”
- “O objetivo da reunião é alinhamento técnico, jurídico e operacional.”
- “O projeto foi validado em staging/demo, sem liberação de produção real.”
- “Não há promessa de rentabilidade.”
- “Qualquer avanço com dinheiro real exige nova etapa de aprovação.”

---

## 10. Status do documento

**Status:** `OUTREACH_MESSAGES_READY`

---

*Mercado da Riqueza AutoTrade — mensagens de abordagem para parceiros. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
