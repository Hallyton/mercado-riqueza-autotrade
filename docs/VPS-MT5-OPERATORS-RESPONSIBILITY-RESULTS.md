# Resultado — Definição de Operadores e Responsabilidades VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.6 — Definição Nominal de Operadores e Matriz de Permissões  
**Status:** `APPROVED_WITH_RESTRICTIONS`

---

## 1. Objetivo

Remover o bloqueio operacional de papéis e permissões `A DEFINIR` no ambiente VPS/MT5, formalizando responsáveis nominais e matriz de ações para staging/demo, **sem** liberar conta real, produção real ou dispatch automático.

---

## 2. Operadores definidos

| Papel | Responsável |
|-------|-------------|
| Responsável técnico | HALLYTON |
| Responsável operacional | HALLYTON |
| Operador MT5/VPS | HALLYTON |
| Admin autorizado ao dispatch | HALLYTON |
| Responsável pelo rollback | HALLYTON |
| Responsável por evidências | HALLYTON |
| Responsável por revisão pós-sessão | HALLYTON |

**Observação:** a definição nominal reduz o bloqueio operacional de responsáveis indefinidos, mas **não libera conta real**. Conta real continua dependente de gate futuro, revisão jurídica, limites financeiros, checklist individual, hardening completo e aprovação explícita.

---

## 3. Matriz de permissões

| Ação | Responsável |
|------|-------------|
| Acessar VPS | HALLYTON |
| Abrir MT5 | HALLYTON |
| Anexar/remover EA | HALLYTON |
| Alterar parâmetros do EA | HALLYTON |
| Ligar/desligar AutoTrading | HALLYTON |
| Enviar MasterSignal | HALLYTON |
| Fazer dispatch admin | HALLYTON |
| Acionar rollback | HALLYTON |
| Revogar device/token | HALLYTON |
| Coletar logs | HALLYTON |
| Aprovar sessão | HALLYTON |
| Encerrar sessão | HALLYTON |

Fonte canônica: [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md).

---

## 4. Responsável por rollback

**HALLYTON** — aciona rollback conforme procedimento em [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md) (rollback do ambiente) e [`docs/PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md).

---

## 5. Responsável por evidências

**HALLYTON** — coleta, redige e arquiva evidências no cofre interno (`evidencias/vps-mt5-staging/`), conforme [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md`](VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md), sem commitar binários ou secrets no Git.

---

## 6. Critérios de bloqueio remanescentes

Mesmo com operadores definidos, permanecem bloqueios para **conta real**:

| Critério | Situação |
|----------|----------|
| Gate de conta real | Não aprovado |
| Revisão jurídica | Pendente |
| Limites financeiros | Indefinidos |
| Checklist individual de conta real | Não preenchido |
| Hardening VPS/Windows completo | Pendente (prints/evidências Fase 8.5) |
| Evidências AutoTrading controladas | Pendente |
| Real Trading Guard | Bloqueia `REAL` por padrão (backend) |
| Produção real | Bloqueada |
| Dispatch automático | Desativado |
| Suplente operacional documentado | Pendente |

---

## 7. Decisão da Fase 8.6

**Status:** `APPROVED_WITH_RESTRICTIONS`

**Motivo:** operadores e matriz de permissões definidos nominalmente (**HALLYTON**). Conta real **continua bloqueada** por pendências de hardening completo, evidências visuais, revisão jurídica, limites financeiros e gate futuro explícito.

Esta decisão:

- Remove o bloqueio **“operadores A DEFINIR”**.
- **Não** autoriza conta real, dinheiro real, produção real nem dispatch automático.
- **Não** altera código, EA, backend, schema, envs ou deploy.

**Próxima etapa:** coletar evidências pendentes (Fase 8.5), executar sessão AutoTrading controlada e definir suplente operacional.

---

*Mercado da Riqueza AutoTrade — operadores VPS/MT5 definidos. Conta real permanece bloqueada.*
