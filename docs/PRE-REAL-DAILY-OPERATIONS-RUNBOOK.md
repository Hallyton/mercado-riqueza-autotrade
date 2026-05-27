# Runbook Operacional Diário — Mercado da Riqueza AutoTrade

**Data:** 2026-05-26  
**Status inicial:** `DRAFT_OPERATIONAL_RUNBOOK`

---

## 1. Contexto

O backend do Mercado da Riqueza AutoTrade foi auditado em blocos técnicos cobrindo autenticação, APIs do EA, MasterSignal, dispatch, idempotência, tracking, redaction, rollback, banco/Prisma, contratos dos EAs e hardening de ambiente.

O Real Trading Guard está validado para manter `tradeMode=REAL` bloqueado por padrão no contexto staging/demo.

O ambiente MT5/VPS exige hardening operacional, especialmente porque o EA cliente usa `device_token` local após ativação.

Este runbook padroniza a operação diária para preparação, execução, monitoramento, encerramento e rollback de sessões controladas.

Conta real continua bloqueada. Produção real continua bloqueada. Dispatch automático continua desativado.

---

## 2. Escopo

Autorizado neste runbook:

- Staging/demo.
- Conta demo.
- `DebugMode=true` por padrão.
- Dispatch manual.
- Monitoramento pelo admin.
- Registro de evidências.
- Rollback operacional.

Não autorizado neste runbook:

- Conta real.
- Dinheiro real.
- Produção real.
- Dispatch automático.
- Múltiplos clientes.
- Múltiplos ativos.
- Perfil agressivo.
- Operação sem responsável.
- Operação sem evidência.
- Operação fora do checklist.

---

## 3. Papéis Operacionais

| Papel | Responsável |
|-------|-------------|
| Responsável técnico | A DEFINIR |
| Responsável operacional | A DEFINIR |
| Operador MT5/VPS | A DEFINIR |
| Admin autorizado ao dispatch | A DEFINIR |
| Responsável pelo rollback | A DEFINIR |

Observação: todos estes campos bloqueiam qualquer sessão real futura enquanto estiverem `A DEFINIR`.

---

## 4. Checklist Pré-Sessão

Validar antes de qualquer sessão:

- [ ] Git/versão esperada registrada.
- [ ] Ambiente correto.
- [ ] URL correta.
- [ ] Admin acessível.
- [ ] Real Trading Guard visível.
- [ ] Conta real bloqueada.
- [ ] Dispatch automático desativado.
- [ ] Conta MT5 correta.
- [ ] Tipo da conta confirmado.
- [ ] EA cliente anexado.
- [ ] EA cliente apontando para URL correta.
- [ ] `DebugMode` conforme sessão autorizada.
- [ ] Heartbeat `ONLINE`.
- [ ] WebRequest liberado apenas para domínio autorizado.
- [ ] AutoTrading conforme política.
- [ ] Nenhuma ordem pendente desconhecida.
- [ ] Nenhuma posição aberta desconhecida.
- [ ] Logs MT5 visíveis.
- [ ] Rollback conhecido.
- [ ] Evidência preparada.

---

## 5. Checklist de Criação do Sinal

Validar:

- [ ] `MasterSignalId` único.
- [ ] `Symbol` correto.
- [ ] `Side` correto.
- [ ] `OrderType` correto.
- [ ] `Purpose` correto.
- [ ] `Profile` correto.
- [ ] `expires_in_seconds <= 300`.
- [ ] `IdempotencyKey` correta.
- [ ] Secret protegido.
- [ ] Nenhum print com secret.
- [ ] Nenhum dispatch automático esperado.

---

## 6. Checklist de Admin Dispatch

Validar:

- [ ] Painel mostra `VALIDATED` / `NOT_DISPATCHED`.
- [ ] Preview de elegibilidade revisado.
- [ ] Perfil correto.
- [ ] Licença correta.
- [ ] Conta correta.
- [ ] `tradeMode` correto.
- [ ] Real Trading Guard não bloqueia `DEMO`.
- [ ] Botão de dispatch usado manualmente.
- [ ] Confirmação visual feita.
- [ ] Nenhum segundo dispatch.

---

## 7. Checklist de EA Cliente

Validar:

- [ ] Instruction recebida.
- [ ] Source `MASTER_SIGNAL`.
- [ ] Payload parseado.
- [ ] `DebugMode` respeitado.
- [ ] Ordem não enviada quando `DebugMode=true`.
- [ ] Ordem demo apenas quando sessão demo `DebugMode=false` for explicitamente autorizada.
- [ ] Execution report enviado.
- [ ] Logs sem secrets.

---

## 8. Checklist de Tracking

Validar:

- [ ] Status consolidado correto.
- [ ] Dispatches correto.
- [ ] Instructions correto.
- [ ] Executadas correto.
- [ ] Pendentes correto.
- [ ] Falhas correto.
- [ ] Ignorados correto.
- [ ] Source `MASTER_SIGNAL`.
- [ ] Motivo legível.
- [ ] Timestamps coerentes.

---

## 9. Checklist Pós-Sessão

Validar:

- [ ] Tracking final registrado.
- [ ] Prints/evidências salvos.
- [ ] EA removido ou voltou para `DebugMode=true`, quando aplicável.
- [ ] AutoTrading desligado, quando aplicável.
- [ ] Nenhuma posição/ordem inesperada.
- [ ] Logs coletados sem secrets.
- [ ] Incidentes documentados.
- [ ] Status final registrado.

---

## 10. Procedimento de Rollback

Passos:

1. Parar dispatch admin.
2. Remover EA do gráfico.
3. Desativar AutoTrading.
4. Cancelar ordens pendentes, se aplicável e autorizado.
5. Fechar posição apenas se houver autorização operacional documentada.
6. Revogar device/token se necessário.
7. Rotacionar secret se necessário.
8. Registrar incidente.
9. Preservar histórico.
10. Bloquear nova sessão até revisão.

---

## 11. Critérios de Pausa Imediata

Pausar se:

- Conta divergente.
- Símbolo divergente.
- Profile divergente.
- `DebugMode` incorreto.
- AutoTrading incorreto.
- Real Trading Guard inesperado.
- Tracking inconsistente.
- EA offline.
- Ordem duplicada.
- Secret exposto.
- Dispatch indevido.
- Operador não autorizado.
- Rollback incerto.

---

## 12. Registro de Evidência da Sessão

Template:

| Campo | Valor |
|-------|-------|
| Data |  |
| Responsável |  |
| Ambiente |  |
| Conta MT5 |  |
| Tipo de conta |  |
| MasterSignalId |  |
| InstructionId |  |
| ExecutionId |  |
| Symbol |  |
| Side |  |
| Profile |  |
| DebugMode |  |
| tradeMode |  |
| Status intake |  |
| Status dispatch |  |
| Status EA |  |
| Status tracking |  |
| Ordem real enviada |  |
| Incidentes |  |
| Rollback usado |  |
| Status final |  |

---

## 13. Status do Runbook

**Status atual:** `APPROVED_WITH_RESTRICTIONS` (validação documental Fase 7.11; evidência visual no admin pendente)

**Status inicial:** `DRAFT_OPERATIONAL_RUNBOOK`

Status possíveis:

- `DRAFT_OPERATIONAL_RUNBOOK`
- `READY_FOR_DEMO_OPERATIONS`
- `READY_FOR_REVIEW`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

---

## 14. Próxima Ação Recomendada

Usar este runbook em novas sessões demo/staging e preencher os responsáveis antes de qualquer discussão de conta real.

Antes de qualquer sessão com risco maior, transformar este runbook em checklist preenchido com data, responsáveis, evidências e decisão final.

---

## 15. Restrições Mantidas

- Conta real continua bloqueada.
- Produção real continua bloqueada.
- Dinheiro real continua bloqueado.
- Dispatch automático continua desativado.
- Nenhuma ordem real está autorizada por este runbook.

---

## 16. Validação em sessão demo/staging — Fase 7.11

**Data:** 2026-05-27  
**Documento de resultado:** [`docs/PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md)  
**Status da validação:** `APPROVED_WITH_RESTRICTIONS`

| Item | Situação |
|------|----------|
| Runbook criado e validado documentalmente | OK |
| Execução operacional (sessão demo/staging) | Depende de confirmação visual no admin |
| MasterSignalId planejado | `runbook-demo-session-001` |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Conta MT5 (especificação) | `52609973 @ XPMT5-DEMO` |
| Conta real usada | Não |
| Produção real | Bloqueada |
| Dispatch automático | Desativado |
| Código / EA / schema / env / deploy | Nenhuma alteração |

**Pendência:** confirmar em `/admin/master-signals/runbook-demo-session-001` que o tracking está **`EXECUTED`** antes de considerar a fase operacionalmente `APPROVED`.

**Conclusão:** o runbook é aplicável como procedimento documentado em demo/staging. Papéis operacionais permanecem `A DEFINIR` e continuam bloqueando qualquer sessão com conta real.

---

*Mercado da Riqueza AutoTrade — runbook validado documentalmente; evidência operacional no admin pendente. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
