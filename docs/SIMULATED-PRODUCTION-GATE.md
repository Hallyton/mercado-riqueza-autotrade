# Gate de Produção Simulada — Mercado da Riqueza AutoTrade

Documento operacional da **Fase 2.11**: critérios, checklist, roteiro de teste, reprovação, rollback e registro de evidências para operar o fluxo completo **Master Signal → dispatch admin → EA cliente** em **staging**, com comportamento próximo de produção, **sem ordem real** e **sem liberar produção real**.

**Branch de referência:** `staging-vps-homologacao`  
**URL staging:** [https://autotrade-staging.mercadodariqueza.com.br](https://autotrade-staging.mercadodariqueza.com.br)

**Documentos relacionados:**

| Documento | Uso |
|-----------|-----|
| [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) | Fases 2.5–2.10 homologadas |
| [`MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md) | Arquitetura caixa preta |
| [`MASTER-EA-SIGNAL-SIMULATOR.md`](MASTER-EA-SIGNAL-SIMULATOR.md) | Simulador HTTP/CLI |
| [`MASTER-EA-MQL5-V1.md`](MASTER-EA-MQL5-V1.md) | EA Mãe emissor manual |
| [`STAGING-VPS-HOMOLOGATION.md`](STAGING-VPS-HOMOLOGATION.md) | Procedimento staging/VPS |
| [`STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md) | Baseline EA cliente homologado |
| [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md) | Resultado oficial da execução do gate (Fase 2.12) |

---

## Status da execução

**Gate executado e aprovado em staging:** `APPROVED_FOR_SIMULATED_PRODUCTION`.

Resultado oficial em [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md).

A aprovação confirma o fluxo simulado EA Mãe → intake → dispatch admin manual → `Instruction` `MASTER_SIGNAL` → EA cliente em `DebugMode=true` → execution report → tracking `EXECUTED`. Ela **não** libera produção real, **não** autoriza ordem real e **não** altera a regra de segurança: `POST /api/master/signals` continua sem dispatch automático.

---

## Objetivo

Definir os **critérios mínimos** para declarar o ambiente de staging apto a um **ciclo operacional simulado de ponta a ponta**:

- EA Mãe (MQL5) ou simulador HTTP envia `MasterSignal` (intake apenas).
- Painel admin exibe **VALIDATED** / **Não disparado**.
- Admin **OPS/SUPERADMIN** revisa, confere elegibilidade e **dispara manualmente**.
- `Instruction` com `source: MASTER_SIGNAL` chega ao EA cliente.
- EA cliente em **`InpDebugMode=true`** — **nenhuma ordem real** no broker.
- EA reporta execução; painel e tracking consolidado refletem **EXECUTED**.

Este gate **não** autoriza:

- produção real (`autotrade.mercadodariqueza.com.br` ou equivalente);
- dinheiro real ou conta real de cliente;
- `InpDebugMode=false` em homologação sem gate explícito posterior;
- dispatch automático em `POST /api/master/signals`;
- estratégia operacional no EA Mãe.

---

## Escopo

### Dentro do escopo

| Área | Detalhe |
|------|---------|
| Domínio | `autotrade-staging.mercadodariqueza.com.br` |
| Deploy | Vercel projeto `mercado-riqueza-autotrade-staging` |
| Banco | Neon PostgreSQL staging (migrations aplicadas) |
| Secrets | `MASTER_EA_API_SECRET`, `AUTH_SECRET`, `ADMIN_PASSWORD` (presença — **nunca** registrar valores) |
| Admin | Roles OPS / SUPERADMIN — login e disparo manual |
| EA Mãe | `MR_AutoTrade_Master_Signal` — intake HTTP |
| Simulador | `npm run master:signal` — intake HTTP (alternativa ao MQL5) |
| Painel | `/admin/master-signals` — lista, detalhe, preview, disparo, tracking |
| EA cliente | `MR_AutoTrade_Executor` — pull instructions, DebugMode, executions |
| Tracking | MasterSignal → Dispatch → Instruction → Execution |
| Auditoria | Logs de ordem, `admin_actions`, sem vazamento de secret |
| Rollback | Procedimento operacional documentado abaixo |

### Fora de escopo

- Produção real e domínio de produção.
- Ordens reais no broker (conta real ou demo sem DebugMode).
- Dispatch automático no POST `/api/master/signals`.
- Estratégia real, indicadores ou parâmetros táticos no EA Mãe.
- Alterações em DARF, billing, dashboard cliente ou onboarding público.
- Múltiplos clientes reais ou carga de produção.
- Alteração de código, schema, migrations, envs ou deploy como parte **deste** gate (apenas verificação e evidência).

---

## Critérios obrigatórios do gate

Marcar cada item **OK** / **FALHA** / **N/A** na execução do gate. **Todos** os itens aplicáveis devem estar **OK** para aprovação sem restrições.

| # | Critério | Status esperado |
|---|----------|-----------------|
| 1 | Git limpo e branch correta | `staging-vps-homologacao`; working tree limpa antes do teste |
| 2 | Última versão deployada no staging | Vercel Production Ready no projeto staging; alias ativo |
| 3 | Domínio staging acessível | `https://autotrade-staging.mercadodariqueza.com.br` — HTTP 200 em rotas públicas/login |
| 4 | Neon staging com migrations aplicadas | `prisma migrate deploy` sem pendências (histórico conhecido) |
| 5 | `MASTER_EA_API_SECRET` configurado | Presente na Vercel staging; POST mestre não retorna 503 |
| 6 | `AUTH_SECRET` configurado | Sessão NextAuth funcional |
| 7 | `ADMIN_PASSWORD` configurado | Login admin possível |
| 8 | Admin OPS/SUPERADMIN consegue logar | `/admin` acessível após credenciais |
| 9 | Cliente staging ativo | Ex.: `cliente.staging@mercadodariqueza.com.br` |
| 10 | Licença staging `ACTIVE` | Não revogada / não expirada |
| 11 | Assinatura `ACTIVE` | Billing compatível com homologação |
| 12 | MT5 vinculado | Login **52609973** @ **XPMT5-DEMO** (referência homologação) |
| 13 | `allow_demo` habilitado | Plano staging permite conta demo |
| 14 | EA cliente heartbeat `ONLINE` | Painel admin/cliente reflete EA online |
| 15 | EA cliente `InpDebugMode=true` | Obrigatório — sem ordem real |
| 16 | EA cliente WebRequest liberado | URL staging na lista MT5 |
| 17 | EA Mãe WebRequest liberado | URL staging na lista MT5 |
| 18 | EA Mãe envia `MasterSignal` | POST `/api/master/signals` → HTTP 201 ou 200 idempotente |
| 19 | MasterSignal no painel `VALIDATED` | Lista `/admin/master-signals` |
| 20 | POST **não** dispara automaticamente | Após intake: Dispatches 0, Instructions 0 até disparo admin |
| 21 | Preview de elegibilidade correto | Licença staging elegível visível (ex. perfil `conservador`) |
| 22 | Admin dispara manualmente | Botão **Disparar para clientes** com confirmação |
| 23 | `Instruction` `MASTER_SIGNAL` criada | `source: MASTER_SIGNAL` em `/admin/instrucoes` |
| 24 | EA cliente recebe instruction | Log EA + GET instructions |
| 25 | EA cliente **não** envia ordem real | DebugMode — sem `OrderSend` real |
| 26 | EA cliente reporta execução | POST `/api/v1/ea/executions` OK |
| 27 | Painel instrução `EXECUTED` | `/admin/instrucoes` |
| 28 | Tracking consolidado `EXECUTED` | Detalhe master-signal — cards/tabela |
| 29 | Retry não duplica instruction | Re-disparo ou idempotência — contagem inalterada |
| 30 | Sinal expirado bloqueia dispatch | TTL esgotado → rejeição (`MASTER_SIGNAL_EXPIRED`) |
| 31 | Secrets não aparecem em logs | EA, Vercel, painel, prints — mascarar `***REDACTED***` |
| 32 | Plano de rollback conhecido | Equipe leu seção [Plano de rollback](#plano-de-rollback) |

---

## Roteiro de teste ponta a ponta

Executar na ordem. Registrar IDs e prints na [seção de evidências](#evidências-esperadas).

| Passo | Ação | Verificação |
|-------|------|-------------|
| 1 | Verificar Git | `git status` limpo; branch `staging-vps-homologacao`; anotar commit |
| 2 | Verificar deploy Vercel | Dashboard staging — último deploy sucesso; anotar deployment ID (sem secrets) |
| 3 | Verificar envs | Vercel → Settings → Environment Variables: `MASTER_EA_API_SECRET`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL` **presentes** — **não** copiar valores para evidência |
| 4 | Login admin | `/admin` — OPS ou SUPERADMIN |
| 5 | Verificar EA cliente | Gráfico com `MR_AutoTrade_Executor`; heartbeat ONLINE; `InpDebugMode=true` |
| 6 | Verificar EA Mãe | `MR_AutoTrade_Master_Signal` anexado; `InpSendOnInit=false`; secret preenchido localmente |
| 7 | Enviar sinal (EA Mãe) | Botão **Enviar sinal mestre** — anotar `master_signal_id` |
| 8 | Conferir MasterSignal no painel | `/admin/master-signals` — linha nova |
| 9 | Conferir `NOT_DISPATCHED` | Consolidado **Não disparado**; Disp./Instr./Exec. = 0 |
| 10 | Abrir detalhe | Página `/admin/master-signals/[id]` |
| 11 | Conferir preview elegibilidade | Licença staging listada como elegível |
| 12 | Disparar manualmente | Checkbox + confirmação — dentro do TTL (`expires_in_seconds`) |
| 13 | Conferir Instruction | `/admin/instrucoes` — origem **MASTER_SIGNAL** |
| 14 | Conferir EA cliente | Log: instruction recebida; sem ordem real |
| 15 | Conferir EXECUTED | Painel instrução + execução reportada |
| 16 | Conferir tracking | Detalhe master-signal — status consolidado **EXECUTED** (ou parcial conforme caso) |
| 17 | Idempotência | Repetir disparo ou reenviar mesmo idempotency — **sem** nova instruction duplicada |
| 18 | Registrar resultado | Preencher template de evidências; decidir status do gate |

**Alternativa no passo 7:** simulador HTTP (`npm run master:signal`) com env local — mesmo fluxo admin a partir do passo 8.

**Teste auxiliar (item 30):** criar sinal com TTL curto, **não** disparar até expirar; confirmar que disparo admin é rejeitado.

---

## Critérios de reprovação

O gate é **REJECTED** se **qualquer** condição abaixo ocorrer:

| Condição | Motivo |
|----------|--------|
| EA cliente **sem** `InpDebugMode=true` | Risco de ordem real |
| Qualquer **ordem real** enviada ao broker | Violação de homologação |
| `POST /api/master/signals` cria `Instruction` automaticamente | Quebra do desenho seguro (dispatch só admin) |
| Dispatch ocorre **sem** confirmação admin | Automação não autorizada |
| `MASTER_EA_API_SECRET` aparece em log, print, chat ou commit | Vazamento de credencial |
| Painel **não** exibe tracking consolidado | Regressão Fase 2.8 |
| Instruction com `source` **null** no dispatch mestre | Regressão Fase 2.6 |
| Retry **duplica** instruction | Falha de idempotência |
| Sinal **expirado** ainda permite disparo | Falha de TTL |
| EA cliente **não** reporta execução após instruction | Quebra do ciclo |
| Usuário **sem** role OPS/SUPERADMIN consegue disparar | Falha de autorização |
| Banco **local** usado por engano | Dados inconsistentes |
| Domínio **errado** (prod, localhost, vercel genérico sem alias) | Ambiente incorreto |
| DARF ou billing **afetados** durante o teste | Fora de escopo / regressão |
| Produção real tratada como aprovada neste documento | Este gate é **somente** staging simulado |

---

## Plano de rollback

### Rollback operacional (imediato)

Executar na ordem de urgência, conforme incidente:

1. **Parar EA cliente** — remover do gráfico ou desligar Algo Trading.
2. **Remover EA Mãe** do gráfico.
3. **Desabilitar WebRequest** no MT5 (ou remover URLs staging) se suspeita de abuso.
4. **Revogar device/token** da licença staging no painel admin (se token comprometido).
5. **Rotacionar `MASTER_EA_API_SECRET`** na Vercel staging — gerar novo valor; atualizar EA Mãe/simulador localmente (**nunca** commitar).
6. **Remover permissão OPS temporária** se criada só para o gate.
7. **Pausar dispatch manual** — comunicar equipe para não disparar sinais de teste pendentes.
8. **Reverter deploy Vercel** para deployment anterior estável, se regressão de código (somente com aprovação ops — **não** é passo padrão desta fase documental).

### Rollback de banco

| Ação | Permitido | Proibido |
|------|-----------|----------|
| Auditoria | Manter `MasterSignal`, `Instruction`, logs | Apagar trilha de auditoria |
| Migrations | Manter aplicadas | Remover migrations já em Neon staging |
| Sinais de teste | Marcar/ignorar em relatório; prefixo `master-mt5-` / `sim-` | DELETE em massa sem procedimento |
| Correção | Backfill documentado se bug confirmado | Alterar schema sem gate 2.2+ |

---

## Evidências esperadas

Copiar o bloco abaixo por execução do gate (um arquivo interno ou ticket ops).

```text
Data:
Responsável:
Branch:
Commit:
Deploy (Vercel ID ou URL deployment):
URL staging: https://autotrade-staging.mercadodariqueza.com.br
MasterSignalId:
InstructionId:
LicenseId:
MT5: 52609973 @ XPMT5-DEMO
EA cliente DebugMode: true / false
Ferramenta intake: EA Mãe MQL5 / Simulador HTTP
Resultado EA Mãe: HTTP ___ ; VALIDATED / erro
Resultado painel (intake): NOT_DISPATCHED / N/A
Resultado dispatch: DISPATCHED / PARTIAL / rejeitado
Resultado EA cliente: instruction recebida / execução reportada
Resultado tracking: EXECUTED / PARTIALLY_EXECUTED / FAILED
Status final do gate: APPROVED_FOR_SIMULATED_PRODUCTION / APPROVED_WITH_RESTRICTIONS / REJECTED
Observações:
```

**Anexos recomendados (sem secrets):** print lista master-signals, print detalhe tracking, print instrução EXECUTED, trecho de log EA com DebugMode (mascarar tokens).

---

## Decisão do gate

| Status | Significado |
|--------|-------------|
| **APPROVED_FOR_SIMULATED_PRODUCTION** | Todos os critérios obrigatórios OK; nenhuma reprovação; evidências completas; staging apto a operação simulada repetível |
| **APPROVED_WITH_RESTRICTIONS** | Fluxo principal OK com desvio documentado (ex.: apenas simulador HTTP, EA Mãe pendente, item 30 não executado) — listar restrições em Observações |
| **REJECTED** | Qualquer critério de reprovação ou falha crítica no roteiro |

### Condições para aprovação plena

- Todos os [critérios obrigatórios](#critérios-obrigatórios-do-gate) aplicáveis em **OK**.
- Nenhum [critério de reprovação](#critérios-de-reprovação) acionado.
- [Evidências](#evidências-esperadas) preenchidas e arquivadas.
- **Ordem real não enviada** (DebugMode confirmado).
- **Dispatch automático no POST permanece desativado** (`dispatch: NOT_STARTED` após intake).

### O que esta aprovação **não** significa

- **Não** libera produção real.
- **Não** autoriza `InpDebugMode=false` em clientes reais.
- **Não** substitui gate futuro de produção (domínio, secrets, compliance, billing real).

---

## Histórico do documento

| Versão | Data | Notas |
|--------|------|-------|
| 1.0 | maio/2026 | Fase 2.11 — documentação inicial do gate; homologação operacional do gate **pendente** até execução formal e registro de evidências |
| 1.1 | maio/2026 | Fase 2.12 — gate executado e aprovado para produção simulada; resultado em [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md); produção real permanece não liberada |

---

*Mercado da Riqueza AutoTrade — gate de produção **simulada** em staging. Produção real permanece fora de escopo.*
