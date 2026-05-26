# Plano de Auditoria Técnica Pré-Conta Real — Mercado da Riqueza AutoTrade

**Data:** 2026-05-26  
**Status inicial:** `PLANNED`

---

## Avisos principais

Este plano define apenas o roteiro técnico de auditoria antes de qualquer avaliação futura de conta real.

- Este plano **NÃO** libera conta real.
- Este plano **NÃO** libera produção real.
- Este plano **NÃO** libera dinheiro real.
- Este plano **NÃO** ativa dispatch automático.
- Este plano **NÃO** autoriza envio de ordem real.
- Este plano **NÃO** altera estratégia, EA, backend, schema, migrations ou envs.

---

## 1. Contexto

O Mercado da Riqueza AutoTrade chegou a uma etapa em que a robustez técnica precisa ser auditada antes de qualquer discussão futura sobre conta real.

Histórico consolidado:

- **Fase 3:** produção simulada aprovada com 10/10 ciclos simulados.
- **Fase 4:** beta demo e demo com `DebugMode=false` em conta DEMO aprovadas.
- **Fase 5:** governança para conta real documentada, incluindo gates, termos, limites e responsabilidades.
- **Fase 6:** Real Trading Guard implementado, testado, homologado e validado em staging/demo.
- Conta real permanece bloqueada.
- Produção real permanece bloqueada.
- Dispatch automático permanece desativado.

O próximo risco técnico é garantir, por auditoria estruturada, que autenticação, autorização, idempotência, tracking, logs, rollback, dispatch, EA, secrets e duplicidade estejam robustos antes de qualquer etapa real futura.

---

## 2. Escopo da auditoria

Áreas a auditar:

- Autenticação admin.
- Proteção de rotas admin.
- Proteção de APIs EA.
- Secrets e envs.
- Logs.
- Auditoria.
- Idempotência.
- Retry.
- Tracking.
- Dispatch manual.
- Bloqueio de dispatch automático.
- Real Trading Guard.
- Permissões.
- Banco de dados.
- Prisma.
- Vercel/staging.
- EA cliente.
- EA Mãe.
- Rollback.
- Observabilidade.
- Duplicidade de ordens.
- Falhas de rede.
- Falhas de corretora/MT5.

---

## 3. Fora de escopo

Não autorizado nesta fase:

- Conta real.
- Ordem real.
- Produção real.
- Dispatch automático.
- Alteração de envs.
- Migração de banco.
- Alteração de EA.
- Execução com dinheiro real.
- Alteração de estratégia.
- Aumento de lote.
- Múltiplos clientes.
- Deploy.
- Alteração de backend.
- Alteração de Prisma/schema/migrations.

---

## 4. Checklist de autenticação e autorização

Validar:

- [ ] Login admin funciona apenas para usuários autorizados.
- [ ] Sessão admin expira e é validada server-side.
- [ ] Rotas `/admin` exigem autenticação.
- [ ] APIs admin exigem autenticação e autorização.
- [ ] Não existem rotas sensíveis acessíveis sem auth.
- [ ] Não existem `POST`, `PUT` ou `PATCH` sensíveis sem checagem admin.
- [ ] Logout invalida a sessão esperada.
- [ ] `callbackUrl` não permite redirecionamento inseguro.
- [ ] Permissões seguem privilégio mínimo.
- [ ] Acesso direto por URL não faz bypass de autorização.

---

## 5. Checklist de APIs do EA

Validar:

- [ ] Heartbeat.
- [ ] License config.
- [ ] Instructions pull.
- [ ] Execution report.
- [ ] Autenticação por device/licença/token.
- [ ] Bloqueio para licença inativa.
- [ ] Bloqueio para assinatura inativa.
- [ ] Comportamento com device revogado.
- [ ] Comportamento com payload inválido.
- [ ] Comportamento com request duplicado.
- [ ] Logs não exibem secrets, tokens ou credenciais.

---

## 6. Checklist de MasterSignal

Validar:

- [ ] `POST /api/master/signals` exige `MASTER_EA_API_SECRET`.
- [ ] Payload inválido é rejeitado.
- [ ] Idempotência funciona.
- [ ] `POST` não faz dispatch automático.
- [ ] Estados `VALIDATED` / `NOT_DISPATCHED` são preservados.
- [ ] Expiração funciona.
- [ ] `profile` incompatível bloqueia elegibilidade.
- [ ] Ausência de licença elegível não cria instruction.
- [ ] Tracking é atualizado corretamente.

---

## 7. Checklist de dispatch/admin

Validar:

- [ ] Dispatch é apenas manual.
- [ ] Botão de dispatch exige confirmação.
- [ ] Rota admin de dispatch é protegida.
- [ ] Dispatch não duplica instruction.
- [ ] Dispatch respeita status `VALIDATED`.
- [ ] Dispatch bloqueia `EXPIRED`.
- [ ] Dispatch bloqueia `REJECTED`.
- [ ] Dispatch bloqueia `DISPATCHED` / `EXECUTED`.
- [ ] Logs e audit trail são criados.
- [ ] Tracking reflete o estado após dispatch.

---

## 8. Checklist Real Trading Guard

Validar:

- [ ] Default deny para `REAL`.
- [ ] `DEMO` permitido conforme regras operacionais existentes.
- [ ] `ENABLE_REAL_TRADING` não configurado.
- [ ] `REAL_TRADING_ALLOWED_LICENSE_IDS` não configurado.
- [ ] Painel admin read-only.
- [ ] Sem toggle.
- [ ] Sem botão de ativação.
- [ ] Sem env bruto na UI.
- [ ] Sem secret na UI/logs.
- [ ] `REAL_TRADING_DISABLED` aparece quando aplicável.
- [ ] Pull do EA em `REAL` retorna instructions vazias.
- [ ] Dispatch `REAL` é skipped.
- [ ] Harness local segue `8/8` cenários `PASS`.

---

## 9. Checklist de idempotência e duplicidade

Validar:

- [ ] `MasterSignalId` duplicado não cria novo sinal.
- [ ] `IdempotencyKey` duplicada não cria duplicidade.
- [ ] Instruction não duplica.
- [ ] Execution report duplicado não duplica estado.
- [ ] Retry não cria segunda ordem.
- [ ] Reprocessamento após EA offline não duplica.
- [ ] Falha e reconexão mantêm consistência.

---

## 10. Checklist de tracking e observabilidade

Validar:

- [ ] Status consolidado correto.
- [ ] Contadores corretos.
- [ ] Pendentes.
- [ ] Executadas.
- [ ] Falhas.
- [ ] Ignorados.
- [ ] Motivos de erro.
- [ ] Timestamps.
- [ ] Source `MASTER_SIGNAL`.
- [ ] Payload redigido.
- [ ] Logs úteis para diagnóstico.
- [ ] Ausência de secrets em logs, payloads públicos e UI.

---

## 11. Checklist de banco e Prisma

Validar:

- [ ] Modelos críticos.
- [ ] Integridade de relações.
- [ ] Índices/constraints relevantes.
- [ ] Migrations alinhadas.
- [ ] Ausência de dados sensíveis em `rawPayload`.
- [ ] Redaction de payload.
- [ ] Auditoria de `AdminAction` / `AuditLog`.
- [ ] Rollback sem apagar histórico.

---

## 12. Checklist de EA cliente

Validar:

- [ ] URL staging.
- [ ] Activation/device.
- [ ] Heartbeat.
- [ ] `DebugMode`.
- [ ] `tradeMode`.
- [ ] WebRequest.
- [ ] Logs.
- [ ] Tratamento de instruction.
- [ ] Tratamento de erro `OrderSend`.
- [ ] Report de execution.
- [ ] Comportamento offline/online.
- [ ] Tokens não são expostos em logs, prints ou arquivos.

---

## 13. Checklist de EA Mãe

Validar:

- [ ] `MASTER_EA_API_SECRET` redigido.
- [ ] `InpSendOnInit=false`.
- [ ] `InpSendOnce=true`.
- [ ] Botão manual.
- [ ] `MasterSignalId` único.
- [ ] Idempotência.
- [ ] Logs sem secret.
- [ ] Payload correto.
- [ ] Intake não faz dispatch automático.

---

## 14. Checklist de rollback

Validar:

- [ ] Remover EA.
- [ ] Desativar AutoTrading.
- [ ] Revogar device/token.
- [ ] Pausar dispatch.
- [ ] Rotacionar secret.
- [ ] Cancelar ordens demo.
- [ ] Preservar histórico.
- [ ] Registrar incidente.
- [ ] Voltar `DebugMode=true`.

---

## 15. Critérios de aprovação da auditoria

A auditoria só pode ser aprovada se:

- [ ] Nenhuma rota crítica aberta.
- [ ] Nenhum secret exposto.
- [ ] Dispatch automático desativado.
- [ ] Real Trading Guard ativo.
- [ ] Idempotência preservada.
- [ ] Tracking consistente.
- [ ] Rollback documentado.
- [ ] Logs suficientes.
- [ ] Testes passando.
- [ ] Build passando.
- [ ] Pendências críticas resolvidas ou documentadas.

---

## 16. Critérios de reprovação

Reprovar se houver:

- Rota admin sem auth.
- API sensível sem auth.
- Secret em log.
- Dispatch automático.
- Duplicidade de instruction.
- Duplicidade de execution.
- Falha do Real Trading Guard.
- Quebra de `DEMO`.
- Tracking inconsistente.
- Rollback indefinido.
- Schema/migration inconsistente.
- EA expondo segredo.
- Conta real liberada indevidamente.

---

## 17. Status da auditoria

**Status inicial:** `PLANNED`

Status possíveis:

- `PLANNED`
- `IN_PROGRESS`
- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

---

## 18. Próxima ação recomendada

Executar a auditoria por blocos:

1. Autenticação e rotas.
2. APIs EA.
3. MasterSignal/dispatch.
4. Real Trading Guard.
5. Idempotência/tracking.
6. EA cliente/EA Mãe.
7. Rollback.
8. Relatório final.

---

*Mercado da Riqueza AutoTrade — plano técnico de auditoria pré-conta real. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
