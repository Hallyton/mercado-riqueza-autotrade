# Real Trading Controlled Pilot — Staging Validation (Fase 12.2)

**Status:** `REAL_TRADING_CONDITIONAL_GATE_VALIDATED_STAGING`  
**Restrição EA MQL5:** `APPROVED_WITH_RESTRICTIONS` — snapshot/protection no EA ainda não implementados em MQL5.  
**Restrição DB staging:** aplicar migrations `20260529014145` e `20260529024342` no PostgreSQL de staging (`npx prisma migrate deploy`) antes das páginas admin de conta real.

**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` (global)

---

## Regra oficial de liberação REAL

Uma instruction em conta **REAL** só é entregue ao EA Executor quando **todos** os critérios abaixo são verdadeiros:

### Comerciais

| Critério | Implementação |
|----------|----------------|
| Assinatura ACTIVE/TRIALING (se vinculada) | `isSubscriptionCommerciallyActive` |
| Pagamento em dia | `isCommercialPaymentOk` — sem invoice OPEN vencida |
| Termos aceitos | `TermsAcceptance` — COMMERCIAL_SUBSCRIPTION_TERMS ou BETA_DEMO_TERMS |
| Plano / robôs | `isRobotQuantityWithinPlan` (maxMt5Accounts do plano) |
| Cliente não bloqueado | Licença ACTIVE, sem halt total |

### Licença e device

| Critério | Implementação |
|----------|----------------|
| License ACTIVE | `isLicenseCommerciallyEligible` |
| Device autorizado + heartbeat | `isDeviceAuthorizedForLicense` |
| EA Executor ONLINE | `isEaExecutorOnline` |

### Aprovação real (por combinação)

| Critério | Implementação |
|----------|----------------|
| `ENABLE_REAL_TRADING` | env |
| Allowlist `REAL_TRADING_ALLOWED_LICENSE_IDS` | env — **não ampla** |
| `RealTradingApproval` APPROVED + `allowReal` | banco |
| Match userId, licenseId, login, server, symbol, magicNumber | preflight |
| maxContracts, minFreeMargin, marginBuffer | preflight |

### Conta e snapshot

| Critério | Implementação |
|----------|----------------|
| PRE_MARKET do dia (REAL) | `AccountSnapshot` |
| accountLogin / accountServer conferem | licença MT5 |
| Margem livre suficiente | snapshot + buffer |

### Operacionais

| Critério | Implementação |
|----------|----------------|
| Proteção anterior OK | sem `protectionBlocked` / PROTECTION_FAILED pendente |
| Dispatch manual | `ENABLE_AUTO_DISPATCH` off |
| magicNumber na faixa 910001–910999 | config |

**Sucesso:** `RealTradePreflight` **PASSED**, `reasonCode` = `REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE`, audit `ea.instructions_real_controlled_gate_allowed`, payload com `controlled_real_gate` e `protection_required`.

**Falha:** instruction **não** entregue; `instructions: []`; preflight FAILED/BLOCKED com reason legível.

---

## O que NÃO libera REAL

- Pagamento/assinatura **sozinhos**
- Licença ativa **sozinha**
- Config manual **sem** approval + preflight
- Allowlist **sem** demais critérios
- Cliente definindo `allowReal` ou `magicNumber`

---

## Stop / take (conta real)

- Obrigatórios no `ExecutionProtectionReport`
- `PROTECTION_FAILED` → bloqueio + `REAL_TRADING_PROTECTION_NOT_CONFIRMED`
- Erros redigidos no admin

---

## Dispatch automático

Permanece **desativado** (`ENABLE_AUTO_DISPATCH` não habilitado).

---

## Estratégia caixa preta

Payloads e admin **não** expõem lógica interna do robô.

---

## Validação staging (checklist)

| Item | Resultado esperado |
|------|-------------------|
| `npm test` | 265+ testes passando |
| `npm run build` | OK |
| Migration `20260529024342_conditional_real_trading_gate` | Aplicada em staging |
| Rotas `/admin/real-trading/*` | ADMIN only |
| Rotas `/api/v1/ea/*` | Bearer device |
| Default deny REAL | Sem env → bloqueado |
| Preflight PASSED | Somente fixture completo |

**Não enviar ordem real** nesta validação até EA MQL5 enviar snapshot e protection (Fase 12.3).

---

## Referências

- [`REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md`](REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md)
- [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md)
- [`SUBSCRIPTION-LICENSE-DATA-MODEL.md`](SUBSCRIPTION-LICENSE-DATA-MODEL.md)

---

*Mercado da Riqueza AutoTrade — validação gate condicional REAL (12.2).*
