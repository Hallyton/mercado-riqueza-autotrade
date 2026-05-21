# Autenticação

## Stack

- **Auth.js** (NextAuth v5) com provider **Credentials** (email + senha)
- Sessão **JWT** em cookie httpOnly (seguro em produção com `AUTH_URL` HTTPS)
- Papéis na sessão: `appRole` = `ADMIN` | `CLIENT` (mapeados desde `UserRole` do Prisma)

## Variáveis de ambiente

```env
AUTH_SECRET=   # openssl rand -base64 32
AUTH_URL=http://localhost:3000
DATABASE_URL=...
```

## Rotas

| Rota | Acesso |
|------|--------|
| `/` | Público (landing) |
| `/login` | Público |
| `/dashboard` | Apenas `CLIENT` |
| `/admin` | Apenas `ADMIN` |
| `/admin/strategy`, `/api/internal` | Apenas `ADMIN` (bloqueio extra; vault fora do app) |

## Admin inicial

Use o seed (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) — role `SUPERADMIN` → `appRole` **ADMIN**.

## Cliente de teste

Crie um usuário com `role: CLIENT` no banco ou via Prisma Studio para testar `/dashboard`.
