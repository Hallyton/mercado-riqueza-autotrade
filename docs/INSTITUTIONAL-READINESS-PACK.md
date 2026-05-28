# Institutional Readiness Pack — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 10.1 — Institutional Readiness Pack  
**Branch de referência:** `staging-vps-homologacao`  
**RC:** [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) — `RELEASE_CANDIDATE_DEMO_STAGING_READY`

**Escopo:** pacote institucional documental para reuniões com corretoras, parceiros técnicos, jurídico, investidores e stakeholders comerciais — **apenas DEMO/STAGING**. Sem alteração de código, contratos da RC, env ou deploy.

---

## 1. Objetivo

Consolidar o **pacote institucional** do Mercado da Riqueza AutoTrade para apresentação a:

- Corretoras  
- Parceiros técnicos  
- Jurídico  
- Investidores  
- Stakeholders comerciais  

Com escopo **restrito** a DEMO/STAGING e decisão explícita de que **conta real não está aprovada**.

---

## 2. Status atual do projeto

| Campo | Valor |
|-------|--------|
| **Status** | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |

### Bloqueios obrigatórios

- Conta real **bloqueada**  
- Produção real **bloqueada**  
- Dinheiro real **bloqueado**  
- Dispatch automático **desativado**

**Ambiente de referência:** `https://autotrade-staging.mercadodariqueza.com.br` — conta `52609973 @ XPMT5-DEMO`.

---

## 3. Documentos principais do pacote

| Documento | Resumo |
|-----------|--------|
| [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) | Relatório final da RC DEMO/STAGING; decisão executiva; evidências; uso permitido/proibido. |
| [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md) | Baseline congelada (9.1); componentes e alterações permitidas/proibidas pós-freeze. |
| [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) | Nomenclaturas, disclaimers, mensagens aprovadas/proibidas, badges, linguagem parceiro/beta. |
| [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) | Certificação formal do ambiente demo (`DEMO_ENVIRONMENT_CERTIFIED`). |
| [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md) | Jornada do cliente beta DEMO (onboarding → tracking → encerramento). |
| [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) | Relatório executivo do estado técnico, operacional e de risco do projeto. |
| [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) | Slides/estrutura de apresentação para corretora, jurídico, parceiro ou investidor. |
| [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) | Roteiro e pontos-chave para reunião com parceiro. |
| [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md) | Modelo de convite executivo para reunião institucional. |
| [`AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md) | Mensagem curta de outreach (e-mail/LinkedIn) com disclaimers. |
| [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) | Índice de governança para **futura** discussão de conta real — **não** libera real. |
| [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) | Mapa de fases, status e restrições do programa EA Mãe / RC. |

**Documentos técnicos de apoio (referência):** [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md), [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md), [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md).

---

## 4. Mensagem institucional central

> O Mercado da Riqueza AutoTrade encontra-se em **Release Candidate DEMO/STAGING**, com ambiente demo certificado, fluxo de cliente beta definido, **Real Trading Guard** ativo, **dispatch manual**, tracking consolidado, runbook operacional e governança documentada. **Conta real**, **dinheiro real**, **produção real** e **dispatch automático** permanecem **bloqueados**.

---

## 5. Uso permitido do pacote

- Reuniões com **corretoras**  
- Reuniões com **parceiros técnicos**  
- Reunião **jurídica** (preparação, não contrato final)  
- **Apresentação institucional**  
- Validação **comercial** sem dinheiro real  
- **Onboarding DEMO** / beta controlado  
- **Demonstração** do ambiente RC em staging  

Sempre com disclaimers de [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).

---

## 6. Uso proibido do pacote

- Vender ou apresentar como **produção real** liberada  
- **Prometer rentabilidade** ou performance garantida  
- Sugerir **conta real liberada** ou “pronta para operar”  
- Sugerir **copy trade público** ou sinais garantidos  
- Usar como **contrato jurídico final** sem revisão legal dedicada  
- Usar para **captação** sem disclaimers DEMO/STAGING e de risco  
- **Liberar operação real** ou dinheiro real com base apenas neste pacote  

---

## 7. Materiais recomendados para reunião

Ordem sugerida de leitura/apresentação:

| # | Material |
|---|----------|
| 1 | [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) |
| 2 | [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) |
| 3 | [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) |
| 4 | [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) |
| 5 | [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md) |
| 6 | [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) *(somente se o tema futuro de conta real for discutido — reforçar bloqueio atual)* |
| 7 | [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) |
| 8 | [`AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md) / [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md) |

---

## 8. Perguntas para corretora / parceiro

Use em reuniões técnicas e de compliance (respostas a documentar; **não** implicam liberação real):

1. Quais **requisitos técnicos** para automação MT5 na corretora?  
2. Quais **restrições** para EAs em conta cliente?  
3. Quais exigências de **suitability** e perfil do investidor?  
4. Quais **disclaimers** obrigatórios em materiais e termos?  
5. Quais **limites mínimos** de risco ou exposição exigidos?  
6. Quais **logs/auditorias** a corretora exige do parceiro de automação?  
7. Existe **integração oficial** ou processo de **homologação** de terceiros?  
8. Quais regras para **copy trading** / distribuição de sinais?  
9. Quais **controles** são necessários antes de qualquer operação com **dinheiro real**?

---

## 9. Perguntas para jurídico

1. **Enquadramento regulatório** do modelo (SaaS + EA executor + sinais mestre).  
2. **Termos de uso** e política de privacidade para beta DEMO vs. futuro real.  
3. **Responsabilidade operacional** (plataforma, corretora, cliente).  
4. **Suitability** e adequação de perfil.  
5. Risco de **promessa de resultado** em marketing e apresentações.  
6. **Disclaimers** obrigatórios (rentabilidade passada, risco de capital).  
7. **LGPD** e tratamento de dados operacionais (logs, device, conta MT5).  
8. **Uso de conta cliente** e consentimento para automação.  
9. **Responsabilidade** por execução automatizada e falhas técnicas.

---

## 10. Pendências antes de qualquer conta real

- Revisão **jurídica** formal  
- **Limites financeiros** definidos  
- **Checklist individual** de conta real preenchido  
- **Suplente operacional** definido  
- **Gate real** específico aprovado ([`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md))  
- **Autorização formal** da governança (produto/compliance)  
- **Política de incidentes** operacionais  
- **Análise regulatória** concluída  
- **Validação corretora/parceiro** documentada  
- **Real Trading Guard** com allowlist **somente** se aprovado em gate futuro explícito  

Nenhum item acima está concluído para liberação de conta real nesta fase.

---

## 11. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `INSTITUTIONAL_READINESS_PACK_READY` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **RC** | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

**Próxima etapa sugerida:** Fase 10.2 — Legal & Commercial Review Preparation.

---

*Mercado da Riqueza AutoTrade — Institutional Readiness Pack (Fase 10.1). Documentação apenas. Conta real, produção real e dispatch automático permanecem bloqueados.*
