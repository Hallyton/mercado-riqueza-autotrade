# Fase 12.4 — Controlled Real Pilot Dry Run — Resultados

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Data:** 2026-05-27  
**Branch:** `staging-vps-homologacao`  
**Commit de referência:** `149d3a7` (código EA/API); este relatório em commit `docs: record controlled real pilot dry run`.

---

## 1. Objetivo

Validar em **staging/homologação** o fluxo de **conta real controlada** **sem enviar ordem real** ao mercado: migrations, gate condicional, snapshots, protection reports, preflight, admin UI e EA MQL5 (compilação/instalação manual na VPS).

**Regra absoluta desta fase:** nenhuma ordem real; `InpDebugMode=true` ou equivalente na VPS; dispatch automático off; REAL global off.

---

## 2. Ambiente

| Item | Valor |
|------|--------|
| Branch | `staging-vps-homologacao` |
| URL homologação | https://autotrade-staging.mercadodariqueza.com.br |
| Preview Vercel (último deploy 12.3) | https://mercado-riqueza-autotrade-staging-7ohhneudx-hallyton-s-projects.vercel.app |
| Banco staging remoto (Neon/Vercel) | **Não acessível** via `vercel env pull` neste ambiente — migration remota **pendente confirmação** (ver §3) |
| Banco local `.env` | `localhost` — migrations OK; **não é** o mesmo banco do deploy staging |
| Deploy produção staging | `dpl_7kNHzVcpUgHW4CxYEj1ASPDnSRRR` — alias `autotrade-staging.mercadodariqueza.com.br` |

---

## 3. Migration staging

### Tentativa remota

- `vercel env pull` (preview + branch `staging-vps-homologacao`): variáveis `DATABASE_URL`, `POSTGRES_*` retornaram **vazias** (len=0) — não foi possível executar `npx prisma migrate deploy` no PostgreSQL **remoto** de staging a partir desta máquina sem copiar o secret manualmente para o shell.
- **Nenhum** `DATABASE_URL` foi impresso; **nenhum** arquivo `.env` novo foi commitado.

### `migrate deploy` local (2026-05-29)

Com `APPLY_MIGRATE=1` e `DATABASE_URL` do `.env` local:

- `npx prisma migrate deploy` → **No pending migrations to apply**
- Migrations `20260529014145` e `20260529024342` registradas no banco local

### Verificação local (referência de migrations)

Com `DATABASE_URL` do `.env` local (dev), script `node scripts/homologation/verify-staging-real-trading-schema.mjs`:

| Verificação | Resultado |
|-------------|-----------|
| `real_trading_approvals` | OK |
| `account_snapshots` | OK |
| `real_trade_preflights` | OK |
| `execution_protection_reports` | OK |
| `terms_acceptances` | OK |
| `20260529014145_real_trading_controlled_pilot` | OK |
| `20260529024342_conditional_real_trading_gate` | OK |

### Ação operacional pendente (staging remoto)

No shell do operador (sem commitar `.env`):

```powershell
$env:DATABASE_URL="VALOR_DO_NEON_OU_VERCEL"
npx prisma migrate deploy
npx prisma generate
Remove-Item Env:DATABASE_URL
```

Ou: `APPLY_MIGRATE=1 node scripts/homologation/verify-staging-real-trading-schema.mjs` com `DATABASE_URL` já exportado.

---

## 4. Compilação EA MQL5

| Critério | Status |
|----------|--------|
| MetaEditor / MT5 na VPS | **Pendente — manual** |
| Arquivos | `MR_AutoTrade_Executor.mq5`, `MR_AT_{Constants,Execution,Signal,RealTrading}.mqh` |
| 0 erros de compilação | **Não verificado** (sem MetaEditor neste ambiente CI) |
| `.ex5` gerado e instalado na VPS | **Pendente** |

**Checklist VPS (operador):**

1. Copiar pasta `ea/mql5/` para `MQL5/Experts/`.
2. Compilar `MR_AutoTrade_Executor.mq5` no MetaEditor.
3. Confirmar **0 erros**; revisar warnings.
4. Anexar EA no gráfico da conta de homologação.

---

## 5. Configuração VPS/MT5 (sem ordem real)

| Item | Esperado |
|------|----------|
| `InpApiBaseUrl` | `https://autotrade-staging.mercadodariqueza.com.br` (ou preview Vercel se alias desatualizado) |
| WebRequest | URL staging na lista de permissões do terminal |
| `InpDebugMode` | **`true`** — não enviar `OrderSend` real nesta fase |
| `InpSendPreMarketOnInit` | `true` em conta REAL de teste |
| `InpSendPostMarketOnDeinit` | opcional `true` ao encerrar sessão |
| Activation / device | Código do dashboard; **não** logar token |
| Conta / servidor | Iguais à licença e `RealTradingApproval` |
| Magic | Vem da **instruction** (`magic_number`), não input do cliente |

---

## 6. Snapshots (validação)

### Automatizada (schemas + contrato MQL5)

- `tests/ea/schemas-snapshot-protection.test.ts` — payloads `PRE_MARKET`, `PRE_TRADE`, `POST_MARKET`.
- `tests/ea/mql-contracts.test.ts` — endpoints e rotinas PRE_MARKET/POST_MARKET no EA.

### Staging HTTP — rotas publicadas (pós-redeploy forçado)

| Rota | Sem Bearer | Com Bearer inválido |
|------|------------|---------------------|
| `POST /api/v1/ea/account-snapshots` | **401** `MISSING_TOKEN` | **401** (token inválido) |
| `POST /api/v1/ea/execution-protection` | **401** `MISSING_TOKEN` | **401** (token inválido) |

Headers: `X-Matched-Path` confirma handler Next.js no domínio custom. **404 resolvido** (causa: deploy de produção desatualizado; correção: `vercel deploy --prod --force`).

### Staging HTTP — autenticado (2026-05-30)

| Rota / cenário | Resultado |
|----------------|-----------|
| `POST /api/v1/ea/account-snapshots` `{}` + Bearer válido | **400** `VALIDATION_ERROR` |
| `POST /api/v1/ea/account-snapshots` `PRE_MARKET` + Bearer válido | **200 OK** |
| Snapshot salvo (staging Neon) | `snapshot_id = cmprt2tuy003cky04jk39xfbl` |
| `POST /api/v1/ea/execution-protection` `{}` + Bearer válido | **400** `VALIDATION_ERROR` — *Verifique instruction_id, magic_number e protection_status.* |
| `X-Matched-Path` | Correto no domínio custom |
| `X-Device-Id` | **Opcional** (Bearer sozinho autentica) |

**Bearer:** token da VPS (`mr_at_52609973.dat`); **não** logar. **Dispatch automático:** desativado. **Ordem real:** nenhuma.

### E2E execution-protection dry-run (scripts)

Scripts (não imprimem secrets):

| Script | Função |
|--------|--------|
| `scripts/homologation/create-staging-protection-fixture.ts` | Instruction `HOMOLOGATION` dry-run (`magicNumber=910001`, `requiresProtectionConfirmation=true`) |
| `scripts/homologation/validate-staging-execution-protection.ts` | POST `PROTECTION_CONFIRMED` + `PROTECTION_FAILED` |
| `scripts/homologation/resolve-staging-ea-bearer.ts` | Bearer opcional via `mr_at_<login>.dat` (UTF-16) |

```powershell
# Shell do operador — exportar Neon staging (não commitar):
$env:STAGING_DATABASE_URL="<postgresql://...neon...>"
# Opcional: $env:STAGING_EA_BEARER_TOKEN="..."  # senão usa mr_at_*.dat local
npm run homolog:staging-protection-fixture
npm run homolog:validate-staging-protection
Remove-Item Env:STAGING_DATABASE_URL
```

| Cenário | Status |
|---------|--------|
| `PROTECTION_CONFIRMED` (200 + report salvo) | **Pendente** — exige fixture no Neon staging (`STAGING_DATABASE_URL`) |
| `PROTECTION_FAILED` (report + redaction) | **Pendente** — idem |
| Bloqueio `protectionBlocked` em FAILED | **Esperado só em `tradeMode=REAL`**; staging DEMO grava report sem bloquear instruction |
| Admin `/admin/real-trading/protection` | **Pendente** pós-reports E2E |

**Nota:** `vercel env pull` / `vercel env run` neste projeto retorna `DATABASE_URL` vazio (integração Neon); copiar URL do painel Neon/Vercel manualmente.

### E2E com EA (pendente)

Com EA compilado + token + `InpDebugMode=true`:

- Enviar `PRE_MARKET` → conferir em `/admin/real-trading/snapshots`.
- Opcional `PRE_TRADE` / `POST_MARKET`.
- **Não** validar entrada de mercado nesta fase.

---

## 7. Protection reports (validação)

### Automatizada

- `tests/risk/execution-protection.test.ts` — `PROTECTION_CONFIRMED`, `PROTECTION_FAILED`, redaction de `errorMessage`, bloqueio `protectionBlocked`.
- Staging: rota autenticada; payload `{}` → **400** `VALIDATION_ERROR` (2026-05-30).

### E2E staging (pendente — fixture Neon)

Com `STAGING_DATABASE_URL` + Bearer (VPS/`mr_at_*.dat`):

1. `npm run homolog:staging-protection-fixture` — cria 2 instructions `HOMOLOGATION` (confirmed/failed).
2. `npm run homolog:validate-staging-protection` — POST `PROTECTION_CONFIRMED` e `PROTECTION_FAILED`.
3. Conferir `/admin/real-trading/protection`, `/admin/real-trading/snapshots`, `/admin/real-trading/preflights`.

**Sem ordem real.** Dispatch automático off.

---

## 8. RealTradingApproval de teste

| Item | Status |
|------|--------|
| Criado no admin staging | **Pendente — manual** |

**Modelo recomendado** (admin `/admin/real-trading/approvals`):

- Licença/usuário de homologação existente
- `accountLogin` / `accountServer` = conta MT5 de teste
- `symbol` = ex. `WDOM26`
- `magicNumber` = `910001` (faixa 910001–910999)
- `maxContracts` = **1**
- `minFreeMargin` / `marginBufferPercent` conservadores
- `allowReal` = true, `status` = **APPROVED**

**Importante:** approval **sozinho** não libera operação real — ainda exige env (`ENABLE_REAL_TRADING`, allowlist), snapshot PRE_MARKET, preflight, EA online, protection OK e dispatch **manual**.

---

## 9. Bloqueios do gate (dry run)

Matriz validada em **`tests/risk/controlled-real-pilot-dry-run.test.ts`** (288 testes totais no projeto):

| Cenário | Resultado esperado | Teste |
|---------|-------------------|--------|
| A) Sem `ENABLE_REAL_TRADING` | BLOCKED (`ENV_NOT_ENABLED`) | OK |
| B) Sem allowlist | BLOCKED (`LICENSE_NOT_ALLOWLISTED`) | OK |
| C) Sem PRE_MARKET | BLOCKED (`SNAPSHOT_REQUIRED`) | OK |
| D) Margem insuficiente | BLOCKED (`MARGIN_INSUFFICIENT`) | OK |
| E) EA offline | BLOCKED (`EXECUTOR_OFFLINE`) | OK |
| F) Magic divergente | BLOCKED (`MAGIC_MISMATCH`) | OK |
| G) Protection failed anterior | BLOCKED (`PREVIOUS_PROTECTION_FAILED`) | OK |
| H) Todos critérios OK | Preflight **PASSED** (`ALLOWED_BY_CONTROLLED_GATE`) | OK |

**H + operação:** preflight apto **não** autoriza ordem real nesta fase — EA em **DebugMode**; Fase 12.5 tratará primeiro gate de ordem real explícito.

---

## 10. Cenário “todos OK” em dry run

- Preflight: **PASSED** (testes automatizados).
- Entrega de instruction REAL ao EA: só com gate + mocks/DB reais alinhados.
- **Nenhuma** ordem enviada ao mercado nesta fase.
- `isAutoDispatchEnabled()` = **false** (teste explícito).

---

## 11. Admin UI

| Página | Validação |
|--------|-----------|
| `/admin/real-trading/approvals` | **Pendente** pós-migration remota + login admin |
| `/admin/real-trading/snapshots` | **Parcial** — PRE_MARKET E2E salvo (`cmprt2tuy003cky04jk39xfbl`) |
| `/admin/real-trading/preflights` | **Pendente** |
| `/admin/real-trading/protection` | **Pendente** pós E2E `PROTECTION_CONFIRMED`/`FAILED` |

Após reports E2E: confirmar `PROTECTION_FAILED` visível, mensagens redigidas, sem secrets em HTML/API.

---

## 12. Incidentes

| # | Incidente | Impacto | Mitigação |
|---|-----------|---------|-----------|
| 1 | `vercel env pull` / `vercel env run` sem `DATABASE_URL` Neon | Migration remota não confirmada daqui | Operador copia URL do painel Neon/Vercel para o shell |
| 2 | Domínio custom **404** nas rotas EA novas | E2E bloqueado | **Resolvido** — `vercel deploy --prod --force` (§6) |
| 3 | Banco local ≠ banco staging | Token/código de ativação local não vale em staging | Usar token da VPS ou `STAGING_DATABASE_URL` |
| 4 | Login homolog staging → HTML em `/api/me/subscription` | Script dashboard não obtém activation code | Criar cliente homolog no Neon staging ou usar token VPS |
| 5 | EA não compilado na VPS | Snapshots/protection E2E pendentes | Compilar no MetaEditor (§4) |

---

## 13. Pendências

1. Exportar `STAGING_DATABASE_URL` (Neon) e rodar E2E protection (`homolog:staging-protection-fixture` + `homolog:validate-staging-protection`).
2. Compilar e instalar EA `.ex5` na VPS/MT5.
3. Criar `RealTradingApproval` de homologação no admin.
4. Validar admin UI protection/preflights com dados reais.
5. E2E snapshots/protection com EA em DebugMode (opcional além dos scripts HTTP).

---

## 14. Decisão final

**`APPROVED_WITH_RESTRICTIONS`**

| Critério | OK? |
|----------|-----|
| Gate / preflight / protection (testes) | Sim |
| Migrations (remoto staging) | **Não** |
| EA MQL5 compilado na VPS | **Não** |
| E2E staging snapshots/protection | **Parcial** — PRE_MARKET + auth OK; protection reports pendentes Neon fixture |
| Nenhuma ordem real | **Sim** (por desenho + DebugMode obrigatório) |
| Dispatch automático desativado | **Sim** |
| Caixa preta | **Sim** |

**Próxima etapa:** **Fase 12.5 — First Ultra-Controlled Real Order Gate** (somente com migration remota OK, EA compilado, E2E dry run completo e **autorização explícita** para uma ordem real ultra-controlada).

---

## Comandos úteis

```bash
npm test -- --run tests/risk/controlled-real-pilot-dry-run.test.ts
node scripts/homologation/verify-staging-real-trading-schema.mjs

# Staging — Bearer via mr_at_*.dat ou STAGING_EA_BEARER_TOKEN (não logar):
# STAGING_DATABASE_URL=... npm run homolog:staging-protection-fixture
# npm run homolog:validate-staging-protection
# npm run homolog:validate-staging-ea-routes
```
