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

---

## 2. Pré-check obrigatório

- [ ] Conta MT5 confirmada como DEMO.
- [ ] Nenhuma posição aberta antes da sessão.
- [ ] Nenhuma ordem pendente antes da sessão.
- [ ] EA cliente instalado.
- [ ] EA cliente apontando para staging.
- [ ] WebRequest liberado.
- [ ] Heartbeat `ONLINE`.
- [ ] Logs MT5 visíveis.
- [ ] AutoTrading sob controle.
- [ ] Rollback conhecido.
- [ ] Admin acompanhando em tempo real.
- [ ] `MASTER_EA_API_SECRET` protegido.
- [ ] Produção real bloqueada.
- [ ] Conta real bloqueada.
- [ ] Dispatch automático bloqueado.

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

## 4. Sinal autorizado

**MasterSignalId planejado:** `demo-dmf-001-buy-001`

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

Nenhum outro sinal está autorizado nesta sessão. Não há autorização para retry manual após execução.

---

## 5. Evidências a preencher após execução

```text
Data/hora:
Responsável:
MasterSignalId:
InstructionId:
Ticket MT5 demo:
Resultado intake:
Resultado dispatch:
Resultado EA:
Resultado MT5 demo:
Resultado execution report:
Resultado tracking:
DebugMode:
Ordem em conta demo enviada:
Ordem em conta real enviada:
Posição final:
Rollback usado:
Incidentes:
Status final:
```

---

## 6. Critérios de aprovação

A sessão só pode ser `APPROVED` se:

- conta era DEMO;
- `DebugMode=false` foi usado somente nessa sessão;
- apenas 1 sinal foi enviado;
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

**Status atual:** `PLANNED`

Opções:

- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`
- `PAUSED`

A sessão ainda não foi executada neste documento. O status final deve ser atualizado somente após preenchimento das evidências.

---

*Mercado da Riqueza AutoTrade — Sessão Demo Controlada nº 1 com DebugMode=false. Produção real, conta real e dispatch automático permanecem bloqueados.*
