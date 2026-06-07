# EA Liveness, Activity Trace & Health Check

## Modelo

O site **não** chama o EA diretamente na VPS/MT5. O EA permanece atrás de NAT/firewall e consulta a API via polling HTTPS.

Prova de vida híbrida:

1. **Passiva** — qualquer endpoint autenticado do EA renova `Device.lastActivityAt` via `touchEaDeviceActivity()`.
2. **Ativa** — admin clica **Verificar agora** → comando `HEALTH_CHECK` na fila → EA faz ACK/RESULT com snapshot + DailyRisk.

## Status composto

| Status | Significado |
|--------|-------------|
| `ONLINE` | Atividade autenticada ≤ 180s ou health check executado recentemente |
| `DEGRADED` | Atividade ≤ 300s, mas heartbeat específico atrasado (> 120s) |
| `CHECKING` | Health check `PENDING`/`ACKED` dentro do prazo (60s) |
| `UNRESPONSIVE` | Health check expirou sem resposta |
| `OFFLINE` | Nenhuma atividade autenticada recente (> 300s) |

## Thresholds

- Heartbeat ideal: **30s**
- Online: **180s**
- Degradado: **300s**
- Heartbeat stale: **120s**
- Health check timeout: **60s**

## Endpoints que renovam activity

- `POST /api/v1/ea/heartbeat`
- `GET /api/v1/ea/config`
- `POST /api/v1/ea/daily-risk/report`
- `POST /api/v1/ea/operation-snapshot`
- `GET /api/v1/ea/commands`
- `POST /api/v1/ea/commands/[id]/ack`
- `POST /api/v1/ea/commands/[id]/result`
- `POST /api/v1/ea/autonomous-strategy/can-trade`

## Diagnóstico admin

`GET /api/admin/real-trading/ea-liveness/trace?licenseId=...`

## HEALTH_CHECK

Comando operacional **sem risco**: não envia ordem, não cria instruction, não altera approval/config.

Fluxo: admin → `POST /api/admin/real-trading/operations/commands` (`commandType=HEALTH_CHECK`) → EA poll → ACK → snapshot + DailyRisk + heartbeat → RESULT.

Duplicidade: se já existe `HEALTH_CHECK` `PENDING`/`ACKED`, retorna o existente.

## Can-trade

Liveness bloqueia com `EA_OFFLINE_NO_RECENT_ACTIVITY` / `EA_LIVENESS_UNRESPONSIVE` — **separado** do DailyRisk.

Quando o DailyRisk do pregão está `OK_FOR_DAY`, EA offline retorna `EA_OFFLINE_WITH_DAILY_RISK_OK_FOR_DAY` (não `DAILY_RISK_REPORT_STALE`).

## DailyRisk vs Liveness

- **HEALTH_CHECK** valida vida do EA e força snapshot + DailyRisk — não substitui heartbeat contínuo.
- **DailyRisk** valida risco do pregão; report antigo sem posição/pendentes/eventos permanece `OK_FOR_DAY` (ver `docs/DAILY-FINANCIAL-STOP-GUARD.md`).

Usa o mesmo `resolveEaLiveness()`. Não bloqueia por heartbeat stale se snapshot/DailyRisk/poll recentes (`DEGRADED` continua permitido). Bloqueia em `OFFLINE`, `UNRESPONSIVE` e `CHECKING`.
