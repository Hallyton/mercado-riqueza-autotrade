# Gate de Conta Real Ultra-Controlada — Mercado da Riqueza AutoTrade

Documento da **Fase 5.1** para definir os critérios mínimos antes de sequer considerar uma sessão extremamente limitada em conta real, com dinheiro real, sob supervisão total, sem escala, sem dispatch automático e com autorização explícita.

Este gate **NÃO** libera conta real.  
Este gate **NÃO** libera produção real.  
Este gate **NÃO** libera dispatch automático.  
Este gate **NÃO** libera operação comercial ampla.  
Este gate **NÃO** libera múltiplos clientes.  
Este gate apenas documenta requisitos para uma possível avaliação futura.

---

## 1. Contexto

Histórico aprovado:

- Produção simulada aprovada.
- Beta demo aprovado.
- Demo com `DebugMode=false` aprovada.
- Nenhuma conta real usada até agora.
- Nenhuma ordem real enviada até agora.

O próximo risco operacional seria dinheiro real. Por isso, qualquer avaliação futura exige gate próprio, aceite formal, limites explícitos, supervisão em tempo real e decisão manual documentada.

---

## 2. Diferença entre conta demo e conta real

### Conta demo

- Sem dinheiro real.
- Risco operacional técnico.
- Pode validar fluxo de ordem no MT5.

### Conta real

- Envolve dinheiro real.
- Envolve risco financeiro real.
- Exige aceite formal.
- Exige limite de capital.
- Exige autorização explícita.
- Exige rollback imediato.
- Exige monitoramento em tempo real.
- Exige decisão manual documentada.

---

## 3. Escopo potencial, ainda não autorizado

Se um dia aprovado, o escopo máximo inicial seria:

- 1 participante.
- 1 conta real.
- 1 ativo.
- 1 perfil conservador.
- 1 sinal.
- 1 lote mínimo ou quantidade mínima homologada.
- Dispatch manual pelo admin.
- Sem retry.
- Sem dispatch automático.
- Sem escala.
- Sem múltiplos clientes.
- Monitoramento em tempo real.

Este escopo é apenas uma referência de limite máximo para discussão futura. Ele não autoriza operação real.

---

## 4. Fora de escopo

Fica explicitamente proibido neste gate:

- produção real ampla;
- múltiplos clientes;
- múltiplos ativos;
- perfil agressivo;
- dispatch automático;
- operação sem supervisão;
- promessa de rentabilidade;
- aumento de lote sem nova aprovação;
- cliente alterar parâmetros;
- uso comercial público;
- assinatura automática com real;
- copy trade público.

---

## 5. Pré-requisitos obrigatórios antes de qualquer real

- [ ] Relatório demo `DebugMode=false` aprovado.
- [ ] Conta real identificada.
- [ ] Corretora/servidor identificados.
- [ ] Tipo de conta confirmado.
- [ ] Cliente/operador identificado.
- [ ] Termo de aceite assinado.
- [ ] Risco financeiro entendido.
- [ ] Limite de capital definido.
- [ ] Limite de perda definido.
- [ ] Limite de quantidade definido.
- [ ] Ativo definido.
- [ ] Horário definido.
- [ ] Responsável acompanhando ao vivo.
- [ ] Rollback testado.
- [ ] EA testado em demo.
- [ ] WebRequest validado.
- [ ] Logs visíveis.
- [ ] Painel admin acessível.
- [ ] Tracking funcionando.
- [ ] Nenhuma ordem/posição prévia sem controle.
- [ ] Plano de encerramento definido.

---

## 6. Requisitos de aceite formal

Antes de qualquer conta real, precisa existir um termo com, no mínimo:

- ciência de risco de mercado;
- ciência de risco tecnológico;
- ausência de promessa de lucro;
- autorização para operação limitada;
- autorização para pausar/encerrar;
- autorização para monitoramento;
- ciência de estratégia caixa preta;
- limite máximo de exposição;
- limite máximo de perda;
- responsabilidades do participante;
- proibição de alterar configurações sem autorização.

---

## 7. Limites mínimos sugeridos para futura discussão

Valores definitivos não estão aprovados neste gate. Campos a definir em revisão futura:

```text
capital máximo autorizado:
lote/contrato máximo:
perda máxima diária:
número máximo de sinais:
horário permitido:
ativo permitido:
perfil permitido:
responsável:
critério de encerramento:
critério de rollback:
```

---

## 8. Critérios de reprovação imediata

Reprovar se:

- cliente não aceitar riscos;
- conta real não estiver claramente identificada;
- houver divergência de ativo;
- houver divergência de perfil;
- houver ordem pendente desconhecida;
- houver posição aberta desconhecida;
- dispatch automático estiver ativo;
- tracking estiver inconsistente;
- secret exposto;
- EA sem logs;
- rollback não testado;
- ausência de responsável acompanhando;
- tentativa de operar mais de 1 sinal;
- tentativa de operar múltiplos clientes.

---

## 9. Rollback para conta real

Plano mínimo de rollback:

- remover EA do gráfico;
- desativar AutoTrading;
- cancelar ordens pendentes;
- zerar posição, se aplicável e autorizado;
- pausar dispatch admin;
- revogar device/token/licença;
- rotacionar secret, se necessário;
- registrar incidente;
- bloquear novas sessões;
- preservar histórico.

---

## 10. Evidências necessárias para uma futura sessão real

```text
Data/hora:
Responsável:
Participante:
Conta:
Corretora/servidor:
Tipo de conta:
Ativo:
Perfil:
Limite aprovado:
MasterSignalId:
InstructionId:
Ticket:
Resultado:
PnL:
Rollback:
Incidentes:
Status final:
```

---

## 11. Status do gate

**Status inicial:** `PLANNED`

Status possíveis:

- `PLANNED`
- `PENDING_REVIEW`
- `APPROVED_FOR_SINGLE_REAL_ACCOUNT_TEST`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

Mesmo `APPROVED_FOR_SINGLE_REAL_ACCOUNT_TEST` só autorizaria uma sessão única, manual, com limite definido. Não autoriza produção real ampla.

---

## 12. Próxima ação

Próxima ação recomendada:

Revisar juridicamente/operacionalmente o gate, definir limites formais e preparar termo de aceite antes de qualquer sessão real.

---

*Mercado da Riqueza AutoTrade — Gate de Conta Real Ultra-Controlada. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
