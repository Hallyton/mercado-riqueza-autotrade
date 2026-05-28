# Institutional Presentation Deck Preparation — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este documento é um **roteiro textual** para futura apresentação institucional.
>
> - **Não** é uma apresentação final (sem PPTX nesta fase).  
> - **Não** é material jurídico aprovado.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** autoriza uso com dinheiro real.

**Data:** 2026-05-27  
**Fase:** 10.4 — Institutional Presentation Deck Preparation  
**Status:** `INSTITUTIONAL_DECK_OUTLINE_READY`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED`

Documentos base: [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md), [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md), [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).

---

## 1. Objetivo

Preparar a **estrutura narrativa** (roteiro de slides) da apresentação institucional do Mercado da Riqueza AutoTrade para corretoras, parceiros técnicos, jurídico, investidores e stakeholders comerciais, com escopo **restrito** ao ambiente **DEMO/STAGING**.

---

## 2. Público-alvo da apresentação

- **Corretoras**  
- **Parceiros técnicos**  
- **Jurídico / regulatório**  
- **Investidores**  
- **Clientes beta DEMO** (versão adaptada, com termos em [`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md))  
- **Stakeholders comerciais**  

---

## 3. Mensagem central

> O Mercado da Riqueza AutoTrade encontra-se em **Release Candidate DEMO/STAGING**, com ambiente demo certificado, fluxo beta definido, **Real Trading Guard** ativo, **dispatch manual**, tracking consolidado, runbook operacional, hardening VPS/MT5 e governança documentada. **Conta real**, **dinheiro real**, **produção real** e **dispatch automático** permanecem **bloqueados**.

---

## 4. Tom da apresentação

- **Institucional**  
- **Técnico-controlado**  
- **Conservador**  
- **Sem** promessa de rentabilidade  
- **Sem** apelo especulativo  
- Foco em **segurança**, **auditoria**, **governança** e **operação controlada**  

Identidade visual (quando houver deck gráfico): preto + dourado, marca touro/escudo — ver `AGENTS.md` e [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).

---

## 5. Estrutura sugerida dos slides

### Slide 1 — Capa

| Elemento | Conteúdo |
|----------|----------|
| **Título** | Mercado da Riqueza AutoTrade |
| **Subtítulo** | Release Candidate DEMO/STAGING — Automação controlada com governança operacional |
| **Badges** | `DEMO/STAGING VALIDATED` · `REAL ACCOUNT BLOCKED` · `MANUAL DISPATCH ONLY` · `REAL TRADING GUARD ACTIVE` |

---

### Slide 2 — Contexto do projeto

Plataforma de **automação controlada** via MetaTrader 5:

- Fluxo de **sinais mestre** (EA Mãe / origem autorizada)  
- **Validação** no backend  
- **Revisão administrativa** antes do envio  
- **Dispatch manual** (sem automático na RC)  
- **Execução** via EA cliente (executor licenciado, caixa preta)  
- **Tracking consolidado** para auditoria operacional  

---

### Slide 3 — Problema que o projeto resolve

- Falta de **governança** em robôs isolados no terminal do cliente  
- Dificuldade de **rastrear** sinais e execuções de ponta a ponta  
- Risco de **disparo indevido** sem revisão central  
- Ausência de **rollback** e procedimentos documentados  
- Ausência de **trilha operacional** auditável  
- Necessidade de **controle explícito** antes de qualquer conta real  

---

### Slide 4 — Solução proposta

| Componente | Função |
|------------|--------|
| **MasterSignal** | Registro e validação do sinal mestre |
| **Admin review** | Elegibilidade, perfil, guard |
| **Dispatch manual** | Disparo consciente por operador autorizado |
| **EA cliente** | Execução monitorada no MT5 |
| **Execution report** | Confirmação operacional |
| **Tracking** | Visão consolidada `EXECUTED` / estados |
| **Real Trading Guard** | Bloqueio REAL por padrão |
| **Runbook** | Operação diária documentada |

---

### Slide 5 — Arquitetura operacional resumida

```text
EA Mãe / Simulador
  → Backend (POST /api/master/signals)
  → Admin Preview
  → Dispatch Manual
  → Instruction MASTER_SIGNAL
  → EA Cliente
  → Execution Report
  → Tracking
```

---

### Slide 6 — Ambiente certificado

| Parâmetro | Valor |
|-----------|--------|
| **Conta** | `52609973 @ XPMT5-DEMO` |
| **`tradeMode`** | `DEMO` |
| **`DebugMode`** | `true` |
| **Dispatch** | Manual |
| **Real Trading Guard** | Ativo |
| **Dispatch automático** | Desativado |

Referência: [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md).

---

### Slide 7 — Evidências operacionais

| MasterSignalId | Resultado |
|----------------|-----------|
| `real-guard-demo-smoke-002` | Tracking `EXECUTED` |
| `runbook-demo-session-001` | Tracking `EXECUTED` |
| `autotrading-policy-demo-001` | Tracking `EXECUTED` |

**Consolidado:** `1 / 1 / 1` · **Sem conta real** · **Sem ordem real**

---

### Slide 8 — Real Trading Guard

- Conta **REAL** bloqueada **por padrão**  
- `ENABLE_REAL_TRADING` **não** configurado  
- Allowlist conta real **não** configurada  
- Tela admin **read-only** para política de real  
- **DEMO** continua funcionando quando elegível  
- **REAL** exige **gate futuro** explícito  

Referência: [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md).

---

### Slide 9 — Governança operacional

- Runbook operacional validado  
- Política de **AutoTrading controlado**  
- **Rollback** documentado  
- **Redaction** e logs sem secrets no Git  
- **Auditoria** de estados de ordem/instrução  
- **Dispatch manual** apenas  
- Operadores definidos (**HALLYTON**; suplente pendente)  

---

### Slide 10 — Auditoria técnica pré-conta real

Trilha documentada (Fase 7): auth/admin, APIs EA, MasterSignal, idempotência, tracking, redaction, rollback, Prisma, EA Cliente/EA Mãe, integração VPS/MT5.

**Status:** encerrada com restrições — **não** libera conta real.

Referência: [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md).

---

### Slide 11 — Hardening VPS/MT5

- Ambiente MT5 / WebRequest documentado  
- **AutoTrading** controlado (sessão 8.8)  
- `device_token` e secrets tratados como **sensíveis**  
- Evidências visuais **dispensadas por sigilo** (Fase 8.7)  
- Hardening **`VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS`**

Referência: [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md).

---

### Slide 12 — Demo Client Flow

Jornada beta DEMO:

Cliente DEMO → licença → EA → heartbeat → MasterSignal → dispatch manual → instruction → execution report → tracking **`EXECUTED`**

Referência: [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md).

---

### Slide 13 — Uso permitido

- Demonstrações **institucionais**  
- Apresentações para **corretoras**  
- **Parceiros** técnicos  
- **Investidores** (com disclaimers)  
- **Onboarding DEMO**  
- **Homologações** DEMO/STAGING  

---

### Slide 14 — Uso proibido

- Conta **real**  
- Dinheiro **real**  
- Produção **real**  
- Dispatch **automático**  
- Promessa de **rentabilidade**  
- Múltiplos clientes **reais**  
- **Copy trade público**  
- Operação comercial **ampla**  

---

### Slide 15 — Pendências antes de conta real

- Revisão **jurídica**  
- **Limites financeiros**  
- **Checklist individual** de conta real  
- **Suplente** operacional  
- **Gate real** específico  
- **Autorização formal**  
- Validação **corretora/parceiro**  
- **Suitability**, se aplicável  

Índice: [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md).

---

### Slide 16 — Próximos passos

1. Revisão **jurídica** (minuta beta + disclaimers)  
2. Reunião com **corretora/parceiro**  
3. Preparação do **termo beta DEMO** (após aprovação jurídica)  
4. **Versão visual** da apresentação (PPTX — fase futura)  
5. **Página institucional**  
6. **Onboarding beta DEMO**  
7. Manter **conta real bloqueada**  

---

### Slide 17 — Encerramento

**Mensagem de fechamento:**

> Ambiente **DEMO/STAGING** validado. **Governança** documentada. **Conta real bloqueada** por padrão.

Incluir slide ou rodapé com **disclaimers** (§6).

---

## 6. Disclaimers obrigatórios no deck

Incluir no rodapé ou slide dedicado (revisão jurídica pendente):

1. Este material refere-se **exclusivamente** ao ambiente **DEMO/STAGING**.  
2. **Conta real não está liberada.**  
3. **Produção real não está liberada.**  
4. **Dinheiro real permanece bloqueado.**  
5. **Dispatch automático está desativado.**  
6. **Não há promessa de rentabilidade.**  
7. **Não constitui recomendação de investimento.**  
8. Resultados em **DEMO não representam** garantia de resultado futuro.  
9. Qualquer uso com **dinheiro real** depende de **novo gate** jurídico, operacional, técnico e financeiro.  

---

## 7. Elementos visuais recomendados

*(Para fase visual futura — não produzidos nesta fase.)*

- Logo **Mercado da Riqueza** (touro/escudo oficial)  
- Paleta **preto / dourado**  
- **Badges** institucionais (§ Slide 1)  
- **Fluxograma** MasterSignal → tracking  
- **Timeline** das fases 6.x–10.x (resumida)  
- **Cards** de status (`EXECUTED`, bloqueios)  
- Quadro **permitido / proibido**  
- Quadro de **bloqueios** (real, produção, dispatch automático)  
- Quadro de **evidências** (3 MasterSignalIds)  

---

## 8. Materiais que podem apoiar a apresentação

| Documento | Uso na reunião |
|-----------|----------------|
| [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md) | Visão RC consolidada |
| [`INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md) | Índice do pacote |
| [`DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md) | Certificação demo |
| [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md) | Jornada beta |
| [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md) | Guard |
| [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md) | Auditoria |
| [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md) | Hardening |
| [`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md) | Minuta beta (jurídico) |
| [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) | Roteiro de reunião |

---

## 9. Mensagens proibidas no deck

**Não usar:**

- lucro garantido  
- renda garantida  
- robô infalível  
- operação sem risco  
- conta real liberada  
- produção real pronta  
- copy trade público  
- ganhos automáticos  
- performance garantida  

---

## 10. Status da Fase 10.4

| Campo | Valor |
|-------|--------|
| **Status** | `INSTITUTIONAL_DECK_OUTLINE_READY` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Entregável** | Roteiro textual (17 slides) — **sem** PPTX |

---

## 11. Próxima etapa sugerida

- **Fase 10.5** — Institutional Deck Visual Draft, **ou**  
- **Fase 10.5** — Partner Meeting Package Finalization  

Ambas mantêm escopo DEMO/STAGING e bloqueios de conta real.

---

*Mercado da Riqueza AutoTrade — roteiro de apresentação institucional (Fase 10.4). Não é apresentação final nem material jurídico aprovado. Conta real, produção real e dispatch automático permanecem bloqueados.*
