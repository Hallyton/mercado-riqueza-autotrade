# Guia — localização do `device_token` do EA Executor

**Status:** `EA_DEVICE_TOKEN_LOCATION_IDENTIFIED`  
**Branch:** `staging-vps-homologacao`  
**Objetivo:** indicar onde o token é gerado, persistido e reutilizado — **sem** expor secrets em logs, chat ou repositório.

---

## 1. Backend — geração e persistência

### Endpoint de ativação

| Item | Valor |
|------|--------|
| Rota | `POST /api/v1/ea/activate` |
| Handler | `app/api/v1/ea/activate/route.ts` |
| Serviço | `lib/ea/activate.ts` → `activateEaDevice()` |
| Auth | **Pública** (sem Bearer); rate limit `activate` |

### Fluxo

1. Cliente envia `activation_code`, `device_id`, opcional `fingerprint`, `ea_version`.
2. Código validado contra `ActivationCode.codeHash` (SHA-256 do código em texto).
3. Novo token: `generateOpaqueToken()` → 32 bytes aleatórios em **base64url** (`lib/ea/token.ts`).
4. Banco persiste **somente** `tokenHash = hashToken(deviceToken)` (SHA-256 hex).
5. Resposta JSON **única** com token em claro:

```json
{
  "device_token": "<opaque>",
  "license_id": "<cuid>",
  "device_id": "<string>",
  "license_status": "ACTIVE",
  "config": { ... }
}
```

### Modelos Prisma

| Modelo | Campo sensível | Conteúdo |
|--------|----------------|----------|
| `Device` | `tokenHash` | Hash SHA-256 — **não** reversível |
| `ActivationCode` | `codeHash` | Hash do código de ativação — **não** reversível |

### Token recuperável no admin?

**Não.** Após a ativação, o token puro **não** existe no PostgreSQL nem no painel admin. Para novo token:

- Gerar **novo** código no dashboard (`POST /api/me/licenses/{id}/activation-code`) — código exibido **uma vez** ao cliente.
- Reativar o EA com esse código → nova resposta com novo `device_token`.

Autenticação das demais rotas EA: `lib/ea/auth.ts` → `authenticateEaRequest()` compara `hashToken(Bearer)` com `Device.tokenHash`.

Rotas protegidas (incl. novas):

- `POST /api/v1/ea/account-snapshots` — `withEaAuth`
- `POST /api/v1/ea/execution-protection` — `withEaAuth`
- Demais `/api/v1/ea/*` (exceto `/activate`)

---

## 2. EA MQL5 — recepção e armazenamento local

### Recepção na ativação

| Arquivo | Função | Ação |
|---------|--------|------|
| `includes/MR_AT_License.mqh` | `MR_AT_Activate()` | `POST /api/v1/ea/activate` **sem** auth |
| | | Parse `device_token` e `license_id` do JSON |
| | | Chama `MR_AT_SaveCredentials()` |

### Arquivo local (token em claro)

| Item | Valor |
|------|--------|
| Função nome | `MR_AT_CredentialsFileName()` em `MR_AT_Auth.mqh` |
| Padrão | `mr_at_<ACCOUNT_LOGIN>.dat` |
| Exemplo | `mr_at_52609973.dat` |
| Flag FILE | `FILE_COMMON` (pasta **Common** compartilhada entre terminais MT5) |
| Formato | Linha 1: `device_token` · Linha 2: `license_id` (texto puro, UTF-8) |
| Leitura | `MR_AT_LoadCredentials()` no `OnInit` |
| Limpeza | `MR_AT_ClearCredentials()` em token inválido/revogado (apaga arquivo + GVs) |

### GlobalVariables MT5

`MR_AT_SaveCredentials()` também grava GVs `MR_AT_TOKEN_<login>_<server>` e `MR_AT_LICENSE_...` com valor `1.0` (**apenas flag**, não o token).

### `device_id` (header `X-Device-Id`)

Definido em `MR_AutoTrade_Executor.mq5`:

- Input `InpDeviceId`, ou
- Auto: `mt5-<login>-<server>`

Deve ser **o mesmo** enviado na ativação; mismatch → HTTP 403 `DEVICE_MISMATCH`.

---

## 3. Authorization Bearer nas chamadas EA

| Arquivo | Função | Comportamento |
|---------|--------|---------------|
| `MR_AT_Http.mqh` | `MR_AT_BuildHeaders()` | Se `with_auth=true`: `Authorization: Bearer ` + `g_device_token` |
| `MR_AT_License.mqh` | `MR_AT_ApiGetAuth` / `MR_AT_ApiPostAuth` | Retry após `INVALID_TOKEN` + reativação |
| `MR_AT_RealTrading.mqh` | snapshots / protection | Usa `MR_AT_ApiPostAuth` (mesmo auth) |
| `MR_AT_Heartbeat.mqh`, `MR_AT_Signal.mqh`, `MR_AT_Execution.mqh` | idem | `MR_AT_ApiPostAuth` |

Headers adicionais: `X-Device-Id`, `X-EA-Version`, `X-Request-Id`, `Content-Type: application/json`.

---

## 4. Risco de exposição em logs

| Superfície | Risco | Mitigação atual |
|------------|-------|-----------------|
| `MR_AT_Log*` | Token no Print | Testes estáticos: **não** concatenar `g_device_token` em logs (`tests/ea/mql-contracts.test.ts`) |
| Ativação | Código no log | Log genérico “Ativando EA…” — **não** imprime `activation_code` |
| HTTP errors | URL apenas | `MR_AT_WebRequest` loga URL, **não** headers |
| Backend audit | Metadados | `ea.device_activated` grava `deviceId`, **não** token |
| Admin / API | Listagem devices | Apenas `deviceId`, `lastSeenAt` — **sem** token |

**Risco residual:** operador abrir o `.dat` ou colar token em chat; arquivo local é **segredo operacional**.

---

## 5. Como localizar na VPS / MT5 (Windows)

Pasta **Common Files** do MetaTrader 5:

```
%APPDATA%\MetaQuotes\Terminal\Common\Files\
```

Arquivo esperado (substituir `<login>` pela conta MT5):

```
%APPDATA%\MetaQuotes\Terminal\Common\Files\mr_at_<login>.dat
```

Exemplo VPS:

```
C:\Users\<usuario_vps>\AppData\Roaming\MetaQuotes\Terminal\Common\Files\mr_at_52609973.dat
```

**Alternativa:** se o EA ainda não salvou credenciais, o token só existiu na resposta HTTP da ativação — gere novo código no dashboard e reative (token aparece **uma vez** na resposta; o EA salva automaticamente).

---

## 6. Uso temporário no PowerShell (sem expor no chat)

```powershell
# 1) Ler token do arquivo local (NÃO usar Write-Output / echo)
$tokenFile = Join-Path $env:APPDATA "MetaQuotes\Terminal\Common\Files\mr_at_<LOGIN>.dat"
if (-not (Test-Path $tokenFile)) { throw "Arquivo de credenciais não encontrado" }
$lines = Get-Content $tokenFile -TotalCount 2
$env:STAGING_EA_BEARER_TOKEN = $lines[0].Trim()
$env:STAGING_EA_DEVICE_ID = "mt5-<LOGIN>-<SERVER>"   # mesmo device_id da ativação

# 2) Testar rota (validação — body vazio deve retornar 400, não 401)
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" `
  -X POST "https://autotrade-staging.mercadodariqueza.com.br/api/v1/ea/account-snapshots" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $env:STAGING_EA_BEARER_TOKEN" `
  -H "X-Device-Id: $env:STAGING_EA_DEVICE_ID" `
  -d "{}"

# 3) Limpar variáveis de ambiente
Remove-Item Env:STAGING_EA_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:STAGING_EA_DEVICE_ID -ErrorAction SilentlyContinue
```

Ou script do repositório (não imprime token):

```powershell
$env:STAGING_EA_BEARER_TOKEN = (Get-Content $tokenFile -First 1).Trim()
npx tsx scripts/homologation/validate-staging-ea-routes.ts
Remove-Item Env:STAGING_EA_BEARER_TOKEN
```

### `device_id` (header `X-Device-Id`)

| Item | Detalhe |
|------|---------|
| Input MQL5 | `InpDeviceId` — **não** aparece como “EA_DEVICE_ID”; rótulo: *ID do dispositivo/VPS* |
| Se vazio | EA gera: `mt5-<ACCOUNT_LOGIN>-<ACCOUNT_SERVER>` (`MR_AT_ResolveDeviceId()`) |
| Enviado na ativação | Campo JSON `device_id` em `POST /api/v1/ea/activate` |
| Resposta ativação | Backend retorna `device_id` — EA **não** persiste no `.dat` (só `g_device_id` em memória) |
| Obrigatório nas rotas? | **Não** — header **opcional**; se ausente, auth usa só `tokenHash` |
| Se enviado errado | HTTP **403** `DEVICE_MISMATCH` (não `MISSING_DEVICE_ID`) |
| Banco | `Device.deviceId` (string operacional) ≠ `Device.id` (cuid interno) |

---

## 8. Quando o `EA_DEVICE_ID` não aparece nos parâmetros

O operador pode procurar “EA_DEVICE_ID” e não encontrar — no MetaTrader o input chama-se **`InpDeviceId`**.

### O que é o `deviceId`?

- Identificador **operacional** escolhido pelo EA ou operador (ex.: `mt5-52609973-XPMT5-DEMO` ou `vps-homolog-001`).
- Gravado no PostgreSQL em `devices.device_id` junto com `token_hash`.
- **Não** é secret — pode ser exibido após resolver pelo script (sem expor token).

### Bearer sozinho autentica?

**Sim.** Em `lib/ea/auth.ts`, `authenticateEaRequest()`:

1. Exige `Authorization: Bearer <device_token>`.
2. Localiza `Device` por `tokenHash`.
3. Só valida `X-Device-Id` **se o header estiver presente** — mismatch → `403 DEVICE_MISMATCH`.
4. **Não existe** código `MISSING_DEVICE_ID`.

Teste rápido (sem imprimir token):

```powershell
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" `
  -X POST "https://autotrade-staging.mercadodariqueza.com.br/api/v1/ea/account-snapshots" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $env:STAGING_EA_BEARER_TOKEN" `
  -d "{}"
```

- **400** `VALIDATION_ERROR` → token OK, body inválido (esperado).
- **401** `INVALID_TOKEN` → token não existe no banco **deste** deploy ou revogado.
- **401** `MISSING_TOKEN` → Bearer ausente.

### Como descobrir o `deviceId` sem expor o token

Script: `scripts/homologation/resolve-ea-device-id-from-token.ts`

```powershell
$env:STAGING_EA_BEARER_TOKEN = (Get-Content $tokenFile -First 1).Trim()
$env:DATABASE_URL = "..."   # mesmo Neon do staging — não colar no chat
npx tsx scripts/homologation/resolve-ea-device-id-from-token.ts
Remove-Item Env:STAGING_EA_BEARER_TOKEN, Env:DATABASE_URL
```

Saída JSON (sem token completo): `deviceId`, `licenseId`, `userId`, `accountLogin`, `accountServer`, `lastHeartbeatAt`, `tokenMasked`.

Se não encontrar: `DEVICE_NOT_FOUND_FOR_TOKEN_HASH` (token de outro ambiente ou revogado).

### EA salva `device_id` no `.dat`?

**Não hoje.** Arquivo `mr_at_<login>.dat`:

| Linha | Conteúdo |
|-------|----------|
| 1 | `device_token` |
| 2 | `license_id` |

O `device_id` fica em `g_device_id` (input ou auto) até reiniciar o EA. **Recomendação futura (não implementada):** linha 3 = `device_id` retornado na ativação — facilita homologação sem script de banco.

---

## 9. Cuidados de segurança

- **Nunca** colar `device_token`, `activation_code` ou Bearer completo em chat, ticket ou commit.
- **Não** commitar `.env` ou arquivos `.dat` do MT5.
- Token revogado (`Device.revokedAt`) → EA recebe `401 INVALID_TOKEN`, limpa arquivo local e pede novo código.
- Banco staging e banco local são **distintos** — token gerado em ambiente errado não autentica em staging.
- Testes de snapshot/protection: usar `InpDebugMode=true` — **sem ordem real**.

---

## Referências de código

| Área | Caminho |
|------|---------|
| Ativação HTTP | `app/api/v1/ea/activate/route.ts` |
| Lógica token | `lib/ea/activate.ts`, `lib/ea/token.ts` |
| Auth Bearer | `lib/ea/auth.ts` |
| Credenciais MQL5 | `ea/mql5/includes/MR_AT_Auth.mqh` |
| Ativação MQL5 | `ea/mql5/includes/MR_AT_License.mqh` |
| Headers HTTP | `ea/mql5/includes/MR_AT_Http.mqh` |
| Resolver deviceId | `scripts/homologation/resolve-ea-device-id-from-token.ts` |
| Contrato API | `docs/EA-API.md` |
