# Assinatura e licença

## Planos (seed)

| Slug | Nome |
|------|------|
| `start` | Start |
| `pro` | Pro |
| `black` | Black |

## APIs

### Webhook pagamento

`POST /api/webhooks/billing`

Header: `x-webhook-secret: <BILLING_WEBHOOK_SECRET>`

Em **produção** (`NODE_ENV=production`), `BILLING_WEBHOOK_SECRET` é obrigatório (validação em `lib/env/critical.ts` no boot). Sem secret configurado, a aplicação falha ao iniciar e webhooks retornam `503 WEBHOOK_MISCONFIGURED`.

```json
{
  "id": "evt_unique_id",
  "type": "payment.approved",
  "gateway": "asaas",
  "data": {
    "subscriptionId": "clxxx",
    "userId": "clxxx",
    "planSlug": "pro",
    "amountCents": 19900,
    "periodEnd": "2026-06-20T00:00:00.000Z"
  }
}
```

Tipos: `payment.approved`, `payment.failed`, `subscription.renewed`, `subscription.cancelled`, `chargeback`

### Status da licença

`GET /api/licenses/:licenseId/status` (sessão do dono ou admin)

### Assinatura do cliente

`GET /api/me/subscription`

## Regras operacionais

- **Novas entradas:** bloqueadas se assinatura/licença inativa (`haltNewEntries`).
- **Posição aberta:** gestão (`EXIT` / `ADJUSTMENT`) permitida em `SUSPENDED` (ex.: inadimplência).
- Toda mudança relevante gera registro em `audit_logs`.

## Telas

- Cliente: `/dashboard/assinatura` — vincular MT5 e gerar código de ativação (15 min)
- Admin: `/admin/clientes`

## APIs cliente (sessão)

- `POST /api/me/licenses/:licenseId/mt5-account` — body `{ "login", "server", "broker_name"? }`
- `POST /api/me/licenses/:licenseId/activation-code` — retorna `{ code, expiresAt }`

## Uso em código (instruções futuras)

```typescript
import { assertInstructionAllowed } from "@/lib/licensing/instruction-policy";
await assertInstructionAllowed(licenseId, InstructionPurpose.ENTRY);
```
