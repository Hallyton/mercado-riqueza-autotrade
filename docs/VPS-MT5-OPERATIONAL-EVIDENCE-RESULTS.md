# Resultado das Evidências Operacionais — VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.5 — Registro das Evidências Operacionais VPS/MT5  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento base:** [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md`](VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md)

---

## 1. Identificação

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-27 |
| **Responsável** | Registro manual Fase 8.5 (nome do operador a formalizar) |
| **Ambiente** | Staging / homologação VPS |
| **VPS/provedor** | PENDENTE — registrar nome do provedor no cofre interno |
| **Sistema operacional** | Windows na VPS de homologação (build exata: evidência visual pendente) |
| **MetaTrader** | MetaTrader 5 |
| **Conta MT5** | `52609973` |
| **Servidor** | `XPMT5-DEMO` |
| **Tipo** | `DEMO` |
| **URL da API** | `https://autotrade-staging.mercadodariqueza.com.br` |

**Referência de armazenamento (fora do Git):** `evidencias/vps-mt5-staging/2026-05-27/` — apenas índice descritivo; nenhum binário commitado.

---

## 2. Regras de redaction aplicadas

| Regra | Aplicada |
|-------|----------|
| `device_token` não exibido | Sim |
| Activation code não exibido | Sim |
| `InpMasterSecret` não exibido | Sim |
| `Authorization` / `Bearer` não exibido | Sim |
| Senha MT5 não exibida | Sim |
| Envs sensíveis não exibidas | Sim |
| Prints não commitados no Git | Sim |
| Evidências visuais apenas referenciadas/descritas | Sim |

Nenhum secret, token, senha ou print bruto foi incluído neste repositório.

---

## 3. Evidências recebidas — VPS/Windows

| Item | Status | Referência / observação |
|------|--------|-------------------------|
| Ambiente dedicado / VPS identificado | PENDENTE | Homologação confirma VPS em uso; print redigido do provedor/hostname pendente |
| Windows Update | PENDENTE | Print ou anotação pendente |
| Defender/antivírus | PENDENTE | Print ou anotação pendente |
| Firewall | PENDENTE | Print ou anotação pendente |
| Política de acesso / RDP | PENDENTE | Documento ou anotação redigida pendente |
| Operadores autorizados (lista de acesso) | PENDENTE | Vinculado à seção 8 — nomes `A DEFINIR` |

---

## 4. Evidências recebidas — MetaTrader 5

| Item | Status | Referência / observação |
|------|--------|-------------------------|
| Conta DEMO confirmada | APROVADO | `52609973 @ XPMT5-DEMO` — homologação + runbook `runbook-demo-session-001` |
| Conta real não usada | APROVADO | Staging DEMO; Real Trading Guard no backend |
| Servidor `XPMT5-DEMO` confirmado | APROVADO | Homologação staging/VPS |
| EA cliente anexado | APROVADO | `MR_AutoTrade_Executor` — heartbeat e execuções |
| Parâmetros do EA com secrets ocultos | APROVADO | `InpDebugMode=true`, URL staging; sem token em documentação |
| AutoTrading conforme política | PENDENTE | Política 8.3 formalizada; print de estado e sessão controlada pendente |
| Nenhuma ordem/posição desconhecida | PENDENTE | Print de fechamento de sessão pendente |
| Logs visíveis | APROVADO | `InpLogLevel=2`; homologação operacional |

---

## 5. Evidências recebidas — WebRequest

| Item | Status | Referência / observação |
|------|--------|-------------------------|
| Domínio staging autorizado | APROVADO | `https://autotrade-staging.mercadodariqueza.com.br` — homologação |
| Ausência de domínios desnecessários | PENDENTE | Print redigido da lista MT5 pendente |
| URL base correta | APROVADO | `InpApiBaseUrl` alinhado ao staging |
| Ambiente correto (sem produção/`www`) | APROVADO | Homologação e domínios documentados |

---

## 6. Evidências recebidas — MQL5/Files e tokens locais

| Item | Status | Referência / observação |
|------|--------|-------------------------|
| Pasta `MQL5/Files` localizada | PENDENTE | Print redigido (nomes ocultos) pendente |
| `device_token` não exposto | APROVADO | Sem exposição em docs/homologação/runbook |
| Arquivos locais fora do Git | APROVADO | Repositório sem arquivos de token |
| Token não compartilhado por WhatsApp/e-mail | APROVADO | Política 8.4/8.3; sem incidente |
| Revogação de device conhecida | APROVADO | Homologação (troca MT5) + runbook |

---

## 7. Evidências recebidas — Logs

| Item | Status | Referência / observação |
|------|--------|-------------------------|
| Amostra sem activation code | APROVADO | Auditoria estática MQL5 (7.8) + prática homologação |
| Amostra sem `device_token` | APROVADO | Idem |
| Amostra sem `InpMasterSecret` | APROVADO | EA Mãe redige Bearer em logs (7.8) |
| Amostra sem `Authorization` / `Bearer` | APROVADO | Idem |
| Logs úteis para auditoria | APROVADO | Nível de log operacional em homologação |
| Arquivo de amostra arquivado (redigido) | PENDENTE | Salvar em cofre interno, não no Git |

---

## 8. Evidências recebidas — Operadores

| Papel | Status | Responsável |
|-------|--------|-------------|
| Responsável técnico | APROVADO | HALLYTON (Fase 8.6) |
| Responsável operacional | APROVADO | HALLYTON (Fase 8.6) |
| Operador MT5/VPS | APROVADO | HALLYTON (Fase 8.6) |
| Admin autorizado ao dispatch | APROVADO | HALLYTON (Fase 8.6) |
| Responsável pelo rollback | APROVADO | HALLYTON (Fase 8.6) |
| Responsável por evidências | APROVADO | HALLYTON (Fase 8.6) |
| Responsável por revisão pós-sessão | APROVADO | HALLYTON (Fase 8.6) |

---

## 9. Achados

### Itens aprovados (evidência documental / operacional)

- Conta e servidor DEMO; conta real não usada em staging.
- EA cliente operacional; URL API e WebRequest staging corretos.
- Procedimentos de device (revogação/reativação); arquivos locais fora do Git.
- Logs sem secrets (auditoria 7.8 + homologação); logs visíveis no terminal.
- Runbook `runbook-demo-session-001` com tracking `EXECUTED`.
- Regras de redaction aplicadas; nenhum binário no Git.

### Itens pendentes

- Prints VPS/Windows (Update, Defender, firewall, RDP, identificação provedor).
- Print lista WebRequest completa no MT5.
- Print `MQL5/Files` e permissões.
- Amostra de log MT5 arquivada (cofre interno).
- AutoTrading: prints ligado/desligado conforme política 8.3.
- Ordem/posição no fechamento de sessão.
- Suplente operacional documentado (operadores principais: HALLYTON — Fase 8.6).

### Itens reprovados

- Nenhum.

### Riscos identificados

| Risco | Severidade | Bloqueia conta real? |
|-------|------------|----------------------|
| Operadores sem suplente | Baixa | Não isoladamente |
| Hardening VPS/Windows sem prints | Média | Indiretamente |
| `device_token` em disco sem permissões evidenciadas | Média | Indiretamente |
| AutoTrading sem evidência visual de controle | Média | Indiretamente |
| Lista WebRequest não auditada visualmente | Baixa | Não isoladamente |

### Evidências ainda faltantes

- 6 itens VPS/Windows.
- 3 itens MT5 (AutoTrading visual, ordens/posições, opcional EA Mãe no terminal).
- 1 item WebRequest (lista completa).
- 1 item `MQL5/Files` (pasta).
- 1 arquivo de log redigido no cofre.
- Suplente operacional.
- Sessão dedicada AutoTrading (pacote 8.4, seção 9) — `MasterSignalId` a definir.

---

## 10. Decisão da Fase 8.5

**Status:** `APPROVED_WITH_RESTRICTIONS`

**Motivo:** evidências **descritivas e documentais** suficientes para MT5 integração staging, tokens e logs (sem secrets no repo). Restrições: **operadores indefinidos**, **prints VPS/Windows pendentes**, **amostra de log arquivada pendente** e **evidência visual de AutoTrading/WebRequest/Files pendente**.

Mesmo com este status:

- Conta real continua **bloqueada**.
- Produção real continua **bloqueada**.
- Dispatch automático continua **desativado**.
- Decisão global: `REAL_ACCOUNT_NOT_APPROVED`.

---

## 11. Próxima ação recomendada

1. Definir **suplente** operacional na política 8.3/8.6.
2. Coletar **prints redigidos** pendentes (seções 3, 5, 6) no cofre `evidencias/vps-mt5-staging/`.
3. Executar **sessão demo** com AutoTrading controlado (política 8.3) e registrar `MasterSignalId`.
4. Arquivar **amostra de log** redigida fora do Git.
5. Revisar [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md) após novas evidências.
6. Promover pacote 8.4 para `APPROVED` somente quando operadores e evidências críticas estiverem completos.

---

## 12. Fase 8.6 — Operadores e Responsabilidades

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md`](VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md)

| Item | Situação |
|------|----------|
| Operadores definidos | OK — **HALLYTON** em todos os papéis |
| Operadores `A DEFINIR` | Encerrado |
| Matriz de permissões | Preenchida com HALLYTON |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |

---

## 13. Fase 8.7 — Registro de Evidências Visuais Redigidas

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-VISUAL-EVIDENCE-REGISTER.md`](VPS-MT5-VISUAL-EVIDENCE-REGISTER.md)  
**Status inicial:** `PENDING_EVIDENCE` → **encerramento:** `APPROVED_WITH_RESTRICTIONS`

| Item | Situação |
|------|----------|
| Documento criado | OK |
| Prints/binários no Git | **Nenhum** — não serão coletados nesta etapa |
| Logs brutos no Git | **Nenhum** |

---

## 14. Fase 8.7 — Encerramento por declaração operacional

**Responsável:** HALLYTON  
**Status:** `APPROVED_WITH_RESTRICTIONS`

| Item | Situação |
|------|----------|
| Prints coletados | **Não** — dispensados por risco de sigilo |
| Validação | Por **declaração operacional** do responsável |
| Tokens/secrets/senhas expostos | Não |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |
| Restrição para conta real futura | Ausência de prints exige novo gate ou revisão presencial |

**Conclusão:** a Fase 8.7 foi encerrada sem anexar evidências visuais, por política de sigilo. O hardening operacional em staging/demo permanece suportado por documentação e homologação prévia; conta real continua bloqueada.

---

## 15. Fase 8.8 — Sessão Demo com AutoTrading Controlado

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md`](VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md)  
**Status:** `APPROVED`  
**Operador:** HALLYTON

| Item | Situação |
|------|----------|
| Política AutoTrading validada na prática | OK |
| MasterSignalId | `autotrading-policy-demo-001` |
| Tracking | `EXECUTED` |
| `DebugMode=true` / `tradeMode=DEMO` | OK |
| Dispatch manual | OK |
| Prints no Git | Nenhum |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |

**Conclusão:** Fase 8.8 registra validação operacional da política de AutoTrading em demo; complementa evidências documentais das fases 8.2–8.7 sem liberar conta real.

---

*Mercado da Riqueza AutoTrade — registro de evidências operacionais VPS/MT5 com restrições. Sem binários no Git. Conta real, produção real e dispatch automático permanecem bloqueados.*
