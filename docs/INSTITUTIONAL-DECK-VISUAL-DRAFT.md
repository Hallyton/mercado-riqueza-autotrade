# Institutional Deck Visual Draft — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este documento define a **especificação visual e narrativa** para uma **futura** apresentação institucional.
>
> - **Não** é PPTX final.  
> - **Não** é material jurídico aprovado.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** autoriza dinheiro real.  
> - **Não** promete rentabilidade.

**Data:** 2026-05-27  
**Fase:** 10.7 — Institutional Deck Visual Draft  
**Status:** `INSTITUTIONAL_DECK_VISUAL_DRAFT_READY`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED`

Base narrativa: [`INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md`](INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md) · Identidade: [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md) · `AGENTS.md`

**Escopo:** especificação textual apenas — **sem** PPTX, **sem** alteração de código.

---

## 1. Objetivo

Definir o **padrão visual**, **narrativa slide a slide**, **badges**, **mensagens**, **blocos gráficos** e **identidade visual** recomendada para a apresentação institucional do Mercado da Riqueza AutoTrade (corretoras, parceiros, jurídico, investidores).

---

## 2. Direção visual

Identidade **Mercado da Riqueza**:

- Fundo **escuro / preto** (premium)  
- Detalhes **dourados** (CTAs, bordas, ícones-chave)  
- Linguagem **premium / institucional**  
- Visual **limpo**, amplo respiro, hierarquia clara  
- Foco em **segurança**, **controle**, **auditoria** e **governança**  
- **Sem** estética de promessa de lucro  
- **Sem** imagens apelativas de “dinheiro fácil”  
- Marca **touro/escudo** oficial — não substituir por ícones genéricos de bull market  

---

## 3. Paleta sugerida

| Uso | Cor |
|-----|-----|
| Fundo | Preto / grafite (`#0a0a0a` – `#1a1a1a`) |
| Destaque | Dourado (tokens Tailwind `gold` do projeto) |
| Texto principal | Branco / off-white |
| Texto secundário | Cinza médio |
| Status DEMO / `EXECUTED` | Verde discreto (não “lucro”) |
| Bloqueios / alertas | Vermelho discreto |
| Tecnologia / sistema | Azul/ciano **opcional** (acento, não dominar) |

**Regra:** não introduzir paletas paralelas (azul startup, roxo genérico) fora desta direção.

---

## 4. Tipografia sugerida

| Elemento | Direção |
|----------|---------|
| **Títulos** | Fonte forte, institucional, legível (sans-serif moderna) |
| **Corpo** | Fonte limpa, tamanho confortável para projeção |
| **Evitar** | Fontes exageradas, agressivas, “crypto hype” ou promocionais |

---

## 5. Elementos fixos por slide

Em **todos** os slides (exceto capa pode variar rodapé):

- **Logo** Mercado da Riqueza (canto superior esquerdo ou centro na capa)  
- Badge **`RC DEMO/STAGING`** (canto superior direito)  
- **Rodapé:** texto fixo *“Conta real bloqueada”* (cinza pequeno)  
- **Numeração** discreta (ex.: canto inferior direito)  
- **Disclaimer curto** quando aplicável (slides 1, 14, 17)  

---

## 6. Badges visuais

Estilo: pill/chip com borda dourada ou fundo grafite + texto dourado/branco.

| Badge |
|-------|
| `DEMO/STAGING VALIDATED` |
| `RC DEMO/STAGING` |
| `REAL ACCOUNT BLOCKED` |
| `AUTO DISPATCH DISABLED` |
| `REAL TRADING GUARD ACTIVE` |
| `MANUAL DISPATCH ONLY` |
| `GOVERNANCE REQUIRED BEFORE REAL` |
| `TRACKING EXECUTED` |
| `RUNBOOK VALIDATED` |

---

## 7. Estrutura visual dos slides (17 slides)

### Slide 1 — Capa

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Logo central ou superior; título grande; badges principais (4 da §6) |
| **Texto** | **Mercado da Riqueza AutoTrade** · Release Candidate DEMO/STAGING · Automação controlada com governança operacional |

---

### Slide 2 — Contexto

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Dois blocos lado a lado: *“Robôs isolados”* vs *“Plataforma governada”* |
| **Mensagem** | Evolução de automação isolada → plataforma com rastreabilidade, revisão admin e governança |

---

### Slide 3 — Problema

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Cards de risco (ícone alerta discreto): sem tracking · sem rollback · sem controle · sem auditoria · risco de disparo indevido |
| **Tom** | Neutro técnico, não alarmista comercial |

---

### Slide 4 — Solução

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Diagrama de blocos horizontal: MasterSignal → Backend → Admin → EA Cliente → Tracking |
| **Cor** | Blocos grafite, setas douradas |

---

### Slide 5 — Arquitetura

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Fluxograma horizontal completo: EA Mãe/Simulador → API → Admin Preview → Dispatch Manual → Instruction → EA Cliente → Execution Report → Tracking |
| **Nota** | Sem secrets, URLs completas ou tokens na arte |

---

### Slide 6 — Ambiente certificado

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Card central “Ambiente homologado” |
| **Conteúdo** | `52609973 @ XPMT5-DEMO` · `tradeMode=DEMO` · `DebugMode=true` · Manual Dispatch |

---

### Slide 7 — Evidências

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Três cards em linha |
| **Cards** | `real-guard-demo-smoke-002` · `runbook-demo-session-001` · `autotrading-policy-demo-001` |
| **Status** | Badge verde discreto: **`EXECUTED`** · subtítulo: `1/1/1` · sem conta real |

---

### Slide 8 — Real Trading Guard

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Escudo/cadeado estilizado (dourado); coluna REAL = vermelho bloqueado; DEMO = verde permitido |
| **Mensagem** | Conta real bloqueada por padrão. DEMO validado. |

---

### Slide 9 — Governança operacional

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Grid 2×3 de cards: Runbook · Rollback · Redaction · Audit Log · AutoTrading Controlado · Operadores |
| **Ícones** | Line icons minimalistas (dourado/branco) |

---

### Slide 10 — Auditoria técnica

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Timeline horizontal das auditorias |
| **Etapas** | Auth → EA APIs → MasterSignal → Tracking → Rollback → Prisma → EA → VPS/MT5 |
| **Rodapé** | Pré-conta real — **não libera real** |

---

### Slide 11 — Hardening VPS/MT5

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Ícones em linha: VPS · MT5 · WebRequest · AutoTrading · Logs · Device Token (sensível) |
| **Nota** | Evidências visuais dispensadas por sigilo — texto apenas |

---

### Slide 12 — Demo Client Flow

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Jornada em 6 blocos numerados |
| **Fluxo** | Licença → EA → Heartbeat → Dispatch → Execution Report → Tracking |

---

### Slide 13 — Uso permitido

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Lista com checkmarks dourados |
| **Itens** | Demonstrações · Onboarding DEMO · Homologações · Reuniões institucionais |

---

### Slide 14 — Uso proibido

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Lista com ícones de alerta (vermelho discreto) |
| **Itens** | Conta real · Dinheiro real · Promessa de lucro · Dispatch automático · Copy trade público |
| **Disclaimer** | Rodapé expandido (§8) |

---

### Slide 15 — Pendências antes de conta real

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Ilustração “gate fechado” (cadeado dourado) |
| **Checklist** | Jurídico · Limites · Suitability · Checklist individual · Gate real |

---

### Slide 16 — Próximos passos

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Roadmap linear (5 nós) |
| **Sequência** | Revisão jurídica → Deck final (PPTX) → Reunião parceiro → Feedback → Novo gate (se aplicável) |

---

### Slide 17 — Encerramento

| Elemento | Especificação |
|----------|----------------|
| **Visual** | Logo + frase forte central |
| **Mensagem** | Ambiente DEMO/STAGING validado. Governança documentada. **Conta real bloqueada por padrão.** |
| **Disclaimer** | Bloco final §8 completo ou versão resumida |

---

## 8. Disclaimers visuais obrigatórios

Incluir no **rodapé** (slides-chave) ou **slide 17**:

- Ambiente **DEMO/STAGING**  
- **Conta real bloqueada**  
- **Produção real bloqueada**  
- **Dinheiro real bloqueado**  
- **Dispatch automático desativado**  
- **Sem promessa de rentabilidade**  
- **Não constitui recomendação de investimento**  

---

## 9. Gráficos / diagramas recomendados

| Artefato | Uso |
|----------|-----|
| Fluxo **MasterSignal** | Slides 4–5 |
| Pipeline **dispatch manual** | Slide 5 |
| **Timeline** das fases 6.x–10.x | Slide 10 (resumida) |
| Matriz **permitido / proibido** | Slides 13–14 |
| **Gate REAL** bloqueado | Slides 8, 15 |
| Cards **evidências EXECUTED** | Slide 7 |

Formato futuro: SVG/PPTX shapes — sem dados sensíveis embutidos.

---

## 10. Tom visual proibido

**Não usar:**

- Imagens de dinheiro fácil, pilhas de moeda, “cash rain”  
- Gráficos de **lucro garantido** ou curvas sempre ascendentes como promessa  
- “Antes/depois” de **rentabilidade**  
- Foguetes, lamborghini, lifestyle hype  
- Promessas agressivas ou superlativos comerciais  
- Estética de **aposta** / casino  
- Linguagem visual de **enriquecimento rápido**  

---

## 11. Checklist para futura criação do PPTX

Antes de gerar PPTX (Fase 10.8 sugerida):

- [ ] Revisar com **jurídico**  
- [ ] Revisar **disclaimers** (redação final)  
- [ ] Confirmar uso da **logo** oficial  
- [ ] Escolher **paleta** final alinhada ao tema Tailwind do produto  
- [ ] Confirmar **público-alvo** (corretora vs investidor vs jurídico)  
- [ ] Remover qualquer **dado sensível** (conta, tokens, URLs com secrets)  
- [ ] Manter **conta real bloqueada** visível no rodapé  
- [ ] Manter linguagem **conservadora**  
- [ ] Validar contra [`INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md`](INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md) (17 slides)  
- [ ] **Não** exportar logs, screenshots MT5 ou admin com PII  

---

## 12. Status da Fase 10.7

| Campo | Valor |
|-------|--------|
| **Status** | `INSTITUTIONAL_DECK_VISUAL_DRAFT_READY` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Entregável** | Especificação visual textual — **sem** PPTX |

---

## 13. Próxima etapa sugerida

- **Fase 10.8** — Institutional Deck PPTX Generation, **ou**  
- **Fase 10.8** — First Partner Meeting Record  

Ambas mantêm bloqueios de conta real, produção real e dispatch automático.

---

*Mercado da Riqueza AutoTrade — especificação visual do deck institucional (Fase 10.7). Não é PPTX final nem material jurídico aprovado. Conta real, produção real e dispatch automático permanecem bloqueados.*
