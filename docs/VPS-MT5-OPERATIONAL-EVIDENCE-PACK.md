# Pacote de Evidências Operacionais — VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.4 — Pacote de Evidências Operacionais VPS/MT5  
**Status:** `PENDING_EVIDENCE`

Documentos relacionados: [`docs/VPS-MT5-HARDENING-VALIDATION.md`](VPS-MT5-HARDENING-VALIDATION.md), [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md), [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md), [`docs/PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md).

---

## 1. Contexto

A **Fase 8.2** registrou o checklist de hardening como `APPROVED_WITH_RESTRICTIONS`, com pendências em VPS/Windows, `MQL5/Files`, WebRequest completo, logs MT5 reais e operadores.

A **Fase 8.3** formalizou operadores, matriz de permissões e política de **AutoTrading** (`DRAFT_OPERATIONAL_POLICY`), mas os **nomes dos responsáveis** permanecem `A DEFINIR`.

Esta fase **organiza** quais evidências visuais e operacionais devem ser coletadas, armazenadas e referenciadas **antes de qualquer avanço** de gate (incluindo discussão de conta real).

Conta real continua **bloqueada**. Produção real continua **bloqueada**. Dispatch automático continua **desativado**.

**Armazenamento sugerido:** pasta interna segura (fora do Git), por exemplo `evidencias/vps-mt5-staging/` com subpastas por data e tipo — apenas referência neste documento; não commitar prints nem arquivos com dados sensíveis.

---

## 2. Regras para coleta de evidências

| Regra | Obrigatório |
|-------|-------------|
| Nunca mostrar `device_token` | Sim |
| Nunca mostrar activation code | Sim |
| Nunca mostrar `InpMasterSecret` | Sim |
| Nunca mostrar `Authorization` / `Bearer` com valor | Sim |
| Nunca mostrar senha da conta MT5 | Sim |
| Nunca mostrar `DATABASE_URL`, `AUTH_SECRET` ou `MASTER_EA_API_SECRET` | Sim |
| Redigir ou cortar prints **antes** de salvar | Sim |
| Evidência deve comprovar **configuração**, não expor segredo | Sim |
| Não enviar evidências por WhatsApp, e-mail público ou chat sem cofre | Sim |
| Revisar cada print com a pergunta: “Um screenshot disso vazaria credencial?” | Sim |

---

## 3. Evidências de VPS/Windows

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Print do Windows indicando ambiente dedicado ou identificação da VPS | PENDENTE | |
| 2 | Print ou anotação de Windows Update atualizado | PENDENTE | |
| 3 | Print ou anotação do Defender/antivírus ativo | PENDENTE | |
| 4 | Print ou anotação do firewall ativo | PENDENTE | |
| 5 | Registro de quem acessa a VPS (lista de operadores autorizados) | PENDENTE | |
| 6 | Política de RDP/acesso remoto (VPN, IP allowlist, 2FA — redigido) | PENDENTE | |

**Observação:** não incluir IP público, senha, usuário sensível ou dados privados sem redaction.

---

## 4. Evidências do MetaTrader 5

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Print da conta `52609973 @ XPMT5-DEMO` | PENDENTE | |
| 2 | Print confirmando tipo **DEMO** | PENDENTE | |
| 3 | Print do EA cliente (`MR_AutoTrade_Executor`) anexado ao gráfico | PENDENTE | |
| 4 | Print dos parâmetros do EA cliente, com tokens/activation code **ocultos** | PENDENTE | |
| 5 | Print de AutoTrading desligado fora de sessão ou controlado conforme política | PENDENTE | |
| 6 | Print de nenhuma ordem/posição pendente desconhecida | PENDENTE | |

---

## 5. Evidências de WebRequest

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Print da lista de URLs permitidas no MT5 | PENDENTE | |
| 2 | Confirmar domínio staging: `https://autotrade-staging.mercadodariqueza.com.br` | PENDENTE | |
| 3 | Confirmar ausência de domínios desnecessários | PENDENTE | |
| 4 | Confirmar que WebRequest não aponta para ambiente errado (produção, `www`, etc.) | PENDENTE | |

---

## 6. Evidências de MQL5/Files e tokens locais

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Print da pasta `MQL5/Files`, com nomes sensíveis ocultos se necessário | PENDENTE | |
| 2 | Confirmar que arquivos locais **não** estão versionados em Git | PENDENTE | |
| 3 | Confirmar que `device_token` **não** aparece em prints | PENDENTE | |
| 4 | Confirmar que `device_token` **não** foi compartilhado por WhatsApp/e-mail | PENDENTE | |
| 5 | Registrar procedimento de revogação do device (referência: homologação + runbook) | PENDENTE | |

---

## 7. Evidências de logs

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Amostra de log MT5 **sem secrets** (arquivo redigido) | PENDENTE | |
| 2 | Confirmar logs sem activation code | PENDENTE | |
| 3 | Confirmar logs sem `device_token` | PENDENTE | |
| 4 | Confirmar logs sem `InpMasterSecret` | PENDENTE | |
| 5 | Confirmar logs sem `Authorization` / `Bearer` com valor | PENDENTE | |

---

## 8. Evidências de operadores

| # | Evidência | Status | Arquivo / referência |
|---|-----------|--------|-------------------|
| 1 | Responsável técnico definido | PENDENTE | |
| 2 | Responsável operacional definido | PENDENTE | |
| 3 | Operador MT5/VPS definido | PENDENTE | |
| 4 | Admin autorizado ao dispatch definido | PENDENTE | |
| 5 | Responsável pelo rollback definido | PENDENTE | |
| 6 | Responsável por evidências definido | PENDENTE | |
| 7 | Responsável por revisão pós-sessão definido | PENDENTE | |

**Referência:** preencher em [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md) e marcar aqui como OK quando concluído.

---

## 9. Evidência de sessão demo com AutoTrading controlado

Validação futura conforme [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md) (seções 6 e 7).

| Campo | Valor |
|-------|--------|
| **MasterSignalId** | A DEFINIR |
| **Conta** | `52609973 @ XPMT5-DEMO` |
| **DebugMode** | `true` |
| **tradeMode** | `DEMO` |
| **AutoTrading** | Controlado conforme política |
| **Status** | PENDENTE |
| **Prints** | Antes de ligar AutoTrading / após desligar / tracking admin |

**Evidências mínimas da sessão:**

- [ ] Checklist pré-sessão preenchido (runbook).
- [ ] Print AutoTrading **ligado** durante sessão (sem secrets).
- [ ] Print AutoTrading **desligado** ao encerrar.
- [ ] Tracking admin `EXECUTED` (ou status final documentado).
- [ ] Registro em [`PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md) seção 12 (template de evidência).

---

## 10. Decisão inicial

**Status:** `PENDING_EVIDENCE`

**Motivo:** este pacote organiza as evidências necessárias; prints redigidos, amostras de log e nomes de operadores ainda precisam ser anexados/registrados fora do Git.

Status possíveis:

| Status | Significado |
|--------|-------------|
| `PENDING_EVIDENCE` | Pacote criado; coleta em andamento |
| `APPROVED_WITH_RESTRICTIONS` | Maioria das evidências OK; pendências não críticas |
| `APPROVED` | Todas as evidências obrigatórias OK + operadores definidos |
| `REJECTED` | Falha crítica (secret exposto, conta real, WebRequest amplo, etc.) |

**Promoção sugerida:** após preenchimento, atualizar [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md) e status da Fase 8.2/8.4 conforme critérios da Fase 8.1.

---

## 11. Próxima ação recomendada

1. Coletar **prints redigidos** das seções 3–7 (VPS, MT5, WebRequest, `MQL5/Files`, logs).
2. Preencher **todos os operadores** (seção 8) na política 8.3.
3. Executar **sessão demo** com AutoTrading controlado (seção 9) e registrar `MasterSignalId`.
4. Atualizar coluna “Arquivo / referência” deste documento (ou índice externo) sem commitar binários no repositório.
5. Revisar checklist 8.2 e promover hardening apenas se critérios da Fase 8.1 forem atendidos.
6. Manter conta real, produção real e dispatch automático **bloqueados**.

---

## 12. Resumo de pendências (contagem)

| Categoria | Itens | Pendentes |
|-----------|-------|-----------|
| VPS/Windows | 6 | 6 |
| MetaTrader 5 | 6 | 6 |
| WebRequest | 4 | 4 |
| MQL5/Files | 5 | 5 |
| Logs | 5 | 5 |
| Operadores | 7 | 7 |
| Sessão AutoTrading | 1 bloco | 1 |

**Total aproximado:** 34 itens de evidência em `PENDENTE` até coleta manual.

---

*Mercado da Riqueza AutoTrade — pacote de evidências operacionais VPS/MT5. Não commitar secrets nem prints brutos. Conta real, produção real e dispatch automático permanecem bloqueados.*
