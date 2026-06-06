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

1. Identificação (readonly: limite operacional aprovado, magic, conta)
2. Estratégia Fibo D1 — percentual fibo
3. Gestão de risco — **contratos configurados na estratégia** (loteTotal), stop pontos
4. Parciais e trailing
5. Horários operacionais
6. Execução e spread
7. Dólar B3 / normalização
8. Segurança / ambiente (políticas readonly)
9. Visual no gráfico
10. Painel administrativo
11. Stop financeiro diário (resumo + link)
12. Publicação / versão

## Limite operacional aprovado vs contratos da estratégia

**MaxContracts** é uma trava operacional da licença/aprovação REAL e **não** deve ser editado na tela de parâmetros da estratégia.

- Campo readonly: **Limite operacional aprovado** (vem da aprovação REAL / fallback 1).
- Campo editável: **Contratos configurados na estratégia** (`loteTotal`).

Se `loteTotal > maxContracts`, a publicação é bloqueada com `LOT_TOTAL_EXCEEDS_MAX_CONTRACTS`. O admin pode:

1. Aumentar o limite na **aprovação de conta real** (`/admin/real-trading/approvals/[id]`) — ver seção abaixo.
2. Reduzir `loteTotal` na strategy-config (botão “Reduzir contratos para N” altera só o formulário local).

### Edição controlada do limite operacional REAL

**Status:** `REAL_TRADING_APPROVAL_LIMIT_EDIT_IMPLEMENTED`

Quando já existe aprovação REAL ativa para a chave única (`licenseId` + `accountLogin` + `accountServer` + `symbol` + `magicNumber`), **não** crie outra aprovação — edite a existente.

| Item | Detalhe |
|------|---------|
| Tela | `/admin/real-trading/approvals/[approvalId]` — card **Limite operacional** |
| API | `PATCH /api/admin/real-trading/approvals/[approvalId]` |
| Editáveis | `maxContracts`, `marginFreeMin`, `marginBufferPercent`, `adminNotes` |
| Readonly | `licenseId`, conta, servidor, símbolo, `magicNumber`, `status` |
| Confirmação | Digitar exatamente: `ALTERAR LIMITE OPERACIONAL REAL` |
| Audit | `real_trading.approval.limit_updated` com valores previous/current |
| Segurança | Não envia ordem; não cria instruction; não altera estratégia |

Após aumentar `maxContracts`, a strategy-config passa a exibir o novo **Limite operacional aprovado** e permite publicar `loteTotal` até esse teto (desde que stop financeiro, parciais e demais validações OK). O centro operacional (`/admin/real-trading/fibo-d1-guard`) deixa de bloquear por `LOT_TOTAL_EXCEEDS_MAX_CONTRACTS` quando regularizado.

Conflitos na criação (`ACTIVE_APPROVAL_CONFLICT`, `APPROVAL_ALREADY_EXISTS`) linkam para a aprovação existente via **Abrir aprovação existente**.

Rascunho pode ser salvo acima do limite; **publicar** exige regularização.

A tela também exibe **risco estimado por stop** (`loteTotal × stopPontos × valorPorPonto`) e compara com o stop financeiro diário.

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
