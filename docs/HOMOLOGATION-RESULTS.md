# Resultado da homologação — Mercado da Riqueza AutoTrade

Registro formal da homologação ponta a ponta **aprovada** em ambiente local.

---

## Identificação

| Campo | Valor |
|-------|--------|
| **Data da homologação** | 22 de maio de 2026 |
| **Ambiente** | Local / desenvolvimento (`NODE_ENV=development`, `http://localhost:3000`) |
| **Branch** | `homologacao-ponta-a-ponta` |
| **Banco** | PostgreSQL local (via `DATABASE_URL` em `.env`) |
| **Referência operacional** | [`docs/HOMOLOGATION.md`](HOMOLOGATION.md), [`docs/EA-API.md`](EA-API.md) |

---

## Atores e contas utilizados

| Item | Detalhe |
|------|---------|
| **Cliente** | Usuário criado por `npm run homolog:create-client` (`HOMOLOG_CLIENT_EMAIL` / `HOMOLOG_CLIENT_NAME` no `.env`; padrão documentado: `cliente.homolog@example.com`, “Cliente Homologação”) |
| **Assinatura** | `ACTIVE`, plano `start` (`HOMOLOG_PLAN_SLUG`), gateway manual de homologação |
| **Licença** | `ACTIVE`, gerada por `npm run homolog:create-subscription` (IDs exatos: `npm run homolog:summary`) |
| **Conta MT5** | Login **52609973**, servidor **XPMT5-DEMO** (conta demo vinculada no dashboard) |
| **EA** | `MR_AutoTrade_Executor.mq5` v1.0.0, `InpApiBaseUrl=http://localhost:3000`, `InpDebugMode=true`, `InpLogLevel=2` |
| **Admin** | Usuário seed (`ADMIN_EMAIL`) — criação de instruções TEST em `/admin/instrucoes` |

**Nota:** `allow_demo=true` no plano `start` foi habilitado **somente** em homologação local via `npm run homolog:enable-demo` (não é estado de produção).

---

## Testes aprovados

Fluxo validado de ponta a ponta:

1. Cliente de homologação criado (`homolog:create-client`).
2. Assinatura `ACTIVE` criada (`homolog:create-subscription`).
3. Licença `ACTIVE` associada ao cliente.
4. Plano `start` com `allow_demo=true` apenas no ambiente local (`homolog:enable-demo`).
5. Conta MT5 vinculada: login **52609973**, server **XPMT5-DEMO**.
6. EA ativado no MetaTrader (código de ativação + WebRequest para localhost).
7. Heartbeat periódico com resposta HTTP 200 e registro no servidor.
8. Dashboard e painel admin exibindo EA **online**.
9. Admin criou instrução **TEST** (`ENTRY`, `MARKET`, símbolo de teste ex. **WDOM26**).
10. EA recebeu instrução via `GET /api/v1/ea/instructions`.
11. EA parseou corretamente o envelope JSON (`instructions[]` + `subscription_active`).
12. EA simulou execução em **DebugMode** (sem ordem real no broker).
13. EA enviou `POST /api/v1/ea/executions` com status `FILLED` (ticket `DEBUG`).
14. API respondeu **HTTP 200** e persistiu execução.
15. Painel admin atualizou instrução para **EXECUTED**.
16. Trava `halt_new_entries=true` bloqueou novas entradas (`homolog:halt-new`).
17. Trava `halt_all_trading=true` bloqueou execução total (`homolog:halt-all`).
18. Ambiente retomado com `halt_new_entries=false` e `halt_all_trading=false` (`homolog:resume-new`, `homolog:resume-all`).

---

## Problemas encontrados e correções aplicadas

Durante a homologação na branch `homologacao-ponta-a-ponta`, os seguintes pontos foram identificados e corrigidos antes da aprovação final:

| # | Problema | Correção |
|---|----------|----------|
| 1 | `BILLING_WEBHOOK_SECRET` ausente em produção | Validação em `lib/env/critical.ts` / boot — obrigatório em `NODE_ENV=production` |
| 2 | Rate limit EA incompleto | Escopos adicionais (`config`, `executions`, `ignore`, etc.) em `lib/ea/rate-limit.ts` |
| 3 | Scripts de homologação sem `DATABASE_URL` | `scripts/homologation/load-env.ts` com `@next/env` antes do Prisma |
| 4 | Migration inicial com BOM | BOM removido do arquivo de migration inicial |
| 5 | Admin gravava `take_profit`/`stop_loss` vazios como `0` | Campos opcionais no dispatch e formulário admin |
| 6 | `POST /executions` rejeitava `executed_at` formato MT5 | Normalização ISO 8601 UTC na API e no EA (`MR_AT_FormatExecutedAtIsoUtc`) |
| 7 | `pending_instructions` no heartbeat ≠ fila entregável em `/instructions` | Definição unificada em `lib/ea/instructions.ts` (candidatas + política + SENT sem execução) |
| 8 | EA não processava instruções após GET 200 (status ficava **SENT**) | Parser MQL5 corrigido: extração do objeto JSON com `{` **antes** de `instruction_id` (`MR_AT_JsonExtractInstructionObject`) |
| 9 | Retentativas de execução duplicavam registros | Idempotência em `reportExecution` — não cria segunda execution terminal para o mesmo `instruction_id` |

---

## Estado final esperado (após homologação)

| Componente | Estado |
|------------|--------|
| Licença | `ACTIVE` |
| Assinatura | `ACTIVE` |
| EA | **Online** (heartbeat recente) |
| `plans.allow_demo` (plano `start`) | `true` **somente** no banco local de homologação |
| `halt_new_entries` | `false` |
| `halt_all_trading` | `false` |
| Fila de instruções | Sem TEST preso em `SENT` sem execução (último ciclo concluiu em `EXECUTED`) |

---

## Escopo explicitamente fora desta homologação

- Ferramenta **DARF** (rota `/DARF`, deploy e auth próprios).
- Landing page pública (`/`).
- Produção, billing real e webhooks de gateway em ambiente live.
- Ordens reais no broker (homologação usou **DebugMode**).

---

## Próximas fases sugeridas

1. **Homologação em VPS** — EA e API em máquina dedicada; latência e firewall/WebRequest reais.
2. **Homologação com URL pública / deploy staging** — HTTPS, certificado válido, `InpApiBaseUrl` apontando para staging (não localhost).
3. **Teste com conta demo real fora do localhost** — MT5 em VPS ou desktop do cliente; validar login/server e símbolos (ex. futuros B3).
4. **Teste de expiração e cancelamento de assinatura** — bloqueio de novas entradas com gestão de posição aberta conforme `AGENTS.md`.
5. **Teste de troca de plano** — upgrade/downgrade e reflexo em `exposure_profile` / limites comerciais.
6. **Teste de limite de dispositivos** — `max_devices`, revogação de token, segundo EA na mesma licença.
7. **Preparação para produção** — checklist de secrets (`BILLING_WEBHOOK_SECRET`), rate limits, monitoramento, rollback e runbook operacional.

---

## Aprovação

| Papel | Situação |
|-------|----------|
| Homologação local ponta a ponta | **Aprovada** em 22/05/2026 |
| Branch de referência | `homologacao-ponta-a-ponta` |
| Próximo gate recomendado | Homologação em VPS + staging HTTPS (fase 1–2 acima) |

---

*Documento de registro — não substitui o checklist de produção nem o [`MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`](MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md).*
