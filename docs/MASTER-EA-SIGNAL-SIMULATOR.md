# Simulador HTTP/CLI — EA Mãe (Master Signal)

Ferramenta local para enviar sinais mestres ao endpoint `POST /api/master/signals` **sem** o EA Mãe MQL5 e **sem** o MetaTrader. O dispatch para clientes continua **manual** no painel admin (`/admin/master-signals`).

## Objetivo

- Testar payloads válidos e inválidos.
- Validar idempotência e conflito (409).
- Homologar o fluxo intake → admin trigger → tracking.
- Evitar depender do MT5 nesta fase.

**Não é** o EA Mãe em produção. **Não** cria `Instruction` nem dispara clientes automaticamente.

## Variáveis de ambiente (local — nunca commitar)

PowerShell:

```powershell
$env:MASTER_SIGNAL_API_URL = "https://autotrade-staging.mercadodariqueza.com.br"
$env:MASTER_EA_API_SECRET = "<cole aqui o secret de staging>"
```

- `MASTER_SIGNAL_API_URL` — base HTTPS do ambiente (sem barra final).
- `MASTER_EA_API_SECRET` — mesmo secret configurado na Vercel (`MASTER_EA_API_SECRET` no servidor).

Não colar o secret no chat, em prints ou em commits.

## Dry-run

Valida argumentos e mostra payload redigido **sem** HTTP:

```powershell
npm run master:signal -- --id sim-dry-001 --symbol WDOM26 --dry-run
```

Saída inclui URL alvo e `Authorization: Bearer ***REDACTED***`.

## Enviar sinal para staging

```powershell
npm run master:signal -- `
  --id sim-master-001 `
  --symbol WDOM26 `
  --side BUY `
  --order-type MARKET `
  --purpose ENTRY `
  --profile conservador `
  --expires 300
```

Defaults:

- `source` = `MASTER_EA`
- `expires` = `300`
- `idempotency_key` = `<id>-key` (ex.: `sim-master-001-key`)

Respostas esperadas:

| HTTP | Significado |
|------|-------------|
| 201 | Criado — `VALIDATED`, `dispatch: NOT_STARTED` |
| 200 + `idempotent: true` | Retry idempotente |
| 409 | Conflito de payload/idempotency |
| 400 | Validação Zod |
| 401 / 503 | Auth ou secret não configurado no servidor |

## Testar idempotência

1. Enviar o mesmo comando duas vezes (mesmo `--id` e `--idempotency-key`).
2. Primeira vez: **201**.
3. Segunda vez: **200** com `idempotent: true`.
4. No painel admin: um único `MasterSignal`; dispatch só após clicar **Disparar para clientes**.

## Fluxo recomendado (homologação)

1. Simulador → `POST /api/master/signals` (NOT_STARTED).
2. Admin → `/admin/master-signals` — revisar tracking e elegibilidade.
3. Admin → **Disparar para clientes** (se necessário).
4. EA cliente em `DebugMode=true` — sem ordem real.

## Argumentos CLI

| Argumento | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `--id` | Sim | `master_signal_id` |
| `--symbol` | Sim | Símbolo |
| `--side` | Não | `BUY` / `SELL` (default BUY) |
| `--order-type` | Não | `MARKET`, `LIMIT`, etc. (default MARKET) |
| `--purpose` | Não | `ENTRY`, `EXIT`, `ADJUSTMENT` (default ENTRY) |
| `--profile` | Não | Ex.: `conservador` |
| `--expires` | Não | 5–300 segundos (default 300) |
| `--source` | Não | `MASTER_EA`, `ADMIN_TEST`, `SIMULATOR` (default MASTER_EA) |
| `--idempotency-key` | Não | Default `<id>-key` |
| `--dry-run` | Não | Só imprime payload seguro |

## Implementação

- Script: `scripts/master-signals/send-master-signal.ts`
- Lógica testável: `lib/master-signals/simulator.ts`
- Testes: `tests/master-signals/simulator.test.ts`
