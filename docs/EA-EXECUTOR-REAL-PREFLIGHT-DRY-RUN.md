# EA Executor — Preflight dry-run (conta real)

**Status:** `REAL_PREFLIGHT_DRY_RUN_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

---

## Objetivo

Validar o **Real Trade Preflight** (gate REAL controlado) **sem**:

- criar `Instruction` entregue ao EA;
- enviar ordem real;
- acionar dispatch automático;
- alterar Real Trading Guard;
- criar `RealTradingApproval` automaticamente.

---

## Uso (admin)

1. Abrir `/admin/real-trading/preflights`
2. Preencher licença, conta, servidor, símbolo, magic, contratos
3. Clicar **Executar preflight dry-run**
4. Ler resultado: `PASSED` / `FAILED` / `BLOCKED`, `reasonCode`, flags (margem, EA, snapshot, approval, device, etc.)

### Endpoint

`POST /api/admin/real-trading/preflight-dry-run`

```json
{
  "licenseId": "cmptsr44j0005ib0417zkckn6",
  "accountLogin": "19583778",
  "accountServer": "XPMTS-PRD",
  "symbol": "WDON26",
  "magicNumber": 910001,
  "requestedContracts": 1
}
```

- Apenas **ADMIN** (`requireAdminApiSession`)
- Reutiliza `runRealTradePreflight({ dryRun: true })`
- Persiste `RealTradePreflight` com `source: DRY_RUN`
- Registra `AdminAction` + `audit_logs` (`real_trading.preflight_dry_run`)

---

## Allowlist env opcional

`REAL_TRADING_ALLOWED_LICENSE_IDS` é **opcional** e funciona como trava adicional de emergência:

- **Vazia/ausente:** o gate segue com `RealTradingApproval` APPROVED no banco (não é necessário editar Vercel por licença nova).
- **Preenchida:** a `licenseId` deve estar na lista **e** ter approval APPROVED válido.

Pagamento/assinatura **não** liberam REAL sem approval.

---

## Resultado PASSED

- `reasonCode`: `REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE`
- Mensagem UI: critérios OK no dry-run
- **Não** cria instruction — texto: *Pronto para criar instruction manual real*

---

## Resultado FAILED/BLOCKED

Motivos típicos (via `reasonCode`):

| Código | Significado |
|--------|-------------|
| `REAL_TRADING_SNAPSHOT_REQUIRED` | PRE_MARKET do dia ausente |
| `REAL_TRADING_APPROVAL_REQUIRED` | Sem approval APPROVED |
| `REAL_TRADING_MARGIN_INSUFFICIENT` | Margem livre insuficiente |
| `REAL_TRADING_EXECUTOR_OFFLINE` | EA sem heartbeat |
| `REAL_TRADING_DEVICE_OFFLINE` | Device inativo / sem lastSeen |
| `REAL_TRADING_ACCOUNT_MISMATCH` | Conta ≠ licença vinculada |
| `REAL_TRADING_SUBSCRIPTION_NOT_ACTIVE` | Assinatura inativa |
| `REAL_TRADING_PAYMENT_NOT_ACTIVE` | Pagamento pendente |

---

## Segurança

- Respostas **não** incluem `device_token`, `tokenHash`, `DATABASE_URL`, activation codes ou Bearer
- Dry-run **nunca** chama `instruction.create` nem dispatch de master signal
- `instructionId` no registro de preflight permanece **null** para `DRY_RUN`

---

## Referências

- [`lib/risk/real-trade-preflight.ts`](../lib/risk/real-trade-preflight.ts)
- [`docs/EA-EXECUTOR-REAL-ACCOUNT-ACTIVATION-FLOW.md`](EA-EXECUTOR-REAL-ACCOUNT-ACTIVATION-FLOW.md)
- [`docs/MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) — Fase 14.1.2
