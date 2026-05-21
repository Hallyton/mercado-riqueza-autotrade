# Banco de dados — Prisma

## Setup

```bash
cp .env.example .env
# Edite DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD (mín. 12 caracteres)

npm install
npx prisma migrate deploy   # ou: npx prisma migrate dev
npx prisma db seed
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run db:generate` | Gera `@prisma/client` |
| `npm run db:migrate` | Migration em desenvolvimento |
| `npm run db:migrate:deploy` | Aplica migrations em produção |
| `npm run db:seed` | Planos Start/Pro/Black + perfis + admin |
| `npm run db:studio` | Prisma Studio |

## Seed

- **Planos:** `start`, `pro`, `black`
- **Perfis de exposição:** conservador, moderado, agressivo (rótulos comerciais — sem estratégia)
- **Admin:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (opcional)

Não há seed de vault/estratégia (modelo caixa preta).

## Tipos TypeScript

Importar de `@/lib/types` ou `@/lib/types/database`.

## Vault de estratégia

Tabelas `strategy_*` **não** estão neste schema. Previsto DB/processo isolado na versão Pro (`MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md` §9.1).
