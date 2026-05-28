# Legal & Commercial Review Preparation — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 10.2 — Legal & Commercial Review Preparation  
**Branch de referência:** `staging-vps-homologacao`

**Natureza:** documento de **preparação** para revisão jurídica, comercial e regulatória preliminar — **não** é contrato final, **não** libera conta real e **não** substitui parecer jurídico.

Documentos base: [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md), [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md), [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md).

**Escopo:** DEMO/STAGING apenas. Sem alteração de código, contratos da RC, env ou deploy.

---

## 1. Objetivo

Preparar a **base documental** para revisão **jurídica**, **comercial** e **regulatória** do Mercado da Riqueza AutoTrade, mantendo escopo restrito a **DEMO/STAGING** e **sem** liberar conta real, produção real ou dispatch automático.

---

## 2. Status atual

| Campo | Valor |
|-------|--------|
| **Status técnico** | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| **Status institucional** | `INSTITUTIONAL_READINESS_PACK_READY` |
| **Decisão operacional** | `REAL_ACCOUNT_NOT_APPROVED` |

### Bloqueios

- Conta real **bloqueada**  
- Produção real **bloqueada**  
- Dinheiro real **bloqueado**  
- Dispatch automático **desativado**

---

## 3. Escopo da revisão

A revisão (jurídico, comercial, compliance, parceiro) deve avaliar:

- Comunicação **institucional** e materiais de apresentação  
- **Disclaimers** e mensagens proibidas  
- Riscos de **promessa de rentabilidade**  
- **Suitability** e adequação de perfil  
- **Termo de aceite** / ciência de risco (beta DEMO e futuro real)  
- **Responsabilidades** (plataforma, operador, cliente, corretora)  
- **Limites financeiros** (indefinidos até decisão futura)  
- Uso de **conta cliente** MT5  
- Uso de **EA** em MetaTrader 5  
- Automação via **dispatch manual** (não automático)  
- **Copy trading** / distribuição de sinais  
- **LGPD** e dados operacionais  
- **Logs** e auditoria  
- **Política de incidentes**  
- Responsabilidade por **falhas operacionais** (VPS, MT5, rede, corretora)  
- Critérios para **eventual gate futuro** de conta real  

---

## 4. Fora de escopo

**Não está autorizado nesta fase:**

- Conta real  
- Dinheiro real  
- Produção real  
- Dispatch automático  
- Assinatura comercial **pública** em escala  
- Múltiplos clientes reais  
- Copy trade **público**  
- Promessa de rentabilidade  
- **Contrato jurídico final** (apenas preparação/minutas de referência)  
- Captação sem disclaimer DEMO/STAGING  
- Alteração de **risco operacional** ou guardrails técnicos sem gate  

---

## 5. Documentos para revisão jurídica

| Documento | Resumo para o revisor |
|-----------|----------------------|
| [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md) | Índice do pacote institucional; ordem de reunião; perguntas corretora/jurídico. |
| [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) | Status RC; evidências; uso permitido/proibido; restrições. |
| [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) | Nomenclaturas, disclaimers, mensagens aprovadas/proibidas, badges. |
| [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) | Certificação demo; o que está e não está certificado. |
| [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md) | Jornada beta DEMO; pré-requisitos; rollback; itens proibidos. |
| [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) | Índice para **futura** conta real — reforça bloqueio atual. |
| [`REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md) | **Minuta** operacional de aceite e limites — não contrato final. |
| [`REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md`](REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md) | Plano de revisão antes de qualquer real ultra-controlada. |
| [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) | Roteiro de reunião com parceiro. |
| [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) | Estrutura de apresentação institucional. |

---

## 6. Pontos jurídicos para validação

Checklist para parecer ou workshop jurídico (marcar após revisão formal):

| # | Ponto | Pendente / OK |
|---|--------|----------------|
| 1 | Material deixa claro ambiente **DEMO/STAGING**? | Pendente revisão |
| 2 | Material deixa claro **conta real não liberada**? | Pendente revisão |
| 3 | **Disclaimers** são suficientes para o uso pretendido? | Pendente revisão |
| 4 | Risco de interpretação como **promessa de rentabilidade**? | Pendente revisão |
| 5 | Risco de **consultoria**, **recomendação** ou **gestão** de carteira? | Pendente revisão |
| 6 | Necessidade de **suitability**? | Pendente revisão |
| 7 | Necessidade de **termo de ciência de risco**? | Pendente revisão |
| 8 | Necessidade de **contrato específico** por participante? | Pendente revisão |
| 9 | Necessidade de **autorização expressa** para uso de EA? | Pendente revisão |
| 10 | Regras sobre **falhas** (conexão, VPS, MT5, corretora)? | Pendente revisão |
| 11 | Necessidade de **política de incidentes** formal? | Pendente revisão |
| 12 | Necessidade de **logs mínimos** / trilha de auditoria? | Pendente revisão |
| 13 | Necessidade de **política LGPD** dedicada? | Pendente revisão |
| 14 | Restrições para **sinais** / copy trade? | Pendente revisão |
| 15 | Restrições impostas por **corretora** ou plataforma? | Pendente revisão |

---

## 7. Pontos comerciais para validação

| # | Ponto | Orientação atual (pré-revisão) |
|---|--------|-------------------------------|
| 1 | Posicionamento comercial **permitido** | Tecnologia de automação **controlada**; homologação DEMO; beta institucional |
| 2 | Apresentar como **tecnologia** | Sim — com disclaimers |
| 3 | Apresentar como **homologação** | Sim — ambiente certificado documentalmente |
| 4 | Oferecer como **beta DEMO** | Sim — sem dinheiro real |
| 5 | **Palavras a evitar** | Ver [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) §6 |
| 6 | Disclaimers em materiais comerciais | Obrigatórios — §11 deste documento |
| 7 | Materiais para **corretora/parceiro** | Pacote institucional + RC + certificação demo (sem secrets) |
| 8 | Materiais para **cliente beta DEMO** | Fluxo demo + mensagem beta — sem promessa de resultado |
| 9 | O que **não** prometer | Rentabilidade, conta real pronta, produção liberada, copy público |
| 10 | Explicar **conta real bloqueada** | Real Trading Guard + `REAL_ACCOUNT_NOT_APPROVED` + gate futuro |

---

## 8. Pontos operacionais para validação

| # | Ponto | Estado atual (documentado) |
|---|--------|---------------------------|
| 1 | Quem pode operar? | **HALLYTON** — matriz Fase 8.6 |
| 2 | Quem pode fazer dispatch? | HALLYTON (admin autorizado) |
| 3 | Quem pode acionar rollback? | HALLYTON |
| 4 | Quem pode acessar VPS/MT5? | HALLYTON |
| 5 | Quem pode coletar logs? | HALLYTON — sem secrets no Git |
| 6 | Quem pode aprovar sessão? | HALLYTON |
| 7 | Suplente operacional? | **A DEFINIR** — pendência |
| 8 | Política de incidentes? | Runbook + pausar sessão — formalização jurídica pendente |
| 9 | Política de interrupção? | Halts + rollback documentados |
| 10 | Política de evidências? | Textual; prints fora do Git por sigilo |
| 11 | Política de retenção? | Pendente definição jurídica/LGPD |

---

## 9. Perguntas para corretora / parceiro

1. Há requisito **formal** para uso de EA em conta cliente?  
2. Existe **homologação técnica** necessária para terceiros?  
3. Há restrição para **automação** via MetaTrader 5?  
4. Há restrição para **sinais** enviados por plataforma externa?  
5. Há exigência de **suitability**?  
6. Há exigência de **logs** ou trilha de auditoria?  
7. Há **limites mínimos** recomendados (exposição, patrimônio)?  
8. Há exigência de **termo de aceite** específico?  
9. Há política para **robôs** / copy trade?  
10. Há **integração oficial** ou API recomendada?  
11. Há restrição sobre operação em **WDO** / mini dólar?

*(Respostas a registrar em ata de reunião — fora do Git se contiver dados sensíveis.)*

---

## 10. Perguntas para jurídico

1. Qual **enquadramento regulatório** do projeto (CVM, oferta, consultoria, SaaS)?  
2. O material atual precisa de **disclaimer adicional**?  
3. O termo operacional ([`REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md)) é suficiente como **minuta**?  
4. É necessário **contrato formal** para beta DEMO? Para futuro real?  
5. Quem assume responsabilidade por **falhas de execução**?  
6. Como tratar falha de **VPS/MT5/corretora**?  
7. Como tratar **LGPD** e dados operacionais (device, logs, conta)?  
8. Como tratar **logs** e **retenção**?  
9. Como **evitar promessa de resultado** em marketing?  
10. Quais **palavras comerciais** são proibidas ou de alto risco?  
11. O **beta DEMO** exige aceite formal assinado?

---

## 11. Disclaimers mínimos recomendados

Incluir em materiais institucionais, comerciais e beta (ajustar redação final com jurídico):

1. Este material refere-se **exclusivamente** ao ambiente **DEMO/STAGING**.  
2. **Conta real não está liberada.**  
3. **Produção real não está liberada.**  
4. **Dispatch automático está desativado.**  
5. **Não há promessa de rentabilidade.**  
6. **Não constitui recomendação de investimento.**  
7. Resultados em **DEMO não representam** garantia de resultado futuro.  
8. Qualquer eventual uso com **dinheiro real** depende de **novo gate** jurídico, operacional, técnico e financeiro.  
9. O uso com **dinheiro real permanece bloqueado.**

*(Alinhado a [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).)*

---

## 12. Riscos jurídicos/comerciais identificados

| Risco | Mitigação documental atual |
|-------|---------------------------|
| Interpretação como **promessa de lucro** | Mensagens proibidas + disclaimers |
| Interpretação como **recomendação** de investimento | Posicionamento tecnologia/controle; não gestão de carteira |
| Uso inadequado de material em **venda** | Uso proibido do pacote institucional |
| Ausência de **suitability** | Pendente definição jurídica |
| Ausência de **contrato final** | Apenas minutas; Fase 10.3 sugerida para termos beta |
| Ausência de **limites financeiros** | Gate futuro; não liberar real |
| Ausência de **suplente** operacional | Pendência operacional |
| Operação **real sem gate** | `REAL_ACCOUNT_NOT_APPROVED` + Real Trading Guard |
| Cliente interpretar **DEMO como resultado real** | Mensagem beta + disclaimers §11 |

---

## 13. Decisão da Fase 10.2

| Campo | Valor |
|-------|--------|
| **Status** | `LEGAL_COMMERCIAL_REVIEW_PREPARED` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |

**Significado:** checklists, perguntas, índice de documentos e disclaimers mínimos estão **preparados** para envio a jurídico/comercial. **Não** constitui aprovação jurídica nem liberação de conta real.

---

## 14. Próximas ações recomendadas

1. Enviar [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md) para **revisão jurídica**.  
2. Revisar **disclaimers** com jurídico (redação final).  
3. **Validar posicionamento** comercial.  
4. **Validar requisitos** com corretora/parceiro (perguntas §9).  
5. Preparar **slides** institucionais.  
6. Preparar **termo de ciência** para beta DEMO (Fase 10.3 sugerida).  
7. Manter **conta real bloqueada** até novo gate explícito.

**Próxima etapa documental sugerida:** Fase 10.3 — Beta DEMO Terms & Disclaimer Draft.

---

## 15. Fase 10.3 — Beta DEMO Terms & Disclaimer Draft

**Documento:** [`docs/BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md)

| Item | Situação |
|------|----------|
| Minuta criada | OK — termos, ciência de risco, disclaimers, aceite (campos a preencher) |
| Status | `DRAFT_FOR_LEGAL_REVIEW` |
| Contrato final | **Não** — depende de revisão jurídica |
| Conta real | **Não liberada** |
| Produção real | **Não liberada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Conclusão:** minuta beta DEMO disponível para envio ao jurídico. Uso em onboarding beta **somente** após aprovação formal da redação final.

---

*Mercado da Riqueza AutoTrade — preparação para revisão jurídica/comercial (Fase 10.2). Minuta de trabalho; não é contrato final. Conta real, produção real e dispatch automático permanecem bloqueados.*
