# Real Trading Operation Center

Status: **REAL_TRADING_OPERATION_CENTER_AND_REMOTE_COMMANDS_IMPLEMENTED**

## Objetivo

Centro administrativo para monitorar clientes MR Fibo D1 Guard em conta real e enviar **comandos operacionais** seguros ao EA Executor — sem criar instruções `REAL_MANUAL` e sem expor parâmetros estratégicos.

## Rotas admin

| Rota | Descrição |
|------|-----------|
| `/admin/real-trading/operations` | Lista consolidada + ações |
| `/admin/real-trading/operations/[licenseId]` | Detalhe por licença |
| `POST /api/admin/real-trading/operations/commands` | Criar comando (ADMIN) |
| `GET /api/admin/real-trading/operations/commands` | Dados agregados JSON |

## Modelos

- `EAOperationalSnapshot` — telemetria operacional por licença/conta/símbolo/estratégia
- `EAOperationalCommand` — fila de comandos remotos com lifecycle PENDING → ACKED → EXECUTED/FAILED/EXPIRED/CANCELLED
- `LicenseOperationControl` — estado oficial de pausa admin (`paused`, `reason`, timestamps)

## Comandos

| Tipo | Efeito |
|------|--------|
| `PAUSE_NEW_ENTRIES` | Pausa novas entradas/reversões; mantém gestão de posição |
| `RESUME_TRADING` | Retoma entradas se gates passarem |
| `CANCEL_PENDING_ORDERS` | Cancela pendentes do símbolo/magic; não fecha posição |
| `CLOSE_OPEN_POSITION` | Fecha posição aberta; não cancela pendentes por padrão |
| `CLOSE_ALL_POSITIONS` | Fecha todas as posições do símbolo/magic |
| `FLATTEN_AND_PAUSE` | Cancela pendentes + fecha posição + pausa entradas |
| `REFRESH_STATUS` | Força envio de snapshot operacional + DailyRisk |
| `HEALTH_CHECK` | Prova de vida ativa — snapshot + DailyRisk + heartbeat; **sem ordem** |

Confirmação textual obrigatória para comandos críticos (ex.: `ENCERRAR TUDO E PAUSAR`). `HEALTH_CHECK` não exige confirmação forte.

## Liveness (Fase 15.6)

- Coluna **Liveness** na lista de operações (ONLINE/DEGRADED/CHECKING/UNRESPONSIVE/OFFLINE).
- Coluna **DailyRisk pregão** separada (OK_FOR_DAY / RECENT_OK / MISSING / STALE / REVALIDATION_REQUIRED).
- Botão **Verificar agora** dispara `HEALTH_CHECK`.
- Trace: `GET /api/admin/real-trading/ea-liveness/trace?licenseId=...`
- Ver [`docs/EA-LIVENESS-AND-HEALTH-CHECK.md`](EA-LIVENESS-AND-HEALTH-CHECK.md).

## Auditoria

Eventos em `AdminAction` / `AuditLog`:

- `operation.command.created|acked|executed|failed`
- `operation.pause.enabled|disabled`
- `operation.snapshot.received`

## Segurança

- Apenas ADMIN envia comandos; cliente só visualiza status agregado no dashboard existente.
- Comandos expiram em 2 minutos.
- Sem duplicata PENDING por tipo/licença.
- Comandos críticos exigem role OPS/SUPERADMIN (emergency).
- EA offline: comando fica PENDING ou bloqueado com aviso.

## Liberação e transferência administrativa de conta MT5

Contas MT5 permanecem vinculadas por `(login, servidor)` mesmo após cancelamento ou exclusão do usuário antigo — por design de segurança e preservação de histórico operacional. O admin deve diagnosticar e liberar ou transferir antes de vincular a uma licença nova.

| Recurso | Descrição |
|---------|-----------|
| Trace | `GET /api/admin/mt5-accounts/ownership/trace?accountLogin=&accountServer=` |
| Release | `POST /api/admin/mt5-accounts/ownership/release` — confirmação `LIBERAR CONTA MT5 ORFA` |
| Transfer | `POST /api/admin/mt5-accounts/ownership/transfer` — confirmação `TRANSFERIR CONTA MT5 PARA ESTA LICENCA` |
| UI | Card **Conflito de propriedade MT5** em `/admin/licenses/[licenseId]` ao falhar vínculo |

Travas de release/transfer: usuário/licença ativos, device com heartbeat recente, snapshot com posição aberta, ordens pendentes, comando operacional PENDING, approval REAL ativa. **Não** cria instruction, **não** envia ordem real, **não** altera strategy-config ou approval automaticamente.

Auditoria: `mt5_account.ownership.trace`, `.released`, `.transfered`, `.release_failed`, `.transfer_failed`.

Documentação completa: [`docs/MT5-ACCOUNT-OWNERSHIP-ADMIN.md`](MT5-ACCOUNT-OWNERSHIP-ADMIN.md).

## Fase 15.5

Ver `docs/MASTER-EA-IMPLEMENTATION-PLAN.md` — Real Trading Operation Center & Remote Commands.
