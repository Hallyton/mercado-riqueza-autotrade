# Homologação em staging / VPS — Mercado da Riqueza AutoTrade

Checklist e orientações para repetir a homologação ponta a ponta **aprovada localmente** ([`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md)) em um ambiente **staging dedicado**, com EA no MetaTrader em VPS e API em URL pública HTTPS.

**Branch de referência:** `staging-vps-homologacao`

---

## Isolamento: AutoTrade × DARF × produção

| Ambiente | Escopo | Regra |
|----------|--------|--------|
| **DARF** | Outro endereço / outro projeto / outro deploy | O AutoTrade **não** altera rotas, middleware, landing, auth nem banco da DARF. |
| **Staging AutoTrade** | Deploy, banco e secrets **próprios** | URL exemplo: `https://autotrade-staging.seudominio.com` — separado de produção e da DARF. |
| **Produção AutoTrade** | Clientes reais | **Não** usar este checklist em produção sem gate de release formal. |

---

## Pré-requisitos de infraestrutura

### Deploy staging separado

- [ ] Aplicação Next.js (AutoTrade) em host/VPS ou PaaS **dedicado a staging**.
- [ ] Domínio ou subdomínio público com **TLS válido** (Let's Encrypt ou certificado gerenciado).
- [ ] `AUTH_URL` apontando para a URL pública exata (sem barra final inconsistente).
- [ ] Firewall: porta 443 aberta para clientes web; EA usa apenas HTTPS.
- [ ] Logs e backups do **banco staging** separados do banco de produção.

### Banco staging separado

- [ ] Instância PostgreSQL **exclusiva** (não compartilhar `DATABASE_URL` com produção).
- [ ] Credenciais e volume de backup distintos.
- [ ] Nenhum dado de cliente real de produção copiado sem política de anonimização (recomendado: banco vazio + seed/homolog).

---

## Variáveis de ambiente obrigatórias (staging)

Configurar no painel do provedor (Vercel, VPS, Docker, etc.) ou em `.env` **somente no servidor staging** — nunca commitar valores reais.

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `DATABASE_URL` | Sim | PostgreSQL **staging** (`postgresql://...`) |
| `AUTH_SECRET` | Sim | Secret forte (ex.: `openssl rand -base64 32`); Auth.js / NextAuth |
| `AUTH_URL` | Sim | URL pública do staging, ex.: `https://autotrade-staging.seudominio.com` |
| `BILLING_WEBHOOK_SECRET` | Sim | Secret para validar `POST /api/webhooks/billing` (obrigatório se `NODE_ENV=production` no staging) |
| `ADMIN_EMAIL` | Sim | Admin inicial (seed) |
| `ADMIN_PASSWORD` | Sim | Senha do admin (seed; mínimo seguro) |
| `ADMIN_NAME` | Sim | Nome exibido do admin (seed) |

### Variáveis recomendadas (homologação / operação)

| Variável | Uso |
|----------|-----|
| `NODE_ENV` | Em deploy staging costuma ser `production` (build otimizado); ver nota sobre scripts `homolog:*` abaixo. |
| `HOMOLOG_CLIENT_EMAIL` | Email do cliente de teste (scripts em [`docs/HOMOLOGATION.md`](HOMOLOGATION.md)) |
| `HOMOLOG_CLIENT_PASSWORD` | Senha do cliente de teste |
| `HOMOLOG_CLIENT_NAME` | Nome do cliente de teste |
| `HOMOLOG_PLAN_SLUG` | Slug do plano, ex.: `start` |

### Validação em produção/staging (`NODE_ENV=production`)

A aplicação valida em boot (`lib/env/critical.ts`):

- `DATABASE_URL`, `AUTH_SECRET` e `BILLING_WEBHOOK_SECRET` presentes e sem placeholders de exemplo.
- Ausência de `BILLING_WEBHOOK_SECRET` impede subida em produção — configurar **antes** do primeiro deploy staging.

---

## `allow_demo` — somente staging / local

| Ambiente | `plans.allow_demo` |
|----------|-------------------|
| **Produção** | `false` por padrão (seed). **Nunca** habilitar automaticamente em deploy de produção. |
| **Staging / local** | Pode ser `true` **manualmente** para testar conta MT5 **demo** (`trade_mode: DEMO` no heartbeat). |

**Como habilitar em staging (escolha uma):**

1. **Script local** (máquina do operador apontando `DATABASE_URL` do banco staging):
   ```bash
   # NODE_ENV não pode ser "production" nos scripts homolog:*
   set NODE_ENV=development
   set DATABASE_URL=postgresql://...staging...
   set HOMOLOG_PLAN_SLUG=start
   npm run homolog:enable-demo
   ```
2. **Prisma Studio / SQL** no banco staging:
   ```sql
   UPDATE plans SET allow_demo = true WHERE slug = 'start';
   ```

**Reverter após testes:**

```bash
npm run homolog:disable-demo
```

ou `allow_demo = false` no plano.

Os scripts em `scripts/homologation/` **abortam** se `NODE_ENV=production` — isso protege produção; no staging com `NODE_ENV=production`, rode os scripts a partir de uma sessão com `NODE_ENV=development` (ou ajuste manual no banco).

---

## EA na VPS / MetaTrader — URL pública

O EA **não** pode usar `localhost`. Toda comunicação HTTPS deve ir para o host de staging.

| Input EA | Valor staging (exemplo) |
|----------|-------------------------|
| `InpApiBaseUrl` | `https://autotrade-staging.seudominio.com` |
| `InpActivationCode` | Código gerado no dashboard (`/dashboard/assinatura`) |
| `InpDeviceId` | Opcional; vazio = auto (`mt5-<login>-<server>`) |
| `InpDebugMode` | `true` na homologação (sem ordens reais; reporta `FILLED` com ticket `DEBUG`) |
| `InpLogLevel` | `2` durante homologação (logs de pull/parse/executions) |

### WebRequest no MetaTrader (obrigatório)

Em **Ferramentas → Opções → Expert Advisors**:

- [ ] Marcar *Permitir WebRequest para as URLs listadas abaixo*
- [ ] Adicionar exatamente a origem do staging, ex.:
  - `https://autotrade-staging.seudominio.com`

Sem isso, heartbeat e pull retornam erro de WebRequest no terminal.

### Compilação e instalação

1. Copiar `ea/mql5/` para `MetaTrader 5/MQL5/Experts/` (manter pasta `includes/`).
2. Compilar `MR_AutoTrade_Executor.mq5` no MetaEditor.
3. Anexar o EA ao gráfico na VPS com os inputs acima.

Contrato da API: [`docs/EA-API.md`](EA-API.md).

---

## Checklist de homologação staging / VPS

Marque na ordem sugerida. Objetivo: equivaler aos 18 itens de [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md).

### Fase A — Plataforma

- [ ] **A1.** Deploy staging separado publicado (URL HTTPS acessível).
- [ ] **A2.** Banco staging separado provisionado; `DATABASE_URL` configurada no deploy.
- [ ] **A3.** Variáveis obrigatórias definidas (`AUTH_SECRET`, `AUTH_URL`, `BILLING_WEBHOOK_SECRET`, `ADMIN_*`).
- [ ] **A4.** `npx prisma migrate deploy` contra o banco **staging** (no servidor ou CI com secret staging).
- [ ] **A5.** `npm run db:seed` (planos + admin) no banco staging.
- [ ] **A6.** `npm run homolog:create-client` (com `DATABASE_URL` staging; ver nota `NODE_ENV`).
- [ ] **A7.** `npm run homolog:create-subscription` → assinatura `ACTIVE` + licença `ACTIVE`.
- [ ] **A8.** `npm run homolog:enable-demo` (ou SQL) se a conta MT5 for **demo**.
- [ ] **A9.** `npm run homolog:summary` — anotar `licenseId`, email do cliente, status.

### Fase B — Cliente web

- [ ] **B1.** Login em `https://autotrade-staging.seudominio.com/login` (cliente homolog).
- [ ] **B2.** `/dashboard/assinatura` — vincular MT5 demo (login + server iguais aos usados no terminal VPS). Se digitou conta errada, use **Alterar conta MT5** e reative o EA com novo código.
- [ ] **B3.** Gerar código de ativação; guardar para o EA.

### Fase C — EA na VPS

- [ ] **C1.** WebRequest liberado para URL de staging.
- [ ] **C2.** `InpApiBaseUrl` = URL pública (sem `localhost`).
- [ ] **C3.** Ativar EA com `InpActivationCode`; confirmar licença no painel do gráfico.
- [ ] **C4.** **Validar heartbeat** — terminal: heartbeat OK; admin/dashboard: EA **online**.
- [ ] **C5.** Admin (`ADMIN_EMAIL`): `/admin/instrucoes` — criar instrução **TEST** (`ENTRY`, `MARKET`, símbolo disponível na demo, ex. futuro índice).
- [ ] **C6.** EA: logs `Instruções parseadas: 1` (ou mais) com `InpLogLevel=2`.
- [ ] **C7.** **Validar `POST /api/v1/ea/executions`** — terminal: `POST ... OK HTTP=200`; admin: status **EXECUTED** (DebugMode).
- [ ] **C8.** **Validar `halt_new_entries`** — `npm run homolog:halt-new` (contra DB staging); nova ENTRY TEST não deve concluir FILLED; `npm run homolog:resume-new`.
- [ ] **C9.** **Validar `halt_all_trading`** — `npm run homolog:halt-all`; execução bloqueada; `npm run homolog:resume-all`.

### Fase D — Encerramento

- [ ] **D1.** Estado final: licença `ACTIVE`, EA online, `halt_new_entries=false`, `halt_all_trading=false`.
- [ ] **D2.** Registrar resultado (data, URL staging, login MT5, `licenseId`) — atualizar ou anexar seção em `HOMOLOGATION-RESULTS.md` quando aprovado.
- [ ] **D3.** (Opcional) `homolog:disable-demo` se staging compartilhar mesmo slug de plano que um futuro ambiente mais restrito.

---

## Critérios de sucesso (paridade com local)

| # | Critério |
|---|----------|
| 1 | Cliente + assinatura + licença `ACTIVE` no banco staging |
| 2 | MT5 demo vinculado; `allow_demo=true` apenas se conta for demo |
| 3 | Heartbeat 200 e EA online no admin |
| 4 | Instrução TEST → pull → parse → DebugMode → POST executions 200 → **EXECUTED** |
| 5 | Halts `halt_new_entries` e `halt_all_trading` testados e revertidos |

---

## Troubleshooting rápido (staging)

| Sintoma | Verificar |
|---------|-----------|
| EA offline | WebRequest URL; token; `InpApiBaseUrl`; firewall 443 |
| HTTP 403 em `/instructions` | Login/server no GET devem coincidir com MT5 vinculado na licença |
| Instrução presa em **SENT** | EA antigo sem parser corrigido — recompilar EA; ou POST executions idempotente |
| Heartbeat `pendentes` ≠ pull | Deploy com correção de fila entregável (`lib/ea/instructions.ts`) |
| Demo rejeitada | `allow_demo=true` no plano staging |
| Scripts homolog abortam | `NODE_ENV=production` — rodar com `NODE_ENV=development` apontando `DATABASE_URL` staging |
| Boot falha no deploy | `BILLING_WEBHOOK_SECRET` e `AUTH_SECRET` definidos |

---

## O que não fazer neste ambiente

- Não apontar staging para banco ou domínio de **produção** AutoTrade.
- Não misturar deploy/config da **DARF**.
- Não habilitar `allow_demo` em produção “para testar”.
- Não usar `InpDebugMode=false` na primeira homologação VPS (validar fluxo simulado antes de ordens reais).

---

## Referências

| Documento | Conteúdo |
|-----------|----------|
| [`docs/HOMOLOGATION.md`](HOMOLOGATION.md) | Scripts `homolog:*` e fluxo local |
| [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md) | Homologação local aprovada (baseline) |
| [`docs/EA-API.md`](EA-API.md) | Contrato REST do EA |
| [`AGENTS.md`](../AGENTS.md) | Regras de produto (caixa preta, halts, auditoria) |

---

## Próximo passo após aprovação staging

1. Homologação com conta demo real fora do operador local (cliente/VPS distinto).
2. Testes de assinatura vencida, troca de plano e `max_devices`.
3. Gate de produção com secrets e `allow_demo=false` garantidos no seed/deploy.

---

*Documentação operacional — branch `staging-vps-homologacao`. Sem alteração de código, schema ou DARF.*
