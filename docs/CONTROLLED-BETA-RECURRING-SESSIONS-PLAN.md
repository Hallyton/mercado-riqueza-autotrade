# Plano de Sessões Beta Demo Recorrentes — Mercado da Riqueza AutoTrade

Plano operacional da **Fase 4.4** para executar sessões recorrentes de beta demo com o Participante Beta Demo nº 1, ainda em conta demo e com `DebugMode=true`, antes de qualquer gate para `DebugMode=false`.

Este plano **não** libera produção real, **não** libera ordem real, **não** libera conta real, **não** libera dispatch automático e **não** libera `DebugMode=false`. O objetivo é consolidar estabilidade operacional por repetição.

---

## 1. Contexto

Histórico aprovado:

- Fase 3 teve 10/10 ciclos simulados aprovados.
- Sessão Beta Demo nº 1 foi aprovada com `beta-demo-001-buy-002`.
- Participante Cliente Staging está aprovado para sessão beta demo.
- O próximo objetivo é repetir sessões controladas para validar estabilidade.

Referências:

- [`CONTROLLED-BETA-PARTICIPANT-001.md`](CONTROLLED-BETA-PARTICIPANT-001.md)
- [`CONTROLLED-BETA-SESSION-001.md`](CONTROLLED-BETA-SESSION-001.md)
- [`CONTROLLED-BETA-GATE.md`](CONTROLLED-BETA-GATE.md)

---

## 2. Escopo

### Autorizado

- Participante Cliente Staging.
- Conta demo `52609973 @ XPMT5-DEMO`.
- Ativo `WDOM26`.
- Perfil `conservador`.
- `DebugMode=true`.
- Dispatch manual pelo admin.
- Até 1 ou 2 sinais por sessão.
- Registro de evidências por sessão.

### Não autorizado

- Conta real.
- Ordem real.
- `DebugMode=false`.
- Dispatch automático.
- Múltiplos clientes.
- Múltiplos ativos.
- Perfil agressivo.
- Alteração de lógica.
- Escala comercial.
- Promessa de resultado.

---

## 3. Frequência sugerida

Rotina inicial:

- mínimo de 3 sessões beta demo recorrentes;
- em pelo menos 2 dias diferentes;
- todas com `DebugMode=true`.

Cobertura mínima:

- 1 sessão BUY;
- 1 sessão SELL;
- 1 sessão com retry/idempotência ou expiração.

---

## 4. Checklist antes de cada sessão

- [ ] Git limpo ou sem alterações relevantes.
- [ ] Staging acessível.
- [ ] Admin acessível.
- [ ] Participante correto.
- [ ] `LicenseId` correto.
- [ ] Conta MT5 correta.
- [ ] EA cliente anexado.
- [ ] `DebugMode=true`.
- [ ] Heartbeat `ONLINE`.
- [ ] WebRequest liberado.
- [ ] EA Mãe ou simulador pronto.
- [ ] `MASTER_EA_API_SECRET` protegido.
- [ ] Nenhuma ordem real aberta.
- [ ] Rollback conhecido.

---

## 5. Roteiro de cada sessão

1. Confirmar pré-check.
2. Enviar `MasterSignal`.
3. Confirmar `VALIDATED` / `NOT_DISPATCHED`.
4. Admin revisar elegibilidade.
5. Admin disparar manualmente.
6. EA cliente receber instruction.
7. Confirmar `DEBUG_MODE` — ordem **NÃO** enviada.
8. Confirmar execution report.
9. Confirmar tracking `EXECUTED`.
10. Registrar evidências.
11. Encerrar sessão.
12. Confirmar nenhuma ordem real.

---

## 6. Registro das sessões recorrentes

| Sessão | Data | MasterSignalId | Side | Origem | InstructionId | DebugMode | Tracking | Ordem real | Status | Observações |
|--------|------|----------------|------|--------|---------------|-----------|----------|------------|--------|-------------|
| 02 | 2026-05-26 | `beta-demo-002-buy-001` | BUY | EA Mãe ou simulador | Ver painel/banco — tracking `EXECUTED` confirmado | true | `EXECUTED` | NÃO | APROVADA | Admin dispatch manual; `Instruction MASTER_SIGNAL`; EA processou em `DEBUG_MODE`; 1/1/1 |
| 03 | 2026-05-26 | `beta-demo-003-sell-001` | SELL | EA Mãe ou simulador | Ver painel/banco — tracking `EXECUTED` confirmado | true | `EXECUTED` | NÃO | APROVADA | Admin dispatch manual; `Instruction MASTER_SIGNAL`; EA processou em `DEBUG_MODE`; SELL validado |
| 04 | PENDENTE | PENDENTE | N/A | EA Mãe ou simulador | PENDENTE | true | PENDENTE | NÃO | PENDENTE | Retry/idempotência ou expiração |

### Sessão 02 — BUY via EA Mãe ou simulador

| Campo | Valor |
|-------|-------|
| Status final | APROVADA |
| MasterSignalId | `beta-demo-002-buy-001` |
| Participante | Cliente Staging |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Ativo | `WDOM26` |
| Side | BUY |
| OrderType | MARKET |
| Purpose | ENTRY |
| Profile | `conservador` |
| Modo | `DebugMode=true` |
| InstructionId | Ver painel/banco — tracking `EXECUTED` confirmado |
| Resultado intake | MasterSignal criado com sucesso; painel mostrou intake e dispatch |
| Resultado dispatch | Admin fez dispatch manual; dispatch automático continuou desativado |
| Resultado EA cliente | EA cliente processou a instruction; `DEBUG_MODE` impediu envio de ordem real; execution report recebido |
| Resultado painel | Status DB `DISPATCHED`; consolidado `EXECUTED`; Elegíveis: 1; Ignorados: 0; Instructions: 1; Executadas: 1; Pendentes: 0; Falhas: 0; Dispatches/instruções/executadas: 1/1/1; Source: `MASTER_SIGNAL` |
| Ordem real enviada | NÃO |
| Observações | Primeira sessão recorrente pós-beta demo aprovada com tracking `EXECUTED` e sem ordem real |

### Sessão 03 — SELL via EA Mãe ou simulador

| Campo | Valor |
|-------|-------|
| Status final | APROVADA |
| MasterSignalId | `beta-demo-003-sell-001` |
| Participante | Cliente Staging |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Ativo | `WDOM26` |
| Side | SELL |
| OrderType | MARKET |
| Purpose | ENTRY |
| Profile | `conservador` |
| Modo | `DebugMode=true` |
| InstructionId | Ver painel/banco — tracking `EXECUTED` confirmado |
| Resultado intake | MasterSignal criado com sucesso; painel mostrou `VALIDATED` / `NOT_DISPATCHED` antes do disparo |
| Resultado dispatch | Admin revisou elegibilidade e fez dispatch manual; dispatch automático continuou desativado |
| Resultado EA cliente | EA cliente processou a instruction; `DEBUG_MODE` impediu envio de ordem real; execution report recebido |
| Resultado painel | Status consolidado `EXECUTED`; Side: `SELL`; Instructions: 1; Executadas: 1; Pendentes: 0; Falhas: 0; Source: `MASTER_SIGNAL` |
| Ordem real enviada | NÃO |
| Observações | Sessão SELL recorrente aprovada com tracking `EXECUTED`, dispatch manual e sem ordem real |

---

## 7. Critérios de aprovação de cada sessão

Aprovar somente se:

- `DebugMode=true`;
- nenhuma ordem real enviada;
- `POST /api/master/signals` continua sem dispatch automático;
- dispatch manual admin;
- `Instruction MASTER_SIGNAL`;
- EA reporta execution quando aplicável;
- tracking correto;
- evidência registrada;
- nenhum secret exposto.

---

## 8. Critérios de pausa

Pausar se:

- `DebugMode=false`;
- ordem real enviada;
- dispatch automático detectado;
- EA não reporta;
- tracking inconsistente;
- secret exposto;
- conta divergente;
- cliente altera configuração;
- rollback falha.

---

## 9. Critério para avançar para próximo gate

Somente discutir Gate para Demo com `DebugMode=false` se:

- todas as sessões recorrentes forem aprovadas;
- 0 ordens reais;
- 0 dispatch automático;
- 0 duplicidades indevidas;
- 0 secrets expostos;
- tracking consistente;
- rollback conhecido.

---

## 10. Status do plano

Status atual: `IN_PROGRESS`

Opções futuras:

- `IN_PROGRESS`
- `APPROVED_FOR_DEBUGMODE_FALSE_GATE`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

---

*Mercado da Riqueza AutoTrade — plano de sessões beta demo recorrentes. Produção real, ordem real, conta real, dispatch automático e DebugMode=false permanecem bloqueados.*
