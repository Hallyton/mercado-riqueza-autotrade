# EA — Ativação, devices/VPS e revogação administrativa

**Status:** `EA_DEVICE_REVOCATION_FLOW_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

---

## O que é device/VPS

Cada instalação do **MR_AutoTrade_Executor** em um terminal MT5 gera um **device** (identificado por `deviceId` / VPS). O servidor guarda apenas **hash** do token de autenticação — nunca o `device_token` em claro após a ativação.

Ver também: [`EA-DEVICE-TOKEN-LOCATION-GUIDE.md`](EA-DEVICE-TOKEN-LOCATION-GUIDE.md).

---

## Por que troca de conta gera `DEVICE_LIMIT_EXCEEDED`

O plano limita **devices ativos** por licença (`maxDevices`). Ao mudar de conta DEMO para conta **real** (ex.: BTG), o device antigo da homologação DEMO pode continuar **ACTIVE** e ocupar a vaga.

**Sintoma:** ativação retorna `DEVICE_LIMIT_EXCEEDED`.

**Causa provável:** 1 licença · 1 device ativo · device DEMO antigo não revogado.

---

## DEMO → REAL — caminho correto

1. Abrir licença → **Modo operacional esperado** → configurar **REAL** + conta BTG
2. **Revogar** device DEMO (`REVOGAR DEVICE`) — tradeMode DEMO na tabela é **histórico**
3. **Gerar novo código de ativação** (resumo mostra conta/servidor/modo esperado)
4. No MT5 conta real: `InpTradeMode=REAL`, código novo, ativar
5. Confirmar device **ACTIVE** + badge **OK — device real ativo** + heartbeat REAL
6. Seguir approval manual → PRE_MARKET → preflight → dispatch manual (sem ordem automática)

Ver: [`REAL-TRADEMODE-ACTIVATION-FLOW.md`](REAL-TRADEMODE-ACTIVATION-FLOW.md)

---

## Caminho correto (admin)

1. Abrir **Clientes** → `/admin/clientes`
2. Na licença do cliente, clicar **Gerenciar licença / devices**
3. Rota: `/admin/licenses/[licenseId]`
4. **Revogar** o device DEMO antigo (confirmação: `REVOGAR DEVICE`)
5. Na licença, seção **Gerar novo código de ativação**:
   - confirmação: `GERAR CODIGO DE ATIVACAO`
   - botão **Gerar código** → código em destaque + **Copiar código** + **Concluir**
   - após concluir ou F5, o código **não** reaparece
6. No MT5 conta real: ativar EA com o novo código
7. Confirmar heartbeat com `tradeMode=REAL` e conta/servidor corretos
8. Seguir gate real: approval manual → PRE_MARKET → preflight PASSED → dispatch manual (sem ordem automática)

---

## Status de device

| Status | Significado |
|--------|-------------|
| ACTIVE | Autentica e conta no limite |
| REVOKED | Revogado pelo admin; token antigo inválido (`DEVICE_REVOKED`) |
| BLOCKED | Bloqueado; não autentica (`DEVICE_BLOCKED`) |

Devices revogados/bloqueados **não** contam em `maxDevices`.

---

## Regras de segurança

- Cliente **não** revoga device pela API pública
- Admin **não** vê `device_token`, hash completo nem activation codes antigos na listagem
- **Sem delete físico** — histórico preservado + `AdminAction` / `AuditLog`
- **Não** aumentar `maxDevices` automaticamente para primeira ordem real
- Primeira real ultra-controlada: **1 licença · 1 device · 1 conta · 1 robô · 1 magicNumber**

---

## APIs admin (somente ADMIN)

| Método | Rota |
|--------|------|
| POST | `/api/admin/licenses/[licenseId]/devices/[deviceId]/revoke` |
| POST | `/api/admin/licenses/[licenseId]/devices/[deviceId]/block` |
| POST | `/api/admin/licenses/[licenseId]/activation-code` |

Corpo: `{ "admin_confirmation": "<frase exata>" }`

---

*Mercado da Riqueza AutoTrade — modelo caixa preta preservado.*
