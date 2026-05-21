# Homologação local — Mercado da Riqueza AutoTrade

Scripts auxiliares em `scripts/homologation/` para montar o fluxo ponta a ponta em **ambiente local/demo**, sem alterar regras de produção, billing real, schema ou migrations.

## Isolamento da ferramenta DARF

A ferramenta **DARF** (rota `/DARF`, páginas, APIs e deploy próprios) **não faz parte** desta homologação.

- Estes scripts **não** alteram rotas, middleware, landing ou qualquer artefato da DARF.
- **Não** misturam autenticação AutoTrade com DARF.
- Operam apenas no banco/usuários do AutoTrade via Prisma.

## Uso permitido

| Permitido | Proibido |
|-----------|----------|
| `NODE_ENV=development` (ou ausente) | `NODE_ENV=production` — scripts de escrita **abortam** |
| Banco PostgreSQL local de homologação | Produção / staging compartilhado com clientes reais |

## Variáveis de ambiente

Os scripts carregam automaticamente `.env`, `.env.local` e variantes via `@next/env` (`scripts/homologation/load-env.ts`) **antes** de conectar ao Prisma. Coloque `DATABASE_URL` e as variáveis `HOMOLOG_*` na raiz do projeto.

Configure no `.env` (export manual no shell só se necessário):

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
AUTH_URL="http://localhost:3000"

# Cliente de teste
HOMOLOG_CLIENT_EMAIL="cliente.homolog@example.com"
HOMOLOG_CLIENT_PASSWORD="senha-min-12-chars"
HOMOLOG_CLIENT_NAME="Cliente Homologação"

# Plano (slug do seed)
HOMOLOG_PLAN_SLUG="start"
```

Admin continua via seed (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Pré-requisitos

1. PostgreSQL rodando.
2. `npx prisma migrate deploy` e `npm run db:seed` (planos + admin).
3. `npm run dev` em outro terminal para testes web/EA.

## Ordem de execução

```bash
npm run homolog:create-client
npm run homolog:create-subscription
npm run homolog:enable-demo          # opcional — conta MT5 demo
npm run homolog:summary
```

## O que cada script faz

| Script | Ação |
|--------|------|
| `homolog:create-client` | Cria `User` role `CLIENT` (bcrypt 12). Se o email já existe, **não altera**. |
| `homolog:create-subscription` | Assinatura `ACTIVE` + licença via `activateSubscription` (gateway `manual`). |
| `homolog:enable-demo` | `plans.allow_demo=true` no slug informado — **só local**. |
| `homolog:disable-demo` | Reverte `allow_demo=false` no plano (opcional). |
| `homolog:summary` | Imprime resumo (somente leitura). |

## Validar resultado

1. `npm run homolog:summary` — `subscriptionId`, `licenseId`, status ACTIVE.
2. Login: `http://localhost:3000/login` com `HOMOLOG_CLIENT_EMAIL`.
3. `/dashboard/assinatura` — vincular MT5 e gerar código de ativação.
4. Admin: `/admin/instrucoes` — instrução `TEST` (SUPERADMIN/OPS).

## MT5 / EA (após scripts)

1. Compilar `ea/mql5/MR_AutoTrade_Executor.mq5`.
2. **Ferramentas → Opções → Expert Advisors** — WebRequest para `http://localhost:3000`.
3. Inputs: `InpApiBaseUrl=http://localhost:3000`, `InpActivationCode=<código>`, `InpDebugMode=true`.
4. Conta **demo** só funciona se `homolog:enable-demo` foi executado (`trade_mode: DEMO` no heartbeat).
5. Confirmar heartbeat e pull de instruções (`docs/EA-API.md`).

## Reverter `allow_demo` local

```bash
HOMOLOG_PLAN_SLUG=start npm run homolog:disable-demo
```

Ou no Prisma Studio: `plans.allow_demo = false` para o slug desejado.

O **seed** não é alterado; um novo `db:seed` pode redefinir planos conforme `prisma/seed.ts`.

## Referências

- Checklist: `MERCADO_DA_RIQUEZA_AUTOTRADE_CHECKLIST_VALIDACAO.md`
- API EA: `docs/EA-API.md`
- Licenciamento: `docs/SUBSCRIPTION-LICENSING.md`
