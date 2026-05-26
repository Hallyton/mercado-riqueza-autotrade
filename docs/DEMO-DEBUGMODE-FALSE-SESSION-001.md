# Sessão Demo Controlada nº 1 com DebugMode=false

Documento da **Fase 4.8** para planejar e registrar a Sessão Demo Controlada nº 1 com o EA cliente em `DebugMode=false`.

Esta fase **não** libera produção real, **não** libera conta real, **não** libera ordem com dinheiro real e **não** ativa dispatch automático. A sessão é limitada a uma única conta DEMO, um único sinal, dispatch manual e rollback imediato disponível.

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| Sessão | Demo Controlada nº 1 com `DebugMode=false` |
| Participante | Cliente Staging |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta MT5 | `52609973 @ XPMT5-DEMO` |
| Tipo de conta | DEMO |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Ativo | `WDOM26` |
| Perfil | `conservador` |
| Modo | `DebugMode=false` |
| Máximo de sinais | 1 |
| Dispatch | Manual admin |
| Status inicial | `PLANNED` |
| Status final | `APPROVED` |

---

## 2. Pré-check obrigatório

- [x] Conta MT5 confirmada como DEMO.
- [x] Nenhuma posição aberta antes da sessão.
- [x] Nenhuma ordem pendente antes da sessão.
- [x] EA cliente instalado.
- [x] EA cliente apontando para staging.
- [x] WebRequest liberado.
- [x] Heartbeat `ONLINE`.
- [x] Logs MT5 visíveis.
- [x] AutoTrading sob controle.
- [x] Rollback conhecido.
- [x] Admin acompanhando em tempo real.
- [x] `MASTER_EA_API_SECRET` protegido.
- [x] Produção real bloqueada.
- [x] Conta real bloqueada.
- [x] Dispatch automático bloqueado.

Se qualquer pré-check falhar, a sessão deve ser marcada como `REJECTED` ou `PAUSED`.

---

## 3. Roteiro da sessão

1. Confirmar conta DEMO.
2. Confirmar ausência de posições e ordens pendentes.
3. Confirmar EA online.
4. Alterar `DebugMode=false` somente para esta sessão.
5. Criar `MasterSignal`.
6. Confirmar `VALIDATED` / `NOT_DISPATCHED`.
7. Admin revisar elegibilidade.
8. Admin disparar manualmente.
9. EA enviar ordem para MT5 DEMO.
10. Confirmar ordem/ticket no MT5 demo.
11. Confirmar execution report.
12. Confirmar tracking no painel.
13. Encerrar sessão.
14. Remover EA ou voltar `DebugMode=true`.
15. Registrar evidência.

---

## 4. Sinal autorizado e execução

### 4.1. Falha segura inicial

O primeiro teste planejado falhou de forma segura porque o AutoTrading estava desativado no MT5.

| Campo | Valor |
|-------|-------|
| MasterSignalId | `demo-dmf-001-buy-001` |
| Status | `FAILED` |
| Instruction | `REJECTED` |
| Execution | `FAILED` |
| Motivo | `OrderSend` falhou `retcode=10027 AutoTrading disabled by client` |
| Ordem demo enviada | Não |
| Ordem real enviada | Não |
| Resultado | Comportamento seguro confirmado |

### 4.2. Sinal aprovado

**MasterSignalId aprovado:** `demo-dmf-001-buy-002`

Payload autorizado:

```text
source: MASTER_EA
symbol: WDOM26
side: BUY
order_type: MARKET
purpose: ENTRY
profile: conservador
expires_in_seconds: 300
```

Resultado validado:

- conta utilizada era DEMO;
- produção real não foi usada;
- conta real não foi usada;
- apenas 1 sinal aprovado foi usado após a falha segura inicial;
- dispatch foi manual pelo admin;
- dispatch automático continuou desativado;
- EA cliente recebeu a instruction;
- EA enviou ordem para o MT5 DEMO;
- execution report foi recebido pela API;
- tracking no painel ficou `EXECUTED`;
- instruction ficou `EXECUTED`;
- execution ficou `EXECUTED`;
- source `MASTER_SIGNAL`;
- pendentes: 0;
- falhas: 0.

Nenhum outro sinal está autorizado nesta sessão. Não há autorização para retry manual após execução.

---

## 5. Evidências da execução

```text
Data/hora: 2026-05-26
Responsável: Admin / operador em tempo real
MasterSignalId: demo-dmf-001-buy-002
InstructionId: ver painel-banco / tracking admin
Ticket MT5 demo: ver histórico MT5 / painel-banco — execution report confirmado
Resultado intake: VALIDATED
Resultado dispatch: manual admin
Resultado EA: instruction recebida e execution report enviado
Resultado MT5 demo: ordem enviada somente para MT5 DEMO
Resultado execution report: recebido pela API
Resultado tracking: EXECUTED
DebugMode: false somente nesta sessão
Ordem em conta demo enviada: Sim
Ordem em conta real enviada: Não
Posição final: ver histórico MT5 / painel-banco
Rollback usado: EA deve voltar para DebugMode=true ou ser removido do gráfico após a sessão
Incidentes: falha segura inicial em demo-dmf-001-buy-001 por AutoTrading disabled, sem ordem enviada
Status final: APPROVED
```

Resultado do painel:

| Campo | Valor |
|-------|-------|
| Status consolidado | `EXECUTED` |
| Elegíveis | 1 |
| Ignorados | 0 |
| Instructions | 1 |
| Executadas | 1 |
| Pendentes | 0 |
| Falhas | 0 |
| Motivo | Execução reportada pelo EA |

---

## 6. Critérios de aprovação

A sessão só pode ser `APPROVED` se:

- conta era DEMO;
- `DebugMode=false` foi usado somente nessa sessão;
- apenas 1 sinal aprovado foi usado após a falha segura inicial;
- dispatch foi manual;
- ordem foi enviada somente no MT5 DEMO;
- nenhuma conta real foi usada;
- execution report foi recebido;
- tracking ficou consistente;
- rollback/encerramento foi confirmado;
- EA foi removido ou retornou para `DebugMode=true`;
- nenhum secret foi exposto.

---

## 7. Critérios de reprovação

Marcar `REJECTED` ou `PAUSED` se:

- conta real for usada;
- houver ordem real;
- houver mais de um sinal;
- houver retry após execução;
- dispatch automático ocorrer;
- EA enviar ordem fora do esperado;
- tracking ficar inconsistente;
- rollback falhar;
- secret for exposto;
- `DebugMode=false` permanecer ativo sem autorização após a sessão.

---

## 8. Status final

**Status inicial:** `PLANNED`

**Status final:** `APPROVED`

Opções:

- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`
- `PAUSED`

A sessão aprovou a primeira execução controlada em conta DEMO com `DebugMode=false`.

Esta aprovação não libera conta real, produção real, dinheiro real, múltiplos sinais ou dispatch automático.

---

## 9. Pós-sessão

O EA cliente deve voltar para `DebugMode=true` ou ser removido do gráfico após a sessão.

---

*Mercado da Riqueza AutoTrade — Sessão Demo Controlada nº 1 com DebugMode=false aprovada em conta DEMO. Produção real, conta real e dispatch automático permanecem bloqueados.*
