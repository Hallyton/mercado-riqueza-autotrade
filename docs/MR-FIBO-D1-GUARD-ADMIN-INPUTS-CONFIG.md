# MR Fibo D1 Guard — Admin Inputs Configuration

**Fase:** 15.3  
**Status:** `MR_FIBO_D1_GUARD_ADMIN_INPUTS_CONFIG_IMPLEMENTED`

## Objetivo

Permitir que administradores configurem parâmetros operacionais da estratégia **MR Fibo D1 Guard** por licença/RobotInstance, com versionamento, auditoria e entrega segura ao EA Executor — sem expor lógica ao cliente.

## Centro operacional (Fase 15.4)

- **Tela:** `/admin/real-trading/fibo-d1-guard` — status, elegibilidade, config publicada, decisões.
- Edição detalhada continua em `/admin/licenses/[licenseId]/strategy-config`.

## Rota admin (config por licença)

- **Tela:** `/admin/licenses/[licenseId]/strategy-config`
- **Entrada:** card **Estratégia autônoma** na licença → botão **Configurar parâmetros**

## Grupos de inputs (12)

1. Identificação (readonly: código, magic, maxContracts)
2. Estratégia Fibo D1 — percentual fibo
3. Gestão de risco — lote total, stop pontos
4. Parciais e trailing
5. Horários operacionais
6. Execução e spread
7. Dólar B3 / normalização
8. Segurança / ambiente (políticas readonly)
9. Visual no gráfico
10. Painel administrativo
11. Stop financeiro diário (resumo + link)
12. Publicação / versão

## Persistência

- `StrategyRuntimeConfig` — DRAFT / PUBLISHED / ARCHIVED
- `StrategyRuntimeConfigHistory` — auditoria por ação
- Regra: uma config **PUBLISHED** ativa por `licenseId` + `strategyCode`

## API admin (somente ADMIN)

| Método | Rota |
|--------|------|
| GET | `/api/admin/licenses/[licenseId]/strategy-config` |
| POST | `/api/admin/licenses/[licenseId]/strategy-config/draft` |
| POST | `/api/admin/licenses/[licenseId]/strategy-config/publish` |
| POST | `/api/admin/licenses/[licenseId]/strategy-config/reset-default` |
| POST | `/api/admin/licenses/[licenseId]/strategy-config/archive` |
| GET | `/api/admin/licenses/[licenseId]/strategy-config/history` |

## Entrega ao EA

`GET /api/v1/ea/config` retorna quando estratégia habilitada e config publicada:

- `strategy_config_version`
- `strategy_config_hash`
- `strategy_config` (snake_case, sem secrets)

Se estratégia desabilitada: campos `null`.

## MQL5

- `MR_FiboD1_Config.mqh` — struct + parser
- `MR_Strategy_FiboD1_Guard.mqh` — usa `g_mr_fibo_config`
- REAL sem config publicada: `STRATEGY_CONFIG_MISSING`
- Hash alterado: `STRATEGY_CONFIG_UPDATED` (version + hash parcial no log)

## AuditLog / AdminAction

- `strategy_config.draft_saved`
- `strategy_config.published`
- `strategy_config.reset_default`
- `strategy_config.archived`

Metadata: `licenseId`, `robotInstanceId`, `strategyCode`, hashes, version, adminId.

## Caixa preta

- **Cliente:** vê apenas “Estratégia ativa” / stop diário — sem parâmetros internos.
- **Admin:** edita parâmetros na tela acima.
- **EA:** recebe config publicada; logs em REAL não imprimem JSON completo.

## Regras operacionais

- Alterar/publicar config **não** dispara ordem nem instruction.
- Gates existentes permanecem: licença, pagamento, device REAL, heartbeat, approval, PRE_MARKET, margem, stop diário, RealTradingGuard.
