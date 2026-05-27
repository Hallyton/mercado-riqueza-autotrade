# Registro de Evidências Visuais Redigidas — VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.7 — Registro das Evidências Visuais Redigidas VPS/MT5  
**Status:** `PENDING_EVIDENCE`

Documentos relacionados: [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md`](VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md), [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md`](VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md), [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md).

---

## 1. Regras de segurança

| Regra | Confirmado |
|-------|------------|
| Nenhum print foi commitado no Git | Sim |
| Nenhum log bruto foi commitado no Git | Sim |
| Nenhum `device_token` foi exibido neste documento | Sim |
| Nenhum activation code foi exibido neste documento | Sim |
| Nenhum `InpMasterSecret` foi exibido neste documento | Sim |
| Nenhum `Authorization` / `Bearer` foi exibido neste documento | Sim |
| Nenhuma senha MT5 foi exibida neste documento | Sim |
| Nenhuma env sensível foi exibida neste documento | Sim |
| Prints devem ficar em cofre/repositório externo seguro, fora do Git | Sim |
| Este documento registra apenas descrição e status das evidências | Sim |

---

## 2. Local seguro das evidências

| Campo | Valor |
|-------|--------|
| **Local seguro das evidências** | `evidencias/vps-mt5-staging/` — **fora do Git** (caminho interno a confirmar no cofre da equipe) |

**Sugestão de estrutura (não versionada):**

```
evidencias/vps-mt5-staging/
  2026-05-27/
    vps-windows/
    mt5/
    webrequest/
    mql5-files/
    logs-redigidos/
    autotrading/
```

Nenhum arquivo binário, imagem ou log bruto deve ser adicionado a este repositório Git.

---

## 3. Evidências VPS/Windows

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Ambiente/VPS identificado | PENDENTE | |
| Windows Update conferido | PENDENTE | |
| Defender/antivírus ativo | PENDENTE | |
| Firewall ativo | PENDENTE | |
| Política RDP/acesso remoto conferida | PENDENTE | |
| Lista de acesso/operador conferida | PENDENTE | |

---

## 4. Evidências MetaTrader 5

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Conta `52609973 @ XPMT5-DEMO` confirmada | PENDENTE | |
| Tipo DEMO confirmado | PENDENTE | |
| Servidor `XPMT5-DEMO` confirmado | PENDENTE | |
| EA cliente anexado | PENDENTE | |
| Parâmetros do EA conferidos com secrets ocultos | PENDENTE | |
| AutoTrading visualmente conferido | PENDENTE | |
| Aba de ordens/posições sem pendências desconhecidas | PENDENTE | |

---

## 5. Evidências WebRequest

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Lista de URLs permitidas no MT5 conferida | PENDENTE | |
| Domínio staging presente: `https://autotrade-staging.mercadodariqueza.com.br` | PENDENTE | |
| Ausência de domínios desnecessários | PENDENTE | |
| Ambiente correto (sem produção/`www`) | PENDENTE | |

---

## 6. Evidências MQL5/Files

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Pasta `MQL5/Files` localizada | PENDENTE | |
| `device_token` não exibido nos prints | PENDENTE | |
| Arquivos locais fora do Git | PENDENTE | |
| Procedimento de revogação conhecido | PENDENTE | |

---

## 7. Evidências de logs

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Amostra de log MT5 redigida | PENDENTE | |
| Log sem activation code | PENDENTE | |
| Log sem `device_token` | PENDENTE | |
| Log sem `InpMasterSecret` | PENDENTE | |
| Log sem `Authorization` / `Bearer` | PENDENTE | |

---

## 8. Evidência de AutoTrading controlado

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| AutoTrading desligado fora de sessão | PENDENTE | |
| AutoTrading ligado somente em sessão autorizada | PENDENTE | |
| Operador sabe desligar AutoTrading (HALLYTON) | PENDENTE | |
| Operador sabe remover EA (HALLYTON) | PENDENTE | |

**Referência:** [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md) seções 6 e 7.

---

## 9. Suplente operacional

| Campo | Valor |
|-------|--------|
| **Suplente operacional** | A DEFINIR — BLOQUEIA CONTA REAL |

**Observação:** **HALLYTON** está definido em todos os papéis (Fase 8.6), mas a **ausência de suplente** documentado mantém restrição operacional para qualquer gate de conta real.

---

## 10. Decisão da Fase 8.7

**Status:** `PENDING_EVIDENCE`

**Motivo:** o registro de evidências visuais foi estruturado, mas **prints redigidos e conferências visuais** ainda não foram anexados ao cofre interno nem marcados como `APROVADO` item a item.

Status possíveis:

| Status | Quando usar |
|--------|-------------|
| `PENDING_EVIDENCE` | Nenhuma ou poucas evidências visuais coletadas (**atual**) |
| `APPROVED_WITH_RESTRICTIONS` | Evidências parciais; pendências não críticas |
| `APPROVED` | Todas as evidências críticas conferidas e referenciadas no cofre |
| `REJECTED` | Secret exposto, conta real, ou falha crítica de hardening |

Conta real, produção real e dispatch automático **permanecem bloqueados**.

---

## 11. Próxima ação recomendada

1. Coletar **prints redigidos** na VPS/MT5 conforme seções 3–8.
2. Salvar apenas no cofre `evidencias/vps-mt5-staging/` (fora do Git).
3. Atualizar coluna **Status** e **Arquivo no cofre** deste documento item a item.
4. Atualizar [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md`](VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md) e [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md).
5. Definir **suplente operacional** na política 8.3/8.6.
6. Promover status desta fase para `APPROVED_WITH_RESTRICTIONS` ou `APPROVED` somente após conferência visual completa.

---

*Mercado da Riqueza AutoTrade — registro de evidências visuais VPS/MT5. Nenhum print, binário ou log bruto no Git. Conta real, produção real e dispatch automático permanecem bloqueados.*
