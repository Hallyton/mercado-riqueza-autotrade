# Política Operacional — Operadores, Responsabilidades e AutoTrading

**Data:** 2026-05-27  
**Fase:** 8.3 — Definição de Operadores, Responsabilidades e Política de AutoTrading  
**Status:** `APPROVED_WITH_RESTRICTIONS` (operadores definidos — Fase 8.6)

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
| Responsável técnico | HALLYTON |
| Responsável operacional | HALLYTON |
| Operador MT5/VPS | HALLYTON |
| Admin autorizado ao dispatch | HALLYTON |
| Responsável pelo rollback | HALLYTON |
| Responsável por evidências | HALLYTON |
| Responsável por revisão pós-sessão | HALLYTON |

**Observação (Fase 8.6):** a definição nominal dos operadores reduz o bloqueio operacional de responsáveis `A DEFINIR`, mas **NÃO libera conta real**. Conta real continua dependente de gate futuro, revisão jurídica, limites financeiros, checklist individual, hardening completo e aprovação explícita.

**Regra:** a decisão global permanece `REAL_ACCOUNT_NOT_APPROVED` até gates de governança e hardening completos, independentemente dos nomes acima.

---

## 3. Matriz de permissões

| Ação | Quem pode executar |
|------|-------------------|
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

**Suplente:** a definir em revisão operacional futura — sessões críticas exigem responsável presente.

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

**Status atual:** `APPROVED_WITH_RESTRICTIONS` (Fase 8.6)

**Status inicial:** `DRAFT_OPERATIONAL_POLICY`

Status possíveis:

- `DRAFT_OPERATIONAL_POLICY`
- `READY_FOR_DEMO_USE`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

**Condição para `READY_FOR_DEMO_USE`:** todos os papéis da seção 2 preenchidos + matriz da seção 3 sem `A DEFINIR` + evidência de uma sessão demo com AutoTrading conforme esta política.

---

## 10. Próxima ação recomendada

1. Definir **suplente** documentado para cada papel crítico.
2. Executar sessão demo/staging com AutoTrading conforme seções 6 e 7 e registrar evidências.
3. Anexar prints redigidos: WebRequest, `MQL5/Files`, VPS/Windows, log MT5 (cofre interno).
4. Promover para `READY_FOR_DEMO_USE` após evidência de sessão AutoTrading controlada.
5. Manter conta real bloqueada até novo gate explícito.

---

## 11. Fase 8.6 — Operadores definidos

**Documento de resultado:** [`docs/VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md`](VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md)

---

*Mercado da Riqueza AutoTrade — política operacional com operadores definidos. Conta real, produção real e dispatch automático permanecem bloqueados.*
