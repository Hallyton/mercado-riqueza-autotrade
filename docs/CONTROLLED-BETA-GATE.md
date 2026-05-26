# Gate de Beta Controlado — Mercado da Riqueza AutoTrade

Documento da **Fase 4.1** para definir os critérios mínimos antes de sair da produção simulada interna e iniciar um beta controlado, com poucos participantes, regras rígidas, aceite explícito, monitoramento próximo e rollback operacional.

Este gate **não** libera produção real ampla, **não** libera escala comercial, **não** libera dispatch automático e **não** libera ordens reais sem decisão específica futura. O beta controlado é uma fase intermediária, restrita e supervisionada.

---

## 1. Contexto

A Fase 3 — Produção Simulada Controlada — foi encerrada com status final `APPROVED_FOR_CONTROLLED_BETA`.

Resultados consolidados:

- 10/10 ciclos simulados aprovados.
- 0 ordens reais enviadas.
- 0 dispatch automático.
- Rollback operacional testado.
- Tracking consolidado validado.
- Correção de no eligible licenses validada.

Fluxo validado:

```text
EA Mãe / simulador
  → intake
  → admin dispatch manual
  → Instruction MASTER_SIGNAL
  → EA cliente DebugMode
  → execution report
  → tracking
```

Referência: [`SIMULATED-PRODUCTION-FINAL-REPORT.md`](SIMULATED-PRODUCTION-FINAL-REPORT.md).

---

## 2. Definição de Beta Controlado

Beta controlado é um ambiente restrito e supervisionado para validar operação com poucos usuários, autorização manual, suporte próximo, riscos limitados, monitoramento diário e possibilidade de pausar tudo rapidamente.

### Beta controlado em DEMO

Permitido somente após aprovação deste gate.

Regras iniciais:

- Conta demo identificada e validada.
- Participante e licença identificados.
- Monitoramento operacional definido.
- Rollback entendido pela equipe.
- Dispatch continua manual.
- Alternativa mais segura: manter `DebugMode=true` inicialmente.
- `DebugMode=false` só pode ser usado em conta demo se a decisão formal da fase permitir e estiver documentada.

### Beta controlado com conta REAL

**Não liberado por este documento.**

Conta real exige novo gate específico, incluindo:

- termo de aceite;
- limite de capital;
- autorização explícita do responsável;
- regra de risco;
- rollback de emergência;
- aprovação manual antes de qualquer execução real.

---

## 3. Escopo do Gate

### Dentro do escopo

- Seleção de participantes.
- Requisitos técnicos.
- Requisitos operacionais.
- Aceite do cliente.
- Critérios de entrada.
- Critérios de saída.
- Limites de risco.
- Suporte.
- Monitoramento.
- Rollback.
- Auditoria.
- Documentação de evidências.

### Fora de escopo

- Lançamento público.
- Produção real ampla.
- Múltiplos ativos sem homologação.
- Billing comercial completo.
- DARF.
- Marketing público.
- Promessas de rentabilidade.
- Estratégia caixa preta definitiva.
- Capital real sem aprovação futura.

---

## 4. Critérios obrigatórios para iniciar beta controlado

Todos os itens aplicáveis devem estar **OK** antes de aprovar o início do beta.

### Ambiente

- [ ] Staging validado.
- [ ] Domínio oficial funcionando.
- [ ] Vercel staging estável.
- [ ] Neon staging estável.
- [ ] Migrations aplicadas.
- [ ] Logs e tracking disponíveis.

### Produto

- [ ] `MasterSignal` funcionando.
- [ ] Admin trigger manual funcionando.
- [ ] Tracking consolidado funcionando.
- [ ] Idempotência funcionando.
- [ ] Expiração funcionando.
- [ ] Profile mismatch bloqueando corretamente.
- [ ] Rollback operacional testado.

### EA

- [ ] EA cliente instalado e validado.
- [ ] EA Mãe ou simulador homologado.
- [ ] WebRequest configurado.
- [ ] Logs habilitados.
- [ ] Modo operacional definido: `DebugMode=true` ou demo controlada, conforme decisão formal.

### Participantes

- [ ] Cliente identificado.
- [ ] Conta MT5 identificada.
- [ ] Corretora/servidor identificados.
- [ ] Licença ativa.
- [ ] Plano/perfil definido.
- [ ] Limites entendidos.
- [ ] Aceite registrado.

### Operação

- [ ] Responsável pelo monitoramento definido.
- [ ] Horário de operação definido.
- [ ] Ativo permitido definido.
- [ ] Perfil de exposição definido.
- [ ] Rotina de início/fim do dia definida.
- [ ] Procedimento de pausa definido.

---

## 5. Perfis permitidos no beta

| Item | Padrão inicial |
|------|----------------|
| Perfil padrão | `conservador` |
| Ativo padrão | `WDOM26` ou ativo homologado no staging |
| Conta padrão | demo |
| Modo inicial recomendado | `DebugMode=true` ou demo sem dinheiro real |

Proibido nesta fase:

- perfil agressivo para cliente real;
- múltiplos ativos;
- múltiplos clientes simultâneos sem nova aprovação;
- alteração manual de estratégia pelo cliente;
- dispatch automático;
- produção real sem gate adicional.

---

## 6. Limites de risco

Mesmo sem liberar conta real neste gate, os limites futuros mínimos devem ser definidos antes de qualquer avanço para real:

- capital máximo por conta beta;
- lote máximo por operação;
- limite diário de perda;
- limite diário de operações;
- limite de horários;
- limite de ativos;
- limite de clientes simultâneos;
- pausa automática/manual;
- autorização para encerrar o teste a qualquer momento.

Os valores finais devem ser definidos em fase posterior antes de qualquer operação real.

---

## 7. Termo de aceite do participante

Antes do beta, o participante deve aceitar pelo menos os itens abaixo. Esta seção define requisitos mínimos para futuro termo; não substitui documento jurídico.

- Entende que é beta.
- Entende que pode haver falhas.
- Entende que não há promessa de lucro.
- Entende riscos de mercado.
- Autoriza monitoramento técnico.
- Aceita que o serviço pode ser pausado.
- Aceita que a estratégia é caixa preta.
- Não terá acesso aos parâmetros internos.
- Deve manter conta/MT5/VPS conforme orientação.
- Deve informar qualquer alteração na conta.
- Deve não alterar configurações sem autorização.

---

## 8. Monitoramento obrigatório

Todo beta precisa monitorar:

- heartbeat do EA;
- última instrução;
- status da licença;
- status do device;
- status do sinal;
- executions;
- falhas;
- divergência de conta;
- logs do MT5;
- tracking no admin;
- evidência diária.

---

## 9. Critérios de reprovação do beta

O beta deve ser pausado ou reprovado se qualquer item ocorrer:

- Ordem real enviada sem autorização de fase.
- `DebugMode=false` quando deveria estar `true`.
- Dispatch automático.
- Instruction duplicada indevidamente.
- EA offline sem tratamento.
- Tracking inconsistente.
- Secret em log, print ou commit.
- Cliente alterando configuração sem autorização.
- Perda acima do limite definido.
- Ativo/conta divergente.
- Falta de evidência operacional.
- Falha de rollback.

---

## 10. Plano de rollback do beta

Rollback operacional:

1. Pausar disparos admin.
2. Remover EA cliente do gráfico.
3. Remover EA Mãe.
4. Desabilitar WebRequest.
5. Revogar device/token/licença.
6. Rotacionar `MASTER_EA_API_SECRET` se necessário.
7. Pausar usuário/assinatura.
8. Reverter deploy se houver bug de aplicação.
9. Manter auditoria e histórico.
10. Registrar incidente.

---

## 11. Evidências necessárias por participante

```text
Participante:
E-mail:
LicenseId:
MT5 login/server:
Conta demo/real:
Perfil:
Ativo:
Modo:
Data início:
Data fim:
Responsável interno:
Aceite registrado:
Limites:
Resultado:
Incidentes:
Status final:
```

---

## 12. Decisão do gate

| Status | Significado |
|--------|-------------|
| `APPROVED_FOR_DEMO_BETA` | Documentação completa; participante identificado; conta demo validada; EA instalado; monitoramento definido; rollback entendido; produção real bloqueada |
| `APPROVED_WITH_RESTRICTIONS` | Gate aprovado parcialmente com restrições explícitas e bloqueios registrados |
| `REJECTED` | Critérios obrigatórios incompletos ou risco operacional não aceito |

Critérios para `APPROVED_FOR_DEMO_BETA`:

- documentação completa;
- participante identificado;
- conta demo validada;
- EA instalado;
- monitoramento definido;
- rollback entendido;
- produção real bloqueada.

Critério para beta real:

**Não aprovado aqui.** Beta real exige gate futuro específico.

---

## 13. Próximos passos após aprovação do gate

Se aprovado:

- criar registro do primeiro participante beta;
- rodar beta em conta demo;
- acompanhar por período definido;
- registrar evidências;
- criar relatório de beta.

Se reprovado:

- registrar bloqueios;
- corrigir pontos;
- repetir gate.

---

*Mercado da Riqueza AutoTrade — Gate de Beta Controlado. Produção real e ordem real permanecem bloqueadas.*
