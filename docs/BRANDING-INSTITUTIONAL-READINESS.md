# Branding & Institutional Readiness — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 9.2 — Branding & Institutional Readiness  
**Branch de referência:** `staging-vps-homologacao`  
**RC:** [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md) — `RC_VERSION_LOCKED_FOR_DEMO_STAGING`

Documentos de referência: [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md), [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md), [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md), [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md), [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md), [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md), [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md).

**Escopo desta fase:** documentação institucional apenas — sem alteração de código, contratos técnicos da RC, env ou deploy.

---

## 1. Objetivo

Consolidar a **linguagem institucional**, **posicionamento**, **nomenclaturas**, **disclaimers** e **material-base** do Mercado da Riqueza AutoTrade para demonstrações em ambiente **DEMO/STAGING**, dirigidas a corretoras, parceiros, jurídico, investidores e clientes **beta DEMO**.

---

## 2. Identidade do produto

| Campo | Conteúdo |
|-------|----------|
| **Nome oficial** | Mercado da Riqueza AutoTrade |
| **Descrição curta** | Plataforma de automação controlada para sinais, revisão administrativa, dispatch manual, execução via EA cliente e rastreabilidade operacional em ambiente DEMO/STAGING. |
| **Descrição institucional** | O Mercado da Riqueza AutoTrade é uma plataforma de controle operacional para automação via MetaTrader 5, com fluxo de sinais mestre, validação backend, revisão admin, dispatch manual, execução pelo EA cliente, tracking consolidado, runbook operacional, rollback documentado e Real Trading Guard para bloqueio de conta real por padrão. |

**Identidade visual (referência de produto):** preto + dourado, tom premium institucional, marca touro/escudo — ver `AGENTS.md` e tokens do projeto. Aplicação visual no dashboard permanece pendência opcional (seção 14).

---

## 3. Nomenclaturas oficiais

| Termo | Uso |
|-------|-----|
| Mercado da Riqueza AutoTrade | Nome completo do produto |
| AutoTrade DEMO/STAGING | Ambiente de homologação e demonstração |
| EA Cliente | Executor licenciado no MT5 do cliente (não estratégico) |
| EA Mãe | Origem de sinais mestre (`MASTER_EA`) |
| MasterSignal | Sinal mestre registrado e validado no backend |
| Instruction `MASTER_SIGNAL` | Instrução despachada ao EA cliente |
| Dispatch manual admin | Disparo somente por operador autorizado no painel |
| Tracking consolidado | Visão auditável do fluxo (dispatches / instruções / execuções) |
| Real Trading Guard | Bloqueio técnico de conta `REAL` por padrão |
| Runbook operacional | Procedimento diário pré-real validado em demo |
| Conta DEMO | Conta de demonstração/homologação (ex.: `52609973 @ XPMT5-DEMO`) |
| Conta REAL bloqueada | Estado padrão — não aprovada para operação |
| Release Candidate DEMO/STAGING | Baseline congelada (Fase 9.1) |
| Ambiente institucional de demonstração | Sessões controladas para parceiros/investidores |

---

## 4. Posicionamento

- Produto em **RC DEMO/STAGING** (`RC_VERSION_LOCKED_FOR_DEMO_STAGING`).
- Plataforma **validada tecnicamente** em ambiente DEMO (auditoria pré-real, hardening VPS/MT5, sessões de referência com tracking `EXECUTED`).
- **Conta real ainda não aprovada** (`REAL_ACCOUNT_NOT_APPROVED`).
- Foco em **segurança**, **rastreabilidade**, **governança** e **controle operacional**.
- **Não** é promessa de rentabilidade.
- **Não** é liberação comercial ampla.
- **Não** é produção real.

---

## 5. Mensagens institucionais aprovadas

Frases curtas para slides, e-mails e briefings:

1. *Automação controlada com rastreabilidade operacional.*
2. *Dispatch manual, tracking consolidado e governança antes de qualquer conta real.*
3. *Ambiente DEMO/STAGING validado, conta real bloqueada por padrão.*
4. *Tecnologia com Real Trading Guard e runbook operacional.*
5. *Foco em controle, segurança e auditoria.*

---

## 6. Mensagens proibidas

**Não usar** em materiais institucionais, marketing ou comunicação com parceiros/clientes:

| Proibido |
|----------|
| “lucro garantido” |
| “renda garantida” |
| “robô infalível” |
| “operação sem risco” |
| “produção real liberada” |
| “conta real pronta” |
| “copy trade público” |
| “ganhos automáticos” |
| “sinal garantido” |
| “performance garantida” |

Qualquer menção a resultados passados deve ser qualificada e **nunca** apresentada como garantia futura.

---

## 7. Disclaimers obrigatórios

Incluir em apresentações, convites, páginas e materiais para parceiros/jurídico/beta:

1. Este material refere-se ao ambiente **DEMO/STAGING**.
2. **Conta real não está liberada.**
3. **Produção real não está liberada.**
4. **Dispatch automático está desativado.**
5. **Não há promessa de rentabilidade.**
6. O desempenho passado em ambiente DEMO **não representa** garantia de resultado futuro.
7. Qualquer discussão sobre conta real depende de **novo gate** jurídico, operacional, técnico e financeiro.
8. O uso em **dinheiro real permanece bloqueado.**

---

## 8. Status badges institucionais

Badges padronizados para slides, dashboard (futuro) e relatórios:

| Badge | Significado |
|-------|-------------|
| `DEMO/STAGING VALIDATED` | Homologação técnica e operacional em demo |
| `REAL ACCOUNT BLOCKED` | Conta real não aprovada |
| `AUTO DISPATCH DISABLED` | Sem disparo automático de instruções |
| `REAL TRADING GUARD ACTIVE` | Bloqueio técnico REAL por padrão |
| `MANUAL DISPATCH ONLY` | Dispatch somente via admin |
| `RC DEMO/STAGING` | Release Candidate congelada |
| `GOVERNANCE REQUIRED BEFORE REAL` | Gate explícito antes de qualquer real |

---

## 9. Linguagem para dashboard / admin

Textos institucionais **sugeridos** (implementação visual opcional — fora do escopo desta fase):

| Contexto | Texto sugerido |
|----------|----------------|
| Tela principal | *Ambiente DEMO/STAGING — Conta real bloqueada por padrão.* |
| Real Trading Guard | *Conta REAL bloqueada por política técnica. Qualquer liberação futura exige gate específico.* |
| Dispatch | *Dispatch manual administrativo. Nenhum disparo automático está ativo.* |
| Tracking | *Tracking consolidado para auditoria operacional.* |

---

## 10. Linguagem para parceiro / corretora

**Resumo institucional:**

O Mercado da Riqueza AutoTrade encontra-se em **Release Candidate DEMO/STAGING**, com validações técnicas e operacionais concluídas em ambiente demo, incluindo Real Trading Guard, tracking, runbook, rollback e AutoTrading controlado. **Conta real**, **produção real** e **dispatch automático** permanecem **bloqueados**. O modelo é de automação **controlada** e **auditável**, com revisão administrativa antes do envio de instruções ao EA cliente — adequado para discussões de parceria técnica e homologação institucional, não para lançamento comercial em conta real.

**Materiais de apoio:** [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md), [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md).

---

## 11. Linguagem para cliente beta DEMO

**Resumo para onboarding beta:**

Você está participando de uma **validação em ambiente DEMO**. **Nenhuma conta real** será utilizada. O objetivo é validar conectividade, tracking, execução simulada/controlada (`DebugMode` conforme política da sessão) e operação assistida. Não há promessa de rentabilidade. Operações em bolsa envolvem risco; o ambiente atual serve exclusivamente para homologação e feedback operacional.

---

## 12. Materiais institucionais recomendados

| Material | Documento |
|----------|-----------|
| Relatório executivo | [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) |
| Pacote de apresentação | [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) |
| Briefing de reunião | [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) |
| Convite executivo | Conforme pacote de parceiros |
| Relatório Real Trading Guard | [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md) |
| Relatório auditoria técnica | [`PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md) |
| Relatório hardening VPS/MT5 | [`VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md) |
| Release Candidate Freeze | [`RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md) |
| Branding & readiness (este doc) | [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) |

---

## 13. Readiness institucional

| Item | Status |
|------|--------|
| Nome oficial definido | OK |
| Descrição institucional definida | OK |
| Disclaimers definidos | OK |
| Mensagens proibidas definidas | OK |
| Badges institucionais definidos | OK |
| Linguagem para parceiros definida | OK |
| Linguagem para beta demo definida | OK |
| Conta real bloqueada | OK |
| Produção real bloqueada | OK |
| Dispatch automático desativado | OK |

---

## 14. Pendências

- Aplicar **branding visual** no dashboard/admin, se desejado (fora do escopo desta fase documental).
- **Revisar com jurídico** antes de material público ou campanha.
- Preparar **versão em slides** a partir dos pacotes existentes.
- Preparar **página institucional** (conteúdo alinhado a este documento).
- Preparar **onboarding beta demo** (Fase 9.4).
- Definir **tom final comercial** após certificação do ambiente demo (Fase 9.3).

---

## 15. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `BRANDING_INSTITUTIONAL_READY_FOR_DEMO_RC` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **RC** | `RC_VERSION_LOCKED_FOR_DEMO_STAGING` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — branding e readiness institucional para RC DEMO/STAGING (Fase 9.2). Sem alteração de código. Conta real, produção real e dispatch automático permanecem bloqueados.*
