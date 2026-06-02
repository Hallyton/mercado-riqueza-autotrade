# EA Executor — Conta real: vínculo admin, ativação e device automático

**Status:** `LICENSE_MT5_ACCOUNT_BINDING_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

---

## Princípios

| Regra | Comportamento |
|-------|----------------|
| Admin **não** cria Device/VPS | Device nasce em `POST /api/v1/ea/activate` após código válido |
| Admin **não** gera `device_token` | Token só na resposta única da ativação EA |
| Admin vincula conta MT5 | `POST /api/admin/licenses/[licenseId]/mt5-account` |
| Admin gera activation code | Após `license.mt5Account` oficial |
| Conta real operacional | Exige `RealTradingApproval` + PRE_MARKET + preflight + protection |
| Ordens reais | **Nenhuma** no vínculo MT5 nem na ativação do EA |

---

## Fluxo operacional (admin)

1. **Vincular conta MT5** — card *Conta MT5 vinculada* em `/admin/licenses/[licenseId]`
   - Confirmação DEMO: `CONFIGURAR CONTA DEMO MT5`
   - Confirmação REAL: `CONFIGURAR CONTA REAL MT5`
   - Persiste `Mt5Account` + `license.mt5AccountId` e sincroniza `expectedAccountLogin`, `expectedAccountServer`, `expectedTradeMode`, `expectedSymbol`, `expectedMagicNumber`
2. **Modo operacional esperado** (opcional se já sincronizado no passo 1)
3. **Gerar código de ativação** — frase `GERAR CODIGO DE ATIVACAO`
4. **Ativar EA no MT5** na conta/servidor vinculados
5. **Heartbeat** — primeiro HB registra device **ACTIVE**
6. **RealTradingApproval** manual (se REAL)
7. **PRE_MARKET** snapshot → preflight → dispatch manual (sem automático)

---

## Diferença: conta vinculada vs device

| Conceito | Onde vive | Quando existe |
|----------|-----------|---------------|
| **Conta MT5 vinculada** | `Mt5Account` + `License.mt5AccountId` | Admin (ou cliente no portal) antes do código |
| **Modo/conta esperados** | Campos `expected*` na `License` | Admin; usados na validação da ativação EA |
| **Device/VPS** | Tabela `devices` | Somente após ativação EA com código válido |

A UI de *Modo operacional esperado* pode mostrar conta via fallback (`expectedAccountLogin` ou `mt5Account.login`). O **código de ativação** exige o vínculo oficial `mt5Account`.

---

## Segurança e auditoria

- Apenas role **ADMIN** na API admin
- Cada vínculo/edição: `AdminAction` + `audit_logs` (`license.mt5_account_bound` / `license.mt5_account_updated`)
- Respostas **não** incluem `tokenHash`, `device_token`, activation codes antigos ou secrets de ambiente

---

## Referências

- [`EA-DEVICE-ACTIVATION-AND-REVOCATION.md`](EA-DEVICE-ACTIVATION-AND-REVOCATION.md)
- [`REAL-TRADEMODE-ACTIVATION-FLOW.md`](REAL-TRADEMODE-ACTIVATION-FLOW.md)
- [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) — Fase 14.1.1
