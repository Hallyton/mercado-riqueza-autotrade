# Registro de Evidências Visuais Redigidas — VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.7 — Registro das Evidências Visuais Redigidas VPS/MT5  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Responsável pela declaração operacional:** HALLYTON

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
| Ambiente/VPS identificado | DISPENSADO — sigilo | Sem anexo |
| Windows Update conferido | DISPENSADO — sigilo | Sem anexo |
| Defender/antivírus ativo | DISPENSADO — sigilo | Sem anexo |
| Firewall ativo | DISPENSADO — sigilo | Sem anexo |
| Política RDP/acesso remoto conferida | DISPENSADO — sigilo | Sem anexo |
| Lista de acesso/operador conferida | DISPENSADO — sigilo | Sem anexo |

---

## 4. Evidências MetaTrader 5

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Conta `52609973 @ XPMT5-DEMO` confirmada | DISPENSADO — sigilo | Sem anexo |
| Tipo DEMO confirmado | DISPENSADO — sigilo | Sem anexo |
| Servidor `XPMT5-DEMO` confirmado | DISPENSADO — sigilo | Sem anexo |
| EA cliente anexado | DISPENSADO — sigilo | Sem anexo |
| Parâmetros do EA conferidos com secrets ocultos | DISPENSADO — sigilo | Sem anexo |
| AutoTrading visualmente conferido | DISPENSADO — sigilo | Sem anexo |
| Aba de ordens/posições sem pendências desconhecidas | DISPENSADO — sigilo | Sem anexo |

---

## 5. Evidências WebRequest

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Lista de URLs permitidas no MT5 conferida | DISPENSADO — sigilo | Sem anexo |
| Domínio staging presente: `https://autotrade-staging.mercadodariqueza.com.br` | DISPENSADO — sigilo | Sem anexo |
| Ausência de domínios desnecessários | DISPENSADO — sigilo | Sem anexo |
| Ambiente correto (sem produção/`www`) | DISPENSADO — sigilo | Sem anexo |

---

## 6. Evidências MQL5/Files

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Pasta `MQL5/Files` localizada | DISPENSADO — sigilo | Sem anexo |
| `device_token` não exibido nos prints | DISPENSADO — sigilo | Sem anexo |
| Arquivos locais fora do Git | APROVADO — documental | Repositório sem arquivos locais |
| Procedimento de revogação conhecido | APROVADO — documental | Homologação + runbook |

---

## 7. Evidências de logs

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| Amostra de log MT5 redigida | DISPENSADO — sigilo | Sem anexo |
| Log sem activation code | DISPENSADO — sigilo | Auditoria 7.8 + declaração |
| Log sem `device_token` | DISPENSADO — sigilo | Auditoria 7.8 + declaração |
| Log sem `InpMasterSecret` | DISPENSADO — sigilo | Auditoria 7.8 + declaração |
| Log sem `Authorization` / `Bearer` | DISPENSADO — sigilo | Auditoria 7.8 + declaração |

---

## 8. Evidência de AutoTrading controlado

| Evidência | Status | Arquivo no cofre (referência) |
|-----------|--------|----------------------------|
| AutoTrading desligado fora de sessão | DISPENSADO — sigilo | Sem anexo |
| AutoTrading ligado somente em sessão autorizada | DISPENSADO — sigilo | Sem anexo |
| Operador sabe desligar AutoTrading (HALLYTON) | APROVADO — declaração | Política 8.3 |
| Operador sabe remover EA (HALLYTON) | APROVADO — declaração | Política 8.3 |

**Referência:** [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md) seções 6 e 7.

---

## 9. Suplente operacional

| Campo | Valor |
|-------|--------|
| **Suplente operacional** | A DEFINIR — BLOQUEIA CONTA REAL |

**Observação:** **HALLYTON** está definido em todos os papéis (Fase 8.6), mas a **ausência de suplente** documentado mantém restrição operacional para qualquer gate de conta real.

---

## 10. Dispensa de evidências visuais por sigilo

**Responsável pela declaração operacional:** HALLYTON  
**Data da declaração:** 2026-05-27

A coleta de prints e evidências visuais da VPS/MT5 (Windows, MetaTrader, WebRequest, `MQL5/Files`, logs, parâmetros do EA e AutoTrading) foi **dispensada nesta etapa** por risco de exposição de informações sigilosas, incluindo — sem limitação — tokens, paths locais, dados de conta, `device_token`, activation code, secrets, IPs ou outras informações sensíveis, mesmo com redação parcial.

**Decisões registradas:**

- Evidências visuais **dispensadas** por política de sigilo.
- **Nenhum** print será commitado neste repositório.
- **Nenhum** log bruto será commitado.
- **Nenhum** token, secret ou senha será exposto na documentação.
- Validação operacional **assumida por declaração** do responsável HALLYTON para staging/demo documental existente.
- **Ausência de prints** mantém restrição operacional para qualquer **conta real** futura.
- Para conta real futura: será necessário **novo gate** com evidência adequada ou **revisão presencial/controlada**.

Esta dispensa **não** libera conta real, produção real, dinheiro real nem dispatch automático.

---

## 11. Decisão da Fase 8.7

**Status:** `APPROVED_WITH_RESTRICTIONS`

**Motivo:** fase encerrada por **declaração operacional** do responsável HALLYTON, com evidências visuais dispensadas por sigilo. Nenhum artefato visual foi anexado ou commitado.

| Confirmação | Valor |
|-------------|--------|
| Prints commitados | Não |
| Logs brutos commitados | Não |
| Conta real | Bloqueada |
| Produção real | Bloqueada |
| Dispatch automático | Desativado |

---

## 12. Próxima ação recomendada

1. Manter **zero** prints/logs brutos no Git.
2. Para qualquer gate de **conta real**: exigir evidência visual adequada ou revisão presencial/controlada.
3. Definir **suplente operacional** (restrição remanescente).
4. Continuar operação staging/demo conforme runbook e política 8.3.

---

*Mercado da Riqueza AutoTrade — Fase 8.7 encerrada com restrições. Evidências visuais dispensadas por sigilo. Conta real, produção real e dispatch automático permanecem bloqueados.*
