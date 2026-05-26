# Gate para Conta Demo com DebugMode=false — Mercado da Riqueza AutoTrade

Documento da **Fase 4.5** para definir os critérios obrigatórios antes de permitir um teste controlado em conta demo com o EA cliente em `DebugMode=false`, ou seja, permitindo envio de ordem para o MetaTrader demo, sem dinheiro real.

Este gate **não** libera produção real, **não** libera conta real, **não** libera ordem com dinheiro real e **não** libera dispatch automático. Este gate apenas prepara critérios para teste em conta **DEMO** com `DebugMode=false`.

---

## 1. Contexto

Histórico aprovado:

- Fase 3 aprovada com 10/10 ciclos.
- Fase 4.3 aprovada com Sessão Beta Demo nº 1.
- Fase 4.4 aprovada com sessões recorrentes.
- Todas as validações anteriores ocorreram com `DebugMode=true`.

O próximo risco operacional é permitir ordem demo real no terminal MT5, ainda sem dinheiro real.

---

## 2. Diferença entre DebugMode=true e DebugMode=false

### DebugMode=true

- EA recebe instruction.
- EA simula execution.
- Nenhuma ordem é enviada ao MetaTrader.

### DebugMode=false em DEMO

- EA recebe instruction.
- EA pode enviar ordem real para o MetaTrader demo.
- Não há dinheiro real.
- Há risco operacional de ordem demo incorreta, duplicada ou fora de regra.
- Exige limites e monitoramento.

### Conta REAL

- Continua proibida.
- Exige gate futuro específico.

---

## 3. Escopo autorizado

Autorizado somente após aprovação deste gate:

- 1 participante: Cliente Staging.
- 1 conta: `52609973 @ XPMT5-DEMO`.
- 1 ativo: `WDOM26`.
- 1 perfil: `conservador`.
- Conta DEMO.
- `DebugMode=false` apenas para sessão aprovada.
- Dispatch manual admin.
- Sem dispatch automático.
- Até 1 sinal por sessão inicial.
- Monitoramento em tempo real.

Não autorizado:

- conta real;
- dinheiro real;
- múltiplos clientes;
- múltiplos ativos;
- perfil agressivo;
- dispatch automático;
- produção pública;
- escala comercial;
- alteração de estratégia;
- cliente alterar parâmetros;
- execução sem monitoramento.

---

## 4. Pré-requisitos técnicos

- [ ] EA cliente compilado e instalado.
- [ ] EA cliente apontando para staging.
- [ ] WebRequest liberado.
- [ ] Conta MT5 demo correta.
- [ ] Licença ativa.
- [ ] Assinatura ativa.
- [ ] Device ativo.
- [ ] `allow_demo` habilitado.
- [ ] Heartbeat `ONLINE`.
- [ ] Painel admin acessível.
- [ ] Tracking funcionando.
- [ ] Rollback operacional conhecido.
- [ ] Nenhuma posição aberta antes do teste.
- [ ] Nenhuma ordem pendente antes do teste.
- [ ] Logs do MT5 visíveis.
- [ ] VPS/terminal estável, se aplicável.

---

## 5. Pré-requisitos operacionais

- [ ] Responsável acompanhando em tempo real.
- [ ] Horário da sessão definido.
- [ ] Ativo definido.
- [ ] Lado BUY/SELL definido antes.
- [ ] Quantidade/lote definido.
- [ ] Limite de uma instruction.
- [ ] Plano de pausa definido.
- [ ] Critério de encerramento definido.
- [ ] Registro de evidência obrigatório.
- [ ] Cliente/operador ciente de que é demo.

---

## 6. Limites obrigatórios para primeira sessão DebugMode=false

Limites conservadores:

- Conta: apenas DEMO.
- Ativo: `WDOM26`.
- Perfil: `conservador`.
- Quantidade: 1, salvo se o contrato atual do sistema usar outro valor fixo homologado.
- Sinais: máximo 1.
- Dispatch: manual admin.
- Horário: sessão acompanhada.
- Sem retry manual após execução.
- Sem múltiplas tentativas.
- Sem operação se houver instabilidade.
- Encerrar EA após o teste.

---

## 7. Critérios de aprovação do gate

Aprovar apenas se:

- participante beta demo aprovado;
- sessões recorrentes aprovadas;
- EA cliente estável;
- tracking estável;
- rollback testado;
- conta demo confirmada;
- `DebugMode=false` entendido como ordem demo;
- responsável definido;
- limites documentados;
- nenhum bloqueio em aberto.

Status possível:

`APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST`

---

## 8. Critérios de reprovação/bloqueio

Reprovar se:

- conta real estiver selecionada;
- `DebugMode=false` for usado fora de sessão aprovada;
- houver ordem aberta antes do teste;
- houver ordem pendente antes do teste;
- EA não estiver online;
- tracking estiver inconsistente;
- secret exposto;
- dispatch automático ocorrer;
- admin sem permissão conseguir disparar;
- divergência de conta/símbolo/perfil;
- rollback não estiver claro.

---

## 9. Roteiro da sessão futura

1. Confirmar conta demo.
2. Confirmar ausência de posição/ordem.
3. Confirmar EA online.
4. Alterar `DebugMode=false` somente para a sessão.
5. Criar `MasterSignal`.
6. Confirmar `VALIDATED` / `NOT_DISPATCHED`.
7. Admin revisar elegibilidade.
8. Admin disparar manualmente.
9. EA enviar ordem demo.
10. Confirmar ordem no MT5 demo.
11. Confirmar execution report.
12. Confirmar tracking.
13. Encerrar/zerar se necessário.
14. Voltar `DebugMode=true` ou remover EA.
15. Registrar evidência.

---

## 10. Rollback específico para DebugMode=false demo

- Remover EA do gráfico.
- Desabilitar AutoTrading no MT5, se necessário.
- Cancelar ordens pendentes demo.
- Fechar posições demo, se existirem.
- Pausar dispatch admin.
- Revogar device/token se necessário.
- Rotacionar secret se necessário.
- Registrar incidente.
- Voltar `DebugMode=true`.

---

## 11. Evidências necessárias

```text
Data/hora:
Responsável:
Conta MT5:
Tipo de conta:
DebugMode:
MasterSignalId:
InstructionId:
Ordem MT5 demo:
Ticket demo:
Resultado EA:
Resultado API:
Resultado tracking:
Ordem real enviada:
Posição final:
Rollback usado:
Status final:
Observações:
```

---

## 12. Decisão do gate

Status inicial: `PLANNED`

Opções:

- `APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

Mesmo se aprovado, este gate só autoriza uma sessão demo controlada com `DebugMode=false`. Não autoriza produção real.

---

*Mercado da Riqueza AutoTrade — Gate para conta demo com DebugMode=false. Produção real, conta real, dinheiro real e dispatch automático permanecem bloqueados.*
