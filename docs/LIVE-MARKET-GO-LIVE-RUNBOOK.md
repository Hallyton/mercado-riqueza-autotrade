# Runbook — Mercado ao vivo (REAL_MANUAL em lote)

**Fase:** 14.2 — Live Market Go-Live Readiness  
**Modo operacional:** `LIVE_MARKET` (sempre `source: REAL_MANUAL`)  
**Rota principal:** `/admin/real-trading/bulk-dispatch`

> O backend **não envia ordem ao broker**. Cria instructions REAL_MANUAL individuais; cada EA do cliente busca e executa na conta MT5 real.

---

## Pré-requisitos (antes de abrir o painel)

1. **EA / MT5 / VPS** — EA instalado, VPS online, mercado B3 aberto e operacional.
2. **LogLevel** — EA com `LogLevel = INFO` para auditoria operacional.
3. **TradeMode REAL** — Device ACTIVE com `tradeMode: REAL`; nunca TEST/HOMOLOGATION em conta real.
4. **Envio real no EA** — Confirmar que o EA está configurado para executar ordens reais na hora da operação (flag operacional do executor, não parâmetros de estratégia).
5. **Gates servidor** — `ENABLE_REAL_TRADING=true`, `ENABLE_AUTO_DISPATCH=false`.
6. **Aprovações** — RealTradingApproval APPROVED por cliente; PRE_MARKET REAL do dia válido.

---

## Fluxo operacional (obrigatório)

1. Abrir **Disparo em lote** (`/admin/real-trading/bulk-dispatch`).
2. Conferir card **Mercado ao vivo — Checklist final** (candidatos, elegíveis, devices, EAs, approvals).
3. Preencher **parâmetros da ordem**: símbolo, BUY/SELL, MARKET/LIMIT/STOP, preço se LIMIT/STOP, contratos.
4. Preencher **plano de gestão**: SL inicial, Take 1, Take 2 (se aplicável), Breakeven, Trailing Stop.
5. Clicar **Validar clientes elegíveis** (preview — expira em 5 minutos).
6. Revisar tabela **Clientes elegíveis** e **Clientes bloqueados** (motivo + ação + links).
7. Regularizar bloqueados conforme necessário (usuário, licença, approval, snapshot, protection).
8. **Revalidar elegibilidade** após regularizações.
9. Selecionar manualmente os elegíveis (desmarcar quem não deve receber).
10. Marcar **checklist final de envio real** (15 itens — todos obrigatórios).
11. Digitar confirmações textuais:
    - `AUTORIZO DISPARO REAL EM LOTE`
    - `AUTORIZO DISPARO REAL EM LOTE PARA X CLIENTES` (X = selecionados)
    - `ESTOU CIENTE QUE AS INSTRUCTIONS SERAO BUSCADAS PELOS EAS EM CONTAS REAIS`
12. Executar envio real ao vivo.
13. Acompanhar batch em `/admin/real-trading/bulk-dispatch/[batchId]` (botão **Atualizar acompanhamento**).
14. Acompanhar instructions em `/admin/real-trading/instructions?batchId=...`.
15. Acompanhar proteção em `/admin/real-trading/protection`.
16. Registrar resultado final no log operacional interno.

---

## Pós-envio — o que monitorar

| Área | O que verificar |
|------|-----------------|
| Instruction | Status RECEIVED → SENT → EXECUTED (ou terminal) |
| EA | Heartbeat recente, device ACTIVE + REAL |
| Execução MT5 | Ordem apregoada / posição aberta conforme tipo |
| Proteção | PROTECTION_CONFIRMED com SL inicial; takes/BE/TS via management events |
| Gestão | Eventos em `/api/v1/ea/management-events` refletidos no detalhe da instruction |

Mensagem esperada após execute: *"Instructions REAL_MANUAL criadas. Acompanhe o recebimento pelos EAs, execução no MT5 e confirmação de proteção."*

---

## Tratamento de incidentes

### Ordem rejeitada pelo broker

- Verificar motivo no MT5 e no painel de instructions.
- Se não houve posição: encerrar via **Encerrar sem ordem apregoada** quando aplicável.
- Nova tentativa exige **novo preview/preflight**.

### Ordem não apregoada (sem posição)

- API: `POST .../instructions/[instructionId]/close-no-order`
- Confirmação: `ENCERRAR INSTRUCTION SEM ORDEM APREGOADA`
- Protection: `SKIPPED_NO_POSITION` — não bloqueia nova tentativa após novo preflight.

### Falso positivo de execução

- API: `POST .../instructions/[instructionId]/void-false-execution`
- Confirmação: `ANULAR FALSO POSITIVO DE EXECUCAO`
- Status: `VOIDED_FALSE_EXECUTION` — nova tentativa após novo preflight.

### PROTECTION_FAILED

- Bloqueia novas REAL_MANUAL até regularização em `/admin/real-trading/protection`.
- Não marcar execução como confirmada sem evidência real de SL/proteção.

---

## O que fazer se...

| Situação | Ação recomendada |
|----------|------------------|
| **HEARTBEAT_STALE** | Verificar VPS/MT5/EA; aguardar heartbeat; não incluir cliente até EA online. |
| **PRE_MARKET_MISSING** | Cliente enviar snapshot PRE_MARKET REAL do dia via EA ou regularizar em `/admin/real-trading/snapshots`. |
| **REAL_APPROVAL_MISSING** | Criar/aprovar em `/admin/real-trading/approvals` com licenseId, conta, símbolo, magic e maxContracts. |
| **MARGIN_INSUFFICIENT** | Cliente ajustar margem/conta; revalidar preview. |
| **EA_OFFLINE** | Reiniciar EA/VPS; confirmar device ACTIVE + REAL. |
| **Ordem rejeitada** | Analisar MT5; close-no-order ou aguardar gestão conforme política. |
| **Ordem não apregoada** | close-no-order com atestação operacional. |
| **Falso positivo** | void-false-execution; nunca apagar registro fisicamente. |
| **PROTECTION_FAILED** | Corrigir SL/proteção no MT5; revisar painel protection antes de novo dispatch. |
| **B3/broker indisponível** | Abortar dispatch; aguardar mercado; status externo: `PHASE_14_READY_WITH_EXTERNAL_LIVE_MARKET_DEPENDENCY`. |

---

## Regras absolutas (não violar)

- Não pular preview.
- Não enviar para bloqueado.
- Não converter LIMIT/STOP em MARKET.
- Não ativar dispatch automático.
- Não usar TEST/HOMOLOGATION em conta REAL.
- Não marcar execução sem evidência real no MT5.
- Toda nova tentativa exige novo preview/preflight válido.

---

*Mercado da Riqueza AutoTrade — operação caixa preta. Este runbook não expõe estratégia ao cliente.*
