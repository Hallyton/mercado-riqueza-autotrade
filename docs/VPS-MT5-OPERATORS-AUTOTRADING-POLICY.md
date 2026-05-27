# Política Operacional — Operadores, Responsabilidades e AutoTrading

**Data:** 2026-05-27  
**Fase:** 8.3 — Definição de Operadores, Responsabilidades e Política de AutoTrading  
**Status:** `DRAFT_OPERATIONAL_POLICY`

Documentos relacionados: [`docs/VPS-MT5-HARDENING-VALIDATION.md`](VPS-MT5-HARDENING-VALIDATION.md), [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md), [`docs/PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md).

---

## 1. Contexto

A Fase 8.2 registrou o checklist de hardening VPS/MT5 como `APPROVED_WITH_RESTRICTIONS`, com **operadores `A DEFINIR`** como pendência de **alta prioridade**.

**AutoTrading** ainda precisava de política formal escrita — esta fase define essa política.

Sem responsáveis nomeados e matriz de permissões preenchida, **qualquer conta real permanece bloqueada**, independentemente do status técnico da plataforma.

Esta política:

- Formaliza papéis, permissões e regras de AutoTrading para **staging/demo**.
- Estabelece critérios para **qualquer discussão futura** de conta real (sem autorizá-la).
- **Não** libera conta real, produção real, dinheiro real nem dispatch automático.

---

## 2. Papéis operacionais

| Papel | Responsável |
|-------|-------------|
| Responsável técnico | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável operacional | A DEFINIR — BLOQUEIA CONTA REAL |
| Operador MT5/VPS | A DEFINIR — BLOQUEIA CONTA REAL |
| Admin autorizado ao dispatch | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável pelo rollback | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável por evidências | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável por revisão pós-sessão | A DEFINIR — BLOQUEIA CONTA REAL |

**Regra:** enquanto qualquer papel crítico permanecer `A DEFINIR`, a decisão global permanece `REAL_ACCOUNT_NOT_APPROVED`.

---

## 3. Matriz de permissões

| Ação | Quem pode executar (inicial) |
|------|------------------------------|
| Acessar VPS | A DEFINIR — BLOQUEIA CONTA REAL |
| Abrir MT5 | A DEFINIR — BLOQUEIA CONTA REAL |
| Anexar/remover EA | A DEFINIR — BLOQUEIA CONTA REAL |
| Alterar parâmetros do EA | A DEFINIR — BLOQUEIA CONTA REAL |
| Ligar/desligar AutoTrading | A DEFINIR — BLOQUEIA CONTA REAL |
| Enviar MasterSignal | A DEFINIR — BLOQUEIA CONTA REAL |
| Fazer dispatch admin | A DEFINIR — BLOQUEIA CONTA REAL |
| Acionar rollback | A DEFINIR — BLOQUEIA CONTA REAL |
| Revogar device/token | A DEFINIR — BLOQUEIA CONTA REAL |
| Coletar logs | A DEFINIR — BLOQUEIA CONTA REAL |
| Aprovar sessão | A DEFINIR — BLOQUEIA CONTA REAL |
| Encerrar sessão | A DEFINIR — BLOQUEIA CONTA REAL |

**Próximo passo:** substituir cada `A DEFINIR` por nome (ou função formal) + suplente documentado.

---

## 4. Política de AutoTrading

1. **AutoTrading deve ficar desligado** fora de sessões formalmente autorizadas.
2. **AutoTrading só pode ser ligado** por operador autorizado (matriz da seção 3).
3. **AutoTrading só pode ser ligado** após conclusão do checklist pré-sessão ([`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md) + seção 6 desta política).
4. **AutoTrading deve ser desligado** ao final da sessão, salvo justificativa documentada pelo responsável operacional.
5. Com **`DebugMode=true`**, AutoTrading ainda deve ser **controlado** (sessão autorizada, responsável presente, rollback pronto).
6. Com **`DebugMode=false`** em conta **DEMO**, AutoTrading só pode ser ligado durante sessão **explicitamente aprovada** (gate demo documentado).
7. Em **conta real**, AutoTrading permanece **proibido** até gate futuro específico, operadores definidos, termos, limites e checklist individual.
8. **Qualquer divergência** (conta, símbolo, URL, DebugMode, WebRequest, operador) exige **pausa imediata** e registro de incidente.

---

## 5. Política por ambiente

### Staging / demo

| Regra | Valor |
|-------|--------|
| Uso permitido | Somente com runbook operacional |
| `DebugMode` padrão | `true` |
| `DebugMode=false` (demo) | Apenas com autorização explícita documentada |
| Dispatch | Manual (admin) |
| Conta real | Não autorizada |
| AutoTrading | Conforme seções 4, 6 e 7 desta política |

### Conta real

| Regra | Valor |
|-------|--------|
| Status | **Não autorizada** |
| Gate | Exige gate futuro explícito |
| Operadores | Todos definidos e sem `A DEFINIR` |
| Governança | Termo, limites financeiros, checklist individual de conta real |
| AutoTrading | Controlado + rollback pronto — ainda **proibido** até aprovação formal |
| Real Trading Guard | Permanece bloqueando `REAL` por padrão no backend |

---

## 6. Procedimento antes de ligar AutoTrading

Checklist obrigatório:

- [ ] Conta correta confirmada.
- [ ] Tipo de conta confirmado (`DEMO` em staging).
- [ ] Nenhuma ordem pendente desconhecida.
- [ ] Nenhuma posição aberta desconhecida.
- [ ] EA correto anexado ao gráfico esperado.
- [ ] URL da API correta (`InpApiBaseUrl`).
- [ ] `DebugMode` conforme sessão autorizada.
- [ ] WebRequest limitado ao domínio autorizado.
- [ ] Real Trading Guard verificado no admin (DEMO não bloqueado indevidamente).
- [ ] Admin acessível para dispatch manual, se aplicável.
- [ ] Rollback conhecido e responsável pelo rollback identificado.
- [ ] Responsável operacional (ou técnico) **presente** na sessão.

---

## 7. Procedimento após desligar AutoTrading

Checklist obrigatório:

- [ ] Tracking conferido no admin.
- [ ] Execuções conferidas.
- [ ] Ordens e posições conferidas no terminal.
- [ ] Logs coletados **sem secrets**.
- [ ] EA removido do gráfico ou `DebugMode=true` restaurado.
- [ ] Evidências salvas (template do runbook).
- [ ] Incidentes registrados, se houver.
- [ ] Sessão formalmente encerrada pelo responsável por revisão pós-sessão.

---

## 8. Critérios de bloqueio

Bloquear ou pausar a sessão imediatamente se:

- Operador não definido ou não autorizado na matriz.
- Responsável ausente durante sessão com AutoTrading ligado.
- AutoTrading ligado fora de sessão autorizada.
- Acesso VPS compartilhado sem controle documentado.
- `DebugMode` divergente do aprovado.
- Conta real aberta sem gate.
- WebRequest apontando para domínio não autorizado.
- Rollback incerto ou responsável de rollback ausente.
- Logs ou prints expõem secrets (`device_token`, activation code, `Bearer`, etc.).
- EA alterado (parâmetros, URL, símbolo) sem autorização do responsável técnico.
- Real Trading Guard bloqueia indevidamente DEMO **ou** permite REAL sem gate.

---

## 9. Status da política

**Status inicial:** `DRAFT_OPERATIONAL_POLICY`

Status possíveis:

- `DRAFT_OPERATIONAL_POLICY`
- `READY_FOR_DEMO_USE`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

**Condição para `READY_FOR_DEMO_USE`:** todos os papéis da seção 2 preenchidos + matriz da seção 3 sem `A DEFINIR` + evidência de uma sessão demo com AutoTrading conforme esta política.

---

## 10. Próxima ação recomendada

1. Preencher **nomes** (e suplentes) em todos os papéis da seção 2.
2. Completar a **matriz de permissões** (seção 3).
3. Executar uma sessão demo/staging registrando ligar/desligar AutoTrading conforme seções 6 e 7.
4. Anexar evidências: WebRequest, `MQL5/Files`, amostra de log MT5 redigido.
5. Atualizar [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md) e promover status desta política para `READY_FOR_DEMO_USE` ou `APPROVED_WITH_RESTRICTIONS`.
6. Manter conta real bloqueada até novo gate explícito.

---

*Mercado da Riqueza AutoTrade — política operacional em rascunho. Operadores indefinidos bloqueiam conta real. Produção real e dispatch automático permanecem bloqueados.*
