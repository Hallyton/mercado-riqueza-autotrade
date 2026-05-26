# Participante Beta Demo nº 1 — Mercado da Riqueza AutoTrade

Registro operacional do primeiro participante autorizado para beta controlado em conta demo, com regras, limites, ambiente, monitoramento e critérios de saída.

Este registro **não** libera produção real, **não** libera ordem real, **não** libera conta real e **não** libera dispatch automático. O escopo é somente beta controlado em DEMO ou `DebugMode`, conforme definido.

---

## 1. Identificação do participante

| Campo | Valor |
|-------|-------|
| Participante | Cliente Staging |
| E-mail | `cliente.staging@mercadodariqueza.com.br` |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta MT5 | `52609973` |
| Servidor | `XPMT5-DEMO` |
| Tipo de conta | DEMO |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Status | `APPROVED_FOR_DEMO_BETA_SESSION` |

---

## 2. Escopo autorizado

### Autorizado

- Operar apenas em ambiente staging.
- Operar apenas em conta demo.
- Usar perfil `conservador`.
- Usar `WDOM26`.
- Receber instructions `MASTER_SIGNAL`.
- Usar dispatch manual pelo admin.
- Manter monitoramento diário.
- Registrar evidências.

### Não autorizado

- Conta real.
- Ordem real.
- Dispatch automático.
- Perfil agressivo.
- Múltiplos ativos.
- Múltiplas contas.
- Alteração de parâmetros pelo cliente.
- Acesso à lógica interna.
- Uso comercial público.
- Promessa de rentabilidade.

---

## 3. Modo operacional inicial

| Item | Valor |
|------|-------|
| Modo inicial recomendado | `DebugMode=true` |
| Alternativa futura | Demo com `DebugMode=false` somente após aprovação operacional específica e novo registro |

Mesmo em conta demo, o primeiro ciclo beta deve começar com `DebugMode=true` para confirmar estabilidade.

---

## 4. Requisitos técnicos

- [ ] EA cliente instalado.
- [ ] EA cliente apontando para staging.
- [ ] WebRequest liberado.
- [ ] Heartbeat `ONLINE`.
- [ ] Device ativo.
- [ ] Licença `ACTIVE`.
- [ ] Assinatura `ACTIVE`.
- [ ] `allow_demo` habilitado.
- [ ] Plano/perfil correto.
- [ ] Logs em nível operacional.
- [ ] Painel admin acessível.
- [ ] Tracking funcionando.

---

## 5. Regras operacionais

- Admin revisa todo `MasterSignal` antes do dispatch.
- Dispatch manual obrigatório.
- Nenhum dispatch automático.
- Monitoramento durante o período do teste.
- Qualquer inconsistência pausa o beta.
- Cliente não altera configuração sem autorização.
- Nenhum secret em print, log ou documento.
- Evidências registradas por ciclo.

---

## 6. Limites iniciais

Como esta etapa ainda é demo/`DebugMode`, os limites iniciais são conceituais:

- 1 participante.
- 1 conta MT5 demo.
- 1 ativo: `WDOM26`.
- 1 perfil: `conservador`.
- 1 instruction por sinal.
- Horários definidos manualmente.
- Sem escala.
- Sem capital real.
- Sem promessa de resultado.

---

## 7. Critérios de entrada no beta demo

O participante só pode iniciar beta demo se:

- Gate de Beta Controlado estiver documentado.
- Dados do participante estiverem preenchidos.
- Conta demo validada.
- EA cliente online.
- `DebugMode` confirmado.
- Admin responsável definido.
- Rollback conhecido.
- Produção real bloqueada.
- Ordem real bloqueada.

---

## 8. Critérios de pausa imediata

Pausar se:

- EA ficar offline sem explicação.
- Tracking inconsistente.
- Instruction duplicada indevida.
- Ordem real enviada.
- `DebugMode=false` sem aprovação.
- Secret exposto.
- Profile divergente.
- Licença/device divergente.
- Cliente alterar configuração.
- Falha de rollback.

---

## 9. Evidências mínimas por sessão beta

```text
Data:
Responsável:
MasterSignalId:
InstructionId:
Status intake:
Status dispatch:
Status EA:
Status tracking:
DebugMode:
Ordem real enviada:
Incidentes:
Decisão da sessão:
```

---

## 10. Status final possível do participante

- `CANDIDATO_BETA_DEMO`
- `APPROVED_FOR_DEMO_BETA_SESSION`
- `PAUSED`
- `REJECTED`
- `COMPLETED`

Status atual: `APPROVED_FOR_DEMO_BETA_SESSION`.

---

## 11. Sessões registradas

| Sessão | MasterSignalId | Status | Observação |
|--------|----------------|--------|------------|
| Beta Demo Controlada nº 1 | `beta-demo-001-buy-002` | `APPROVED` | Sessão aprovada com `DebugMode=true`, sem ordem real e com tracking `EXECUTED` |

---

## 12. Próxima ação recomendada

Definir a próxima etapa operacional: plano de sessões beta demo recorrentes ou gate para demo sem `DebugMode`, ainda sem conta real.

---

*Mercado da Riqueza AutoTrade — participante beta demo nº 1. Produção real, ordem real e dispatch automático permanecem bloqueados.*
