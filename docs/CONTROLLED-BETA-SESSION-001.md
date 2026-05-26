# Sessão Beta Demo Controlada nº 1 — Mercado da Riqueza AutoTrade

Roteiro e registro operacional da primeira sessão beta demo controlada do Participante Beta Demo nº 1, ainda em conta demo e com `DebugMode=true`.

Esta sessão **não** libera produção real, **não** libera ordem real, **não** libera dispatch automático e **não** altera lógica estratégica. A sessão serve para validar o processo operacional de beta com participante identificado.

---

## 1. Identificação da sessão

| Campo | Valor |
|-------|-------|
| Sessão | Beta Demo Controlada nº 1 |
| Participante | Cliente Staging |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta MT5 | `52609973 @ XPMT5-DEMO` |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Ativo | `WDOM26` |
| Perfil | `conservador` |
| Modo | `DebugMode=true` |
| Status inicial | `PLANNED` |
| Status final | `APPROVED` |
| MasterSignalId oficial | `beta-demo-001-buy-002` |

---

## 2. Escopo autorizado da sessão

### Autorizado

- 1 participante.
- 1 conta demo.
- 1 ativo `WDOM26`.
- Perfil `conservador`.
- Até 1 ou 2 sinais de teste.
- Dispatch manual admin.
- `DebugMode=true`.
- Tracking e evidências.

### Não autorizado

- Conta real.
- Ordem real.
- `DebugMode=false`.
- Dispatch automático.
- Perfil agressivo.
- Múltiplos clientes.
- Múltiplos ativos.
- Alteração de lógica.
- Alteração de env.
- Billing/cobrança.

---

## 3. Pré-check obrigatório

- [ ] Git limpo.
- [ ] Ambiente staging acessível.
- [ ] Admin acessível.
- [ ] Participante documentado.
- [ ] `LicenseId` correto.
- [ ] MT5 correto.
- [ ] EA cliente instalado.
- [ ] EA cliente em `DebugMode=true`.
- [ ] EA cliente heartbeat `ONLINE`.
- [ ] WebRequest liberado.
- [ ] EA Mãe ou simulador disponível.
- [ ] `MASTER_EA_API_SECRET` protegido.
- [ ] Nenhuma ordem real aberta.
- [ ] Rollback conhecido.

---

## 4. Roteiro da sessão

1. Confirmar EA cliente online.
2. Confirmar `DebugMode=true`.
3. Enviar `MasterSignal` pelo EA Mãe ou simulador.
4. Confirmar painel `VALIDATED` / `NOT_DISPATCHED`.
5. Admin revisar elegibilidade.
6. Admin disparar manualmente.
7. EA cliente receber instruction.
8. Confirmar `DEBUG_MODE` — ordem **NÃO** enviada.
9. Confirmar execution report.
10. Confirmar tracking `EXECUTED`.
11. Registrar evidência.
12. Encerrar sessão.
13. Confirmar nenhuma ordem real.
14. Confirmar status final.

---

## 5. Evidências da sessão

| Campo | Valor |
|-------|-------|
| Data/hora | 2026-05-26 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| MasterSignalId | `beta-demo-001-buy-002` |
| InstructionId | Ver painel/banco — tracking `EXECUTED` confirmado |
| Resultado intake | MasterSignal criado; painel mostrou `VALIDATED` / `NOT_DISPATCHED` antes do disparo; `POST /api/master/signals` continuou sem dispatch automático |
| Resultado preview | Admin revisou elegibilidade antes do disparo manual |
| Resultado dispatch | Admin disparou manualmente; `Instruction MASTER_SIGNAL` criada |
| Resultado EA cliente | EA cliente `MR_AutoTrade_Executor` anexado no gráfico, apontando para staging, com heartbeat `ONLINE`; instruction recebida; `DEBUG_MODE` impediu envio de ordem real; execution report enviado para a API |
| Resultado tracking | Tracking no painel ficou `EXECUTED`; Status consolidado: `EXECUTED`; Instructions: 1; Executadas: 1; Pendentes: 0; Falhas: 0; Source: `MASTER_SIGNAL` |
| DebugMode | `true` |
| Ordem real enviada | NÃO |
| Incidentes | Houve tentativa anterior com EAs não anexados ao gráfico; essa tentativa não foi usada como evidência principal da sessão |
| Rollback usado | Não |
| Status final | `APPROVED` |
| Observações | Evidência oficial registrada com `beta-demo-001-buy-002`, executada com EAs anexados e pré-check correto. Sessão aprovada com `DebugMode=true`, sem ordem real e com tracking `EXECUTED`. |

---

## 6. Critérios de aprovação

A sessão só pode ser aprovada se:

- `DebugMode=true`;
- nenhuma ordem real enviada;
- `POST /api/master/signals` continua sem dispatch automático;
- dispatch manual admin;
- instruction `MASTER_SIGNAL`;
- EA reporta execution;
- tracking `EXECUTED`;
- evidência registrada;
- nenhum secret exposto.

---

## 7. Critérios de reprovação

Reprovar ou pausar se:

- ordem real enviada;
- `DebugMode=false`;
- dispatch automático detectado;
- EA não reporta;
- tracking inconsistente;
- secret exposto;
- cliente/conta divergente;
- rollback falha.

---

## 8. Resultado final

Status final: `APPROVED`

Opções futuras:

- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`
- `PAUSED`

---

## 9. Próxima ação

Manter a produção real bloqueada e definir a próxima etapa operacional: Fase 4.4 — Plano de Sessões Beta Demo recorrentes ou Gate para Demo sem `DebugMode`, ainda sem conta real.

---

*Mercado da Riqueza AutoTrade — sessão beta demo controlada nº 1. Produção real, ordem real e dispatch automático permanecem bloqueados.*
