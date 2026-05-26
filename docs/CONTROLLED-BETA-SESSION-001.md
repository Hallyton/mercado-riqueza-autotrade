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

```text
Data/hora:
Responsável:
MasterSignalId:
InstructionId:
Resultado intake:
Resultado preview:
Resultado dispatch:
Resultado EA cliente:
Resultado tracking:
DebugMode:
Ordem real enviada:
Incidentes:
Rollback usado:
Status final:
Observações:
```

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

Status inicial: `PENDING_EXECUTION`

Opções futuras:

- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`
- `PAUSED`

---

## 9. Próxima ação

Executar a sessão real no staging/demo/`DebugMode=true` e preencher as evidências.

---

*Mercado da Riqueza AutoTrade — sessão beta demo controlada nº 1. Produção real, ordem real e dispatch automático permanecem bloqueados.*
