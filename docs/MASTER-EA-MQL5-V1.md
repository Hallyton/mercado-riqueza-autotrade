# EA Mãe MQL5 v1 — `MR_AutoTrade_Master_Signal`

Emissor **manual** de sinais mestres para `POST /api/master/signals`. Equivalente ao simulador HTTP (`npm run master:signal`), executado no MetaTrader 5.

## O que este EA faz

- Envia um `MasterSignal` para a API (intake).
- Exibe status no gráfico e nos logs do Experts.

## O que este EA **não** faz

- **Não** contém estratégia (Fibo, POC, indicadores, filtros, horários automáticos, entradas/saídas automáticas).
- **Não** envia ordens ao broker (`OrderSend` não é usado).
- **Não** dispara clientes automaticamente — dispatch continua **manual** no painel admin.
- **Não** substitui o EA cliente executor (`MR_AutoTrade_Executor`).

## Instalação

1. Copie para a pasta do MetaTrader 5:

| Origem | Destino |
|--------|---------|
| `ea/mql5/MR_AutoTrade_Master_Signal.mq5` | `MQL5/Experts/MercadoDaRiqueza/` |
| `ea/mql5/includes/MR_MS_*.mqh` | `MQL5/Experts/MercadoDaRiqueza/includes/` |

2. Compile `MR_AutoTrade_Master_Signal.mq5` no MetaEditor.

3. **WebRequest:** em **Ferramentas → Opções → Expert Advisors**, marque *Permitir WebRequest para as seguintes URLs* e adicione:

```
https://autotrade-staging.mercadodariqueza.com.br
```

(Use a mesma base configurada em `InpApiBaseUrl`.)

## Inputs

| Input | Default | Descrição |
|-------|---------|-----------|
| `InpApiBaseUrl` | staging oficial | Base HTTPS (sem barra final) |
| `InpMasterSecret` | *(vazio)* | `MASTER_EA_API_SECRET` do ambiente — **não logar** |
| `InpMasterSignalId` | *(vazio)* | Gera `master-mt5-YYYYMMDD-HHMMSS` se vazio |
| `InpSymbol` | `WDOM26` | Símbolo |
| `InpSide` | `BUY` | `BUY` / `SELL` |
| `InpOrderType` | `MARKET` | `MARKET`, `LIMIT`, `STOP`, `STOP_LIMIT` |
| `InpPurpose` | `ENTRY` | `ENTRY`, `EXIT`, `ADJUSTMENT` |
| `InpProfile` | `conservador` | Perfil de exposição |
| `InpExpiresSeconds` | `300` | TTL 5–300 s |
| `InpSendOnInit` | `false` | **Desligado** por segurança |
| `InpSendOnce` | `true` | Bloqueia novo envio após 201/200 idempotente |
| `InpDebugLog` | `true` | Payload no log (sem secret) |

## Como preencher o secret

1. Obtenha `MASTER_EA_API_SECRET` do ambiente Vercel/staging (nunca commitar).
2. Cole em `InpMasterSecret` nos inputs do EA ao anexar ao gráfico.
3. O secret **não** aparece no comentário do gráfico nem nos logs (`Authorization: Bearer ***REDACTED***`).

Não salvar secret em arquivos, GlobalVariables ou Common Files.

## Como enviar um sinal

**Recomendado:** anexe o EA a um gráfico e clique no botão **Enviar sinal mestre**.

Alternativa (teste): `InpSendOnInit=true` envia uma vez ao anexar.

Payload enviado:

```json
{
  "master_signal_id": "...",
  "source": "MASTER_EA",
  "symbol": "WDOM26",
  "side": "BUY",
  "order_type": "MARKET",
  "purpose": "ENTRY",
  "profile": "conservador",
  "expires_in_seconds": 300,
  "idempotency_key": "<master_signal_id>-key"
}
```

## Validar no painel admin

1. Abra `https://autotrade-staging.mercadodariqueza.com.br/admin/master-signals`
2. Confirme o sinal com status **VALIDATED**, consolidado **Não disparado**
3. Revise elegibilidade na seção de acompanhamento
4. Clique **Disparar para clientes** (OPS/SUPERADMIN) se quiser criar `Instruction` para clientes
5. EA cliente em `DebugMode=true` em homologação — sem ordem real

## Fluxo completo

```
EA Mãe (POST intake) → MasterSignal VALIDATED / NOT_STARTED
       → Admin revisa no painel
       → Admin dispara manualmente
       → Instructions MASTER_SIGNAL → EA cliente (já homologado)
```

## Respostas HTTP

| HTTP | Significado |
|------|-------------|
| 201 | Criado — `VALIDATED`, `dispatch: NOT_STARTED` |
| 200 + `idempotent` | Retry idempotente |
| 400 | Payload inválido |
| 401 | Secret inválido/ausente |
| 409 | Conflito de idempotency/payload |
| 503 | Secret não configurado no servidor |
| WebRequest -1 | URL não liberada no MT5 |

## Erros comuns

- **401** — `InpMasterSecret` incorreto ou vazio.
- **400** — `expires` fora de 5–300 ou campo inválido.
- **409** — mesmo `idempotency_key` com payload diferente.
- **WebRequest -1** — adicionar URL nas opções do terminal.
- **Sinal expirado** — disparar no admin antes do TTL (`InpExpiresSeconds`).

## Segurança

- Não compartilhar `MASTER_EA_API_SECRET`.
- Não usar em conta real de produção sem autorização explícita.
- Não anexar EA Mãe e EA cliente no mesmo gráfico esperando automação — são papéis distintos.
- Homologação: manter EA cliente com `InpDebugMode=true`.

## Homologação staging (aprovada — maio/2026)

Validado em `https://autotrade-staging.mercadodariqueza.com.br` com o EA `MR_AutoTrade_Master_Signal` no MetaTrader 5 (commit `9e649a6`):

| Campo / métrica | Resultado |
|----------------|-----------|
| Ferramenta | EA Mãe MQL5 v1 — botão **Enviar sinal mestre** |
| `source` | `MASTER_EA` |
| `symbol` / `side` / `purpose` / `profile` | `WDOM26` / `BUY` / `ENTRY` / `conservador` |
| Status DB | `VALIDATED` |
| Consolidado no painel | **Não disparado** |
| Dispatches | 0 |
| Instructions | 0 |
| Executions | 0 |
| `InpSendOnce=true` | OK — trava reenvio na mesma sessão |
| Fluxo admin-trigger após intake | OK — revisão → disparo manual → `Instruction` → EA cliente |

Isso confirma que o EA Mãe realiza **somente intake** via `POST /api/master/signals`; **não** contém estratégia real, **não** envia ordem ao broker e **não** dispara clientes automaticamente. O disparo para licenças elegíveis continua no painel admin (**Disparar para clientes**).

## Arquivos

- `ea/mql5/MR_AutoTrade_Master_Signal.mq5`
- `ea/mql5/includes/MR_MS_*.mqh`
