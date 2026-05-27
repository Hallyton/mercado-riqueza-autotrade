# Resultado do Checklist — Hardening VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.2 — Preenchimento Manual do Checklist VPS/MT5  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento base:** [`docs/VPS-MT5-HARDENING-VALIDATION.md`](VPS-MT5-HARDENING-VALIDATION.md)

---

## 1. Identificação do ambiente

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-27 |
| **Responsável** | Registro manual Fase 8.2 (operador a formalizar nome) |
| **Ambiente** | Staging / homologação VPS |
| **VPS/provedor** | PENDENTE — registrar nome do provedor e região |
| **Sistema operacional** | Windows Server/Desktop na VPS de homologação (build exata a confirmar) |
| **MetaTrader** | MetaTrader 5 |
| **Conta MT5** | `52609973` |
| **Servidor** | `XPMT5-DEMO` |
| **Tipo de conta** | `DEMO` |
| **URL da API** | `https://autotrade-staging.mercadodariqueza.com.br` |
| **Status inicial (Fase 8.1)** | `PENDING_OPERATIONAL_VALIDATION` |

**Fontes de evidência usadas neste preenchimento:** [`STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md), [`PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md), runbook operacional e auditoria estática de logs MQL5 (Fase 7.8).

---

## 2. Resultado do checklist VPS/Windows

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | VPS dedicada | PENDENTE | Homologação confirma VPS em uso; dedicada vs. compartilhada não documentada com evidência |
| 2 | Usuário Windows dedicado | PENDENTE | Não evidenciado nesta fase |
| 3 | Senha forte | PENDENTE | Não auditado nesta fase |
| 4 | RDP protegido | PENDENTE | Não evidenciado (IP/VPN/2FA) |
| 5 | 2FA/VPN, se disponível | PENDENTE | Não evidenciado |
| 6 | Firewall ativo | PENDENTE | Não evidenciado |
| 7 | Windows atualizado | PENDENTE | Não evidenciado |
| 8 | Defender/antivírus ativo | PENDENTE | Não evidenciado |
| 9 | Sem uso pessoal na VPS | PENDENTE | Declaração operacional pendente |
| 10 | Acesso compartilhado bloqueado | PENDENTE | Não evidenciado |
| 11 | Operadores autorizados definidos | PENDENTE | Todos os papéis ainda `A DEFINIR` |
| 12 | Logs de acesso disponíveis, se aplicável | NÃO APLICÁVEL | Até confirmação do provedor/VPS |

---

## 3. Resultado do checklist MetaTrader 5

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | MT5 instalado de fonte confiável | PENDENTE | Terminal operacional em homologação; origem do instalador não anexada |
| 2 | Conta demo identificada | APROVADO | `52609973 @ XPMT5-DEMO` — homologação e runbook `runbook-demo-session-001` |
| 3 | Conta real não usada | APROVADO | Apenas DEMO em staging; Real Trading Guard ativo no backend |
| 4 | Servidor correto | APROVADO | `XPMT5-DEMO` confirmado na homologação |
| 5 | EA cliente instalado | APROVADO | `MR_AutoTrade_Executor.mq5` — heartbeat e execuções OK |
| 6 | EA Mãe instalado, se aplicável | PENDENTE | Uso via simulador/roteiro documentado; instalação MT5 do EA Mãe não evidenciada nesta fase |
| 7 | AutoTrading sob controle | PENDENTE | Sessões controladas documentadas; política formal e estado fora de sessão a confirmar |
| 8 | WebRequest restrito ao domínio autorizado | APROVADO | Domínio staging liberado — homologação ponta a ponta |
| 9 | Logs visíveis | APROVADO | Logs MT5 usados na homologação operacional |
| 10 | Nenhuma ordem pendente desconhecida | PENDENTE | Confirmar no terminal no fechamento de cada sessão |
| 11 | Nenhuma posição aberta desconhecida | PENDENTE | Confirmar no terminal no fechamento de cada sessão |

---

## 4. Resultado do checklist MQL5/Files e tokens locais

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Pasta `MQL5/Files` localizada | PENDENTE | Confirmar caminho e permissões na VPS |
| 2 | Acesso restrito ao usuário Windows | PENDENTE | Não evidenciado |
| 3 | `device_token` não exibido em prints | APROVADO | Homologação e runbook sem exposição registrada |
| 4 | `device_token` não enviado por WhatsApp/e-mail | APROVADO | Política documentada; sem incidente registrado |
| 5 | Arquivos locais não versionados em Git | APROVADO | Repositório sem `MQL5/Files` / tokens |
| 6 | Procedimento de revogação do device conhecido | APROVADO | Documentado em homologação (revogação após troca MT5) e runbook |
| 7 | Procedimento de reativação conhecido | APROVADO | Novo activation code via dashboard — homologação |
| 8 | Tokens antigos removidos, se aplicável | PENDENTE | Confirmar limpeza local após revogações |

---

## 5. Resultado do checklist WebRequest

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Domínio staging autorizado | APROVADO | `https://autotrade-staging.mercadodariqueza.com.br` |
| 2 | Domínios desnecessários ausentes | PENDENTE | Revisar lista completa no MT5 (print redigido) |
| 3 | URL base do EA conferida | APROVADO | `InpApiBaseUrl` alinhado ao staging |
| 4 | WebRequest não aponta para ambiente errado | APROVADO | Sem uso de produção/`www` na homologação |

---

## 6. Resultado do checklist AutoTrading

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | AutoTrading desligado fora de sessão | PENDENTE | Política no runbook; estado atual na VPS a confirmar |
| 2 | AutoTrading ligado apenas quando autorizado | PENDENTE | Idem |
| 3 | Operador sabe desligar AutoTrading | PENDENTE | Depende de operador nomeado |
| 4 | Operador sabe remover EA do gráfico | PENDENTE | Procedimento no runbook; operador `A DEFINIR` |
| 5 | Procedimento de emergência conhecido | APROVADO | Rollback documentado (runbook + Fase 8.1) |

---

## 7. Resultado do checklist de logs

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Logs não mostram activation code | APROVADO | Auditoria estática MQL5 (7.8) + homologação sem incidente |
| 2 | Logs não mostram `device_token` | APROVADO | Idem |
| 3 | Logs não mostram `InpMasterSecret` | APROVADO | EA Mãe redige `Bearer` nos logs (7.8) |
| 4 | Logs não mostram `Authorization` / `Bearer` | APROVADO | Idem |
| 5 | Logs permitem auditoria operacional | APROVADO | `InpLogLevel=2` em homologação |
| 6 | Logs podem ser coletados sem secrets | PENDENTE | Amostra real de log da VPS a arquivar (redigida) |

---

## 8. Operadores e responsabilidades

| Papel | Responsável |
|-------|-------------|
| Responsável técnico | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável operacional | A DEFINIR — BLOQUEIA CONTA REAL |
| Operador MT5/VPS | A DEFINIR — BLOQUEIA CONTA REAL |
| Admin autorizado ao dispatch | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável pelo rollback | A DEFINIR — BLOQUEIA CONTA REAL |

---

## 9. Achados

### Itens aprovados (resumo)

- Conta e servidor DEMO corretos; conta real não usada em staging.
- EA cliente operacional (heartbeat, instructions, executions, `DebugMode=true`).
- WebRequest e URL base apontando para staging autorizado.
- Procedimentos de revogação/reativação de device documentados e exercitados na homologação.
- Política de não versionar tokens no Git.
- Logs MQL5 sem secrets na auditoria estática; rollback documentado.
- Sessão runbook `runbook-demo-session-001` com tracking `EXECUTED` (evidência backend/admin).

### Itens pendentes (resumo)

- Infraestrutura VPS/Windows (dedicada, RDP, firewall, Defender, atualizações, uso pessoal).
- Operadores nomeados em todos os papéis.
- Permissões formais da pasta `MQL5/Files`.
- Política e estado de AutoTrading fora de sessão.
- Revisão completa da lista WebRequest no MT5.
- Amostra arquivada de log MT5 redigido.
- EA Mãe no terminal (se usado apenas via simulador, manter documentado).
- Ordem/posição desconhecida — checklist de fechamento de sessão.

### Itens reprovados

- Nenhum.

### Riscos identificados

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Operadores indefinidos | Alta | Preencher seção 8 antes de qualquer gate de conta real |
| Hardening VPS/Windows não evidenciado | Média | Completar checklist 4 com prints/política do provedor |
| `device_token` em disco na VPS | Média | Restringir `MQL5/Files` e usuário Windows dedicado |
| AutoTrading sem política formal escrita | Média | Formalizar no runbook + evidência de estado |
| Lista WebRequest não auditada visualmente | Baixa | Print redigido da lista permitida no MT5 |

### Evidências disponíveis

- [`STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md) — fluxo EA online, WebRequest, DEMO, sem ordem real.
- [`PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md) — `runbook-demo-session-001`, tracking `EXECUTED`.
- [`PRE-REAL-AUDIT-EA-CLIENT-MASTER-RESULTS.md`](PRE-REAL-AUDIT-EA-CLIENT-MASTER-RESULTS.md) — contratos e logs MQL5.
- [`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md) — rollback e checklists de sessão.

### Prints recebidos

- Nenhum print novo anexado nesta fase — preenchimento baseado em registros documentais existentes.

### Observações do operador

- Ambiente de homologação staging/VPS já executou ciclos ponta a ponta com conta DEMO e Real Trading Guard no backend.
- Itens de infraestrutura Windows/VPS exigem conferência presencial ou evidência do provedor para promoção a `APPROVED` pleno.

---

## 10. Decisão

**Status:** `APPROVED_WITH_RESTRICTIONS`

**Motivo:** evidência operacional suficiente para **MT5, WebRequest, conta DEMO, EA cliente e procedimentos de token** (homologação + runbook), sem itens críticos reprovados. Restrições: **operadores `A DEFINIR`**, **hardening VPS/Windows não totalmente evidenciado** e **pendências de AutoTrading / `MQL5/Files` / amostra de logs**.

Mesmo com este status:

- Conta real continua **bloqueada**.
- Produção real continua **bloqueada**.
- Dispatch automático continua **desativado**.
- Decisão global permanece `REAL_ACCOUNT_NOT_APPROVED`.

---

## 11. Próxima ação recomendada

1. Definir e registrar **todos os operadores** (seção 8).
2. Coletar **prints redigidos** faltantes: lista WebRequest MT5, pasta `MQL5/Files`, firewall/RDP (se aplicável).
3. **Validar logs reais** do MT5 em amostra arquivada sem secrets.
4. **Confirmar permissões** da pasta `MQL5/Files` e usuário Windows dedicado.
5. **Formalizar política de AutoTrading** (ligado/desligado por sessão).
6. Reexecutar checklist na VPS e atualizar status para `APPROVED` somente se todos os critérios da Fase 8.1 forem atendidos sem pendência crítica.

---

## 12. Fase 8.3 — Operadores, Responsabilidades e AutoTrading

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md)  
**Status da política:** `DRAFT_OPERATIONAL_POLICY`

| Item | Situação |
|------|----------|
| Política criada | OK — papéis, matriz de permissões, AutoTrading, procedimentos e critérios de bloqueio |
| Operadores nomeados | Pendente — todos os papéis permanecem `A DEFINIR — BLOQUEIA CONTA REAL` |
| AutoTrading formalizado | OK — regras escritas nas seções 4, 6 e 7 da política |
| Matriz de permissões | Pendente — preencher responsáveis por ação |
| Impacto no checklist 8.2 | Itens de AutoTrading e operadores passam a ter referência formal; evidência de execução ainda pendente |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |

**Conclusão:** a Fase 8.3 resolve a pendência documental de política de AutoTrading e estrutura de operadores; o preenchimento de nomes e evidências permanece necessário antes de promover hardening ou política para status sem restrições críticas.

---

## 13. Fase 8.4 — Pacote de Evidências Operacionais VPS/MT5

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md`](VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md)  
**Status do pacote:** `PENDING_EVIDENCE`

| Item | Situação |
|------|----------|
| Pacote criado | OK — índice de evidências VPS, MT5, WebRequest, Files, logs, operadores e sessão AutoTrading |
| Regras de redaction | OK — documentadas |
| Evidências coletadas | **Pendentes** — ~34 itens em `PENDENTE` |
| Operadores | Ainda `A DEFINIR` na política 8.3 |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |

**Conclusão:** a Fase 8.4 não altera o status do checklist 8.2 (`APPROVED_WITH_RESTRICTIONS`); organiza o que falta coletar antes de promover hardening ou política operacional.

---

## 14. Fase 8.5 — Registro das Evidências Operacionais

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md`](VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md)  
**Status:** `APPROVED_WITH_RESTRICTIONS`

| Item | Situação |
|------|----------|
| Registro de evidências | OK — descritivo, sem binários no Git |
| Alinhamento com checklist 8.2 | Mantém `APPROVED_WITH_RESTRICTIONS` |
| Operadores | Ainda `A DEFINIR` |
| Conta real | **Bloqueada** |

**Conclusão:** evidências operacionais parciais registradas; pendências de infra VPS, operadores e prints visuais permanecem antes de promover hardening ou política para `APPROVED` pleno.

---

## 15. Fase 8.7 — Registro de Evidências Visuais Redigidas

**Data:** 2026-05-27  
**Documento:** [`docs/VPS-MT5-VISUAL-EVIDENCE-REGISTER.md`](VPS-MT5-VISUAL-EVIDENCE-REGISTER.md)  
**Status:** `APPROVED_WITH_RESTRICTIONS` (encerramento por declaração operacional — HALLYTON)

| Item | Situação |
|------|----------|
| Registro visual estruturado | OK |
| Prints commitados no Git | Não — **dispensados por sigilo** |
| Evidências visuais anexadas | Não — itens visuais sem anexo por política de sigilo |
| Validação | Declaração operacional do responsável |
| Operadores (Fase 8.6) | HALLYTON |
| Suplente | A DEFINIR |
| Conta real | **Bloqueada** |

**Conclusão:** Fase 8.7 encerrada com restrições. Itens visuais do hardening permanecem sem print anexado; para conta real futura será necessário novo gate com evidência adequada ou revisão presencial/controlada.

---

*Mercado da Riqueza AutoTrade — resultado do checklist de hardening VPS/MT5 com restrições. Conta real, produção real e dispatch automático permanecem bloqueados.*
