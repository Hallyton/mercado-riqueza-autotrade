# Partner Meeting Package Finalization — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este pacote é destinado a **reuniões institucionais e de alinhamento**.
>
> - **Não** é contrato jurídico final.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** autoriza uso com dinheiro real.  
> - **Não** promete rentabilidade.

**Data:** 2026-05-27  
**Fase:** 10.5 — Partner Meeting Package Finalization  
**Status:** `PARTNER_MEETING_PACKAGE_READY`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED`

Documentos de apoio: [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md), [`INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md`](INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md), [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md), [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md), [`AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md).

**Escopo:** documentação apenas — sem PPTX, sem alteração de código ou contratos da RC.

---

## 1. Objetivo

Consolidar o **pacote final para reunião** com corretoras, parceiros técnicos, jurídico, investidores e stakeholders comerciais, usando o estado atual da **Release Candidate DEMO/STAGING**.

---

## 2. Status atual

| Status / decisão | Valor |
|------------------|--------|
| RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Pacote institucional | `INSTITUTIONAL_READINESS_PACK_READY` |
| Deck (roteiro) | `INSTITUTIONAL_DECK_OUTLINE_READY` |
| Revisão jurídica/comercial (prep) | `LEGAL_COMMERCIAL_REVIEW_PREPARED` |
| Termos beta | `DRAFT_FOR_LEGAL_REVIEW` |
| Decisão operacional | `REAL_ACCOUNT_NOT_APPROVED` |

**Bloqueios:** conta real, produção real, dinheiro real e dispatch automático **bloqueados/desativados**.

---

## 3. Mensagem central da reunião

> O Mercado da Riqueza AutoTrade está em **Release Candidate DEMO/STAGING**, com ambiente demo certificado, fluxo beta definido, **Real Trading Guard** ativo, **dispatch manual**, tracking consolidado, runbook operacional, hardening VPS/MT5 e governança documentada. O objetivo da reunião é **validar requisitos** técnicos, jurídicos, operacionais e comerciais para próximos passos. **Conta real**, **dinheiro real**, **produção real** e **dispatch automático** permanecem **bloqueados**.

---

## 4. Público-alvo

- **Corretoras**  
- **Parceiros técnicos**  
- **Jurídico / regulatório**  
- **Investidores**  
- **Assessores**  
- **Stakeholders comerciais**  

---

## 5. Documentos do pacote de reunião

Ordem sugerida de envio ou consulta:

| # | Documento |
|---|-----------|
| 1 | [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) |
| 2 | [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) |
| 3 | [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md) |
| 4 | [`INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md`](INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md) |
| 5 | [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) |
| 6 | [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md) |
| 7 | [`LEGAL-COMMERCIAL-REVIEW-PREPARATION.md`](LEGAL-COMMERCIAL-REVIEW-PREPARATION.md) |
| 8 | [`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md) *(minuta — não contrato final)* |
| 9 | [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) *(futuro real — reforçar bloqueio atual)* |
| 10 | [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) |

**Materiais complementares (convite/outreach):** [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md), [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md), [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md), [`AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md).

---

## 6. Ordem sugerida da reunião (pauta)

1. **Contexto** do Mercado da Riqueza AutoTrade.  
2. **Estado atual** do RC DEMO/STAGING.  
3. **Demonstração conceitual** do fluxo MasterSignal (sem secrets).  
4. **Certificação** DEMO/STAGING.  
5. **Real Trading Guard** e bloqueio de conta real.  
6. **Runbook**, tracking e rollback.  
7. **Pontos jurídicos e comerciais** (preparação, não aprovação final).  
8. **Perguntas** para corretora/parceiro (§8).  
9. **Próximos passos** possíveis (sem liberar real).  
10. **Encerramento** com bloqueios reforçados (§12).  

---

## 7. Tempo sugerido (agenda 45 minutos)

| Bloco | Duração | Conteúdo |
|-------|--------|----------|
| Introdução | 5 min | Participantes, objetivo, disclaimers |
| Visão do produto | 10 min | RC, mensagem central, badges |
| Arquitetura / fluxo DEMO | 10 min | MasterSignal → dispatch → tracking |
| Governança, riscos e bloqueios | 10 min | Guard, runbook, pendências real |
| Perguntas | 5 min | Corretora / jurídico conforme público |
| Próximos passos | 5 min | Ações, documentos, **sem** liberar real |

---

## 8. Perguntas-chave para corretora / parceiro

1. Há **requisitos** para uso de EA em MT5?  
2. Há processo de **homologação técnica**?  
3. Há **restrição** para automação em conta cliente?  
4. Há regras sobre **sinais / copy trading**?  
5. Há necessidade de **suitability**?  
6. Há exigência de **logs / auditoria**?  
7. Há regras específicas para **WDO / mini dólar**?  
8. Há **APIs oficiais** recomendadas?  
9. Há **limites operacionais** mínimos?  
10. Quais **disclaimers** são obrigatórios na corretora?  

*(Registrar respostas em ata — Fase 10.6 sugerida.)*

---

## 9. Perguntas-chave para jurídico

1. **Enquadramento regulatório** do projeto.  
2. **Termos de uso** e política de privacidade.  
3. **Responsabilidade** por falha de execução.  
4. **Suitability**.  
5. **LGPD** e dados operacionais.  
6. **Disclaimers** em materiais e reuniões.  
7. **Comunicação comercial** permitida.  
8. **Limites financeiros** (futuro).  
9. **Política de incidentes**.  
10. Requisitos para **beta DEMO** ([`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md)).  
11. Requisitos para **eventual conta real** futura (gate).  

---

## 10. Demonstração permitida

- **Dashboard admin** (staging) — sem secrets na tela  
- Status **DEMO/STAGING** e badges institucionais  
- **Real Trading Guard** (read-only / política visível)  
- **MasterSignal** tracking (ex.: sessões de referência redigidas)  
- **Demo client flow** (conceitual)  
- Documentos de **governança** (índice, não logs brutos)  
- **Evidências textuais** (MasterSignalIds de referência)  
- **Fluxo conceitual** (diagrama do deck §5)  

---

## 11. Demonstração proibida

- **Secret**, token, senha, activation code, `device_token`  
- **Logs brutos** ou prints com dados sensíveis  
- **Conta real** ou vínculo real  
- **Execução real** / ordem com dinheiro real  
- **Promessa de lucro** ou performance  
- **Alteração de env** ou configuração de produção  
- **Ativação** de dispatch automático  
- **Allowlist** Real Trading Guard sem gate aprovado  

---

## 12. Disclaimers obrigatórios na reunião

Ler ou incluir no convite/ata:

- Ambiente **DEMO/STAGING**.  
- **Conta real bloqueada.**  
- **Produção real bloqueada.**  
- **Dinheiro real bloqueado.**  
- **Dispatch automático desativado.**  
- **Não há promessa de rentabilidade.**  
- **Não constitui recomendação de investimento.**  
- Qualquer **conta real** exige **novo gate** jurídico, técnico, operacional e financeiro.  

---

## 13. Resultado esperado da reunião

### Objetivos (sim)

- Lista de **requisitos** (técnico, compliance, corretora).  
- **Feedback** jurídico/comercial preliminar.  
- Requisitos da **corretora/parceiro** documentados.  
- Próximos **documentos** necessários identificados.  
- Ajustes de **comunicação** institucional, se aplicável.  
- **Decisão** sobre seguir ou não para planejamento de **novo gate** (sem executar real nesta fase).  

### Não é objetivo (não)

- Aprovar **conta real**.  
- Captar **cliente real**.  
- Liberar **produção**.  
- Ativar **dispatch automático**.  
- Vender **promessa de resultado**.  

---

## 14. Checklist pré-reunião

- [ ] Documentos do pacote (§5) **revisados**  
- [ ] **Disclaimers** conferidos (§12)  
- [ ] Ambiente **DEMO** acessível (staging)  
- [ ] **Nenhum secret** visível em telas compartilhadas  
- [ ] Dashboard **limpo** (sem tokens/credenciais)  
- [ ] Narrativa alinhada ao deck (§3)  
- [ ] **Perguntas** preparadas (§8–9)  
- [ ] Reunião **anotada** / gravada se autorizado e conforme LGPD  
- [ ] **Próximos passos** template preparado (Fase 10.6)  
- [ ] Convite/outreach com [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md) ou outreach  

---

## 15. Checklist pós-reunião

- [ ] Registrar **participantes** e data  
- [ ] Registrar **perguntas** e respostas  
- [ ] Registrar **exigências** da corretora/parceiro  
- [ ] Registrar **riscos** identificados  
- [ ] Registrar **decisões** (sem liberar real)  
- [ ] Registrar **documentos** solicitados  
- [ ] **Atualizar** plano mestre / follow-up (Fase 10.6)  
- [ ] Manter **conta real bloqueada**  
- [ ] Não commitar atas com secrets ou dados pessoais desnecessários  

---

## 16. Status da Fase 10.5

| Campo | Valor |
|-------|--------|
| **Status** | `PARTNER_MEETING_PACKAGE_READY` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |

---

## 17. Próxima etapa sugerida

- **Fase 10.6** — Meeting Follow-up Template & Decision Log, **ou**  
- **Fase 10.6** — Institutional Deck Visual Draft  

Ambas preservam bloqueios de conta real, produção real e dispatch automático.

---

*Mercado da Riqueza AutoTrade — pacote de reunião com parceiros finalizado (Fase 10.5). Não é contrato final. Conta real, produção real e dispatch automático permanecem bloqueados.*
