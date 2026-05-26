# Real Trading Guard — Kill Switch de Conta Real

Documento da **Fase 6.1** para registrar a trava técnica global de conta real no backend do Mercado da Riqueza AutoTrade.

Esta trava **NÃO** libera conta real, **NÃO** libera produção real, **NÃO** libera dinheiro real e **NÃO** ativa dispatch automático.

---

## 1. Objetivo da trava

O Real Trading Guard é uma defesa server-side para impedir que o backend entregue `Instruction` a uma licença/EA cujo último heartbeat indique `tradeMode=REAL`, enquanto não existir liberação técnica futura, explícita e controlada.

A regra principal é:

- se o último heartbeat da licença estiver em `REAL`, bloquear;
- se não houver liberação global futura, bloquear;
- se não houver allowlist explícita por `licenseId`, bloquear;
- nunca depender do EA cliente para decidir se conta real pode receber instruction.

---

## 2. Regra default deny

O comportamento padrão é **bloqueado**.

Se `ENABLE_REAL_TRADING` estiver ausente, vazio ou diferente de valor explicitamente aceito, o backend considera conta real bloqueada.

Valores aceitos pela implementação:

- `true`
- `1`

Mesmo com `ENABLE_REAL_TRADING=true`, a licença ainda precisa estar em `REAL_TRADING_ALLOWED_LICENSE_IDS`.

---

## 3. tradeMode=REAL bloqueado

Quando o último heartbeat de uma licença indicar `tradeMode=REAL`, o guard retorna:

- code: `REAL_TRADING_DISABLED`
- reason: `Conta em modo REAL bloqueada pelo Real Trading Guard.`

No dispatch de MasterSignal:

- a licença é considerada inelegível;
- nenhuma `Instruction` é criada para ela;
- o dispatch por licença é auditável como `SKIPPED`, quando aplicável;
- o motivo aparece no tracking/admin de forma legível.

No pull do EA:

- o endpoint responde HTTP 200;
- `instructions` retorna `[]`;
- `subscription_active` preserva a regra atual;
- o payload pode incluir `real_trading_blocked: true` e `block_reason: "REAL_TRADING_DISABLED"`.

---

## 4. DEMO permitido conforme regras atuais

Licenças com último heartbeat `tradeMode=DEMO` continuam seguindo as regras já existentes:

- assinatura;
- licença;
- vínculo MT5;
- perfil de exposição;
- plano permite demo;
- halts operacionais;
- políticas de instruction;
- idempotência;
- expiração.

O guard não amplia permissões de demo. Ele apenas bloqueia conta real por padrão.

---

## 5. Feature flags futuras

As variáveis futuras lidas pelo código são:

- `ENABLE_REAL_TRADING`
- `REAL_TRADING_ALLOWED_LICENSE_IDS`

Nesta fase, nenhum env real foi configurado.

A liberação técnica futura exigiria simultaneamente:

- `ENABLE_REAL_TRADING=true` ou `ENABLE_REAL_TRADING=1`;
- `licenseId` presente em `REAL_TRADING_ALLOWED_LICENSE_IDS`;
- revisão jurídica/operacional/técnica;
- aprovação específica documentada.

Sem allowlist por licença, a conta real permanece bloqueada mesmo que a flag global esteja ligada.

---

## 6. Pontos de integração

Integrações implementadas:

- `lib/risk/real-trading-guard.ts` — módulo central do guard;
- `lib/master-signals/eligibility.ts` — bloqueio na elegibilidade do dispatch de MasterSignal;
- `lib/ea/instructions.ts` — bloqueio no pull e na contagem/auditoria de instructions entregáveis;
- `app/api/v1/ea/instructions/route.ts` — resposta HTTP 200 com `instructions: []` quando bloqueado;
- `lib/master-signals/admin-tracking.ts` — texto legível para `REAL_TRADING_DISABLED`;
- `lib/master-signals/admin.ts` — tracking/admin usa motivo legível.

---

## 7. Testes

Coberturas adicionadas/ajustadas:

- dispatch bloqueia licença em `REAL` com `ENABLE_REAL_TRADING` ausente;
- dispatch permite `DEMO` conforme fluxo existente;
- pull do EA bloqueia entrega em `REAL`;
- endpoint `/api/v1/ea/instructions` retorna HTTP 200 com `instructions: []` quando bloqueado;
- pull/endpoint entregam normalmente em `DEMO`;
- feature flag futura não libera sem allowlist;
- feature flag futura com allowlist permitiria tecnicamente a avaliação unitária do guard;
- admin exibe motivo legível para `REAL_TRADING_DISABLED`.

---

## 8. Status

**Status:** implementado localmente.

**Decisão atual:** `REAL_ACCOUNT_NOT_APPROVED`

---

## 9. Homologação staging — Fase 6.2

**Data:** 2026-05-26  
**Status:** `APPROVED_WITH_RESTRICTIONS`

Esta homologação registrou o deploy e verificações seguras de staging, mas não forçou testes que exigiriam secret operacional, sessão admin ou mutação de heartbeat sem autorização explícita.

### 9.1 Deploy realizado

| Item | Resultado |
|------|-----------|
| Comando | `vercel --prod --force` |
| Deploy ID | `dpl_2gW6HCZ2MN5YTH2iZ3SwN64jvTiw` |
| Ready state | `READY` |
| Alias oficial | `https://autotrade-staging.mercadodariqueza.com.br` |
| Home staging | HTTP 200 |
| `/api/v1/ea/instructions` sem token | HTTP 401 `MISSING_TOKEN` |
| `/api/master/signals` sem auth | HTTP 401 `MASTER_AUTH_REQUIRED` |

O endpoint de MasterSignal respondeu `MASTER_AUTH_REQUIRED`, confirmando que a rota está ativa e protegida por auth própria. O secret existe no ambiente Vercel como variável criptografada, mas seu valor não foi exposto.

### 9.2 Smoke test DEMO

| Campo | Resultado |
|-------|-----------|
| MasterSignalId planejado | `real-guard-demo-smoke-001` |
| Símbolo | `WDOM26` |
| Side | `BUY` |
| OrderType | `MARKET` |
| Purpose | `ENTRY` |
| Profile | `conservador` |
| Resultado | `PENDING_SECURITY_REVIEW` |

O smoke test DEMO completo não foi executado nesta etapa porque o ambiente local não possui `MASTER_EA_API_SECRET` disponível e não havia sessão admin autenticada para realizar o dispatch manual pelo painel.

O Vercel CLI permitiu confirmar a existência da variável por nome, mas retornou valores criptografados/redigidos. O valor não foi impresso, copiado para documentação ou exposto no terminal.

Decisão conservadora: não contornar auth, não colar secret no chat, não recuperar secret em claro e não forçar dispatch fora do fluxo autorizado.

### 9.3 Teste controlado do bloqueio REAL

| Campo | Resultado |
|-------|-----------|
| Conta real usada | NÃO |
| Produção real liberada | NÃO |
| Dispatch automático ativado | NÃO |
| Simulação REAL executada | NÃO |
| Motivo | Ausência de fixture isolada confirmada e ausência de autorização para mutar heartbeat da licença operacional principal |

Não foi executada simulação `tradeMode=REAL` em staging nesta etapa. A alternativa de alterar o heartbeat da licença operacional principal exigiria confirmação explícita e rollback imediato. Como essa autorização não foi dada, o teste foi registrado como pendente.

Critérios que continuam pendentes para uma próxima rodada segura:

- fixture temporária isolada em staging; ou
- script operacional aprovado com rollback; ou
- autorização explícita para mutar e restaurar heartbeat de uma licença definida; ou
- sessão controlada com operador acompanhando painel/admin/EA.

### 9.4 Verificação de envs

Verificação feita apenas por nomes, sem imprimir valores.

| Variável | Resultado |
|----------|-----------|
| `ENABLE_REAL_TRADING` | Não listada em `vercel env ls production` |
| `REAL_TRADING_ALLOWED_LICENSE_IDS` | Não listada em `vercel env ls production` |
| `MASTER_EA_API_SECRET` | Listada como `Encrypted`; valor não exposto |
| `DATABASE_URL` | Listada como `Encrypted`; valor não exposto |

Conclusão: nenhuma env futura de liberação de real trading foi configurada em staging durante esta fase.

### 9.5 Restrições mantidas

- Conta real não foi usada.
- Conta real continua não liberada.
- Produção real continua não liberada.
- Dinheiro real continua não liberado.
- Dispatch automático continua desativado.
- Nenhum env de real trading foi configurado.
- Nenhum schema/migration foi criado.
- Nenhum EA cliente ou EA Mãe foi alterado.

---

## 10. Fase 6.3 — Harness Seguro de Diagnóstico

**Status:** implementado localmente.

A Fase 6.3 adiciona um harness local para diagnosticar a lógica do Real Trading Guard sem depender de staging, sem `MASTER_EA_API_SECRET`, sem sessão admin, sem banco e sem mutação de dados.

Comando:

```bash
npm run risk:diagnose-real-guard
```

O diagnóstico:

- roda localmente;
- importa `lib/risk/real-trading-guard.ts`;
- usa envs injetados em memória por cenário;
- não lê valores reais de Vercel;
- não imprime secrets;
- não usa conta real;
- não muta banco;
- não altera envs;
- não cria `Instruction`;
- não dispara MasterSignal;
- não ativa dispatch automático;
- não libera conta real.

### 10.1 Cenários cobertos

| Cenário | Resultado esperado |
|---------|--------------------|
| DEMO sem env | `allowed=true` |
| REAL sem env | `allowed=false`, `REAL_TRADING_DISABLED` |
| REAL com `ENABLE_REAL_TRADING=false` | bloqueado |
| REAL com `ENABLE_REAL_TRADING=true` sem allowlist | bloqueado |
| REAL com allowlist sem a licença | bloqueado |
| REAL com allowlist contendo a licença | `allowed=true` apenas como diagnóstico unitário |
| `tradeMode` ausente | comportamento atual documentado |
| `tradeMode` desconhecido | comportamento atual documentado |

### 10.2 Observação de segurança

O cenário com `ENABLE_REAL_TRADING=true` e licença em allowlist demonstra apenas que a função do guard consegue retornar `allowed=true` quando as duas condições técnicas futuras são satisfeitas.

Isso **não** representa liberação operacional, não configura env real, não autoriza conta real, não autoriza produção real e não substitui revisão jurídica, operacional e técnica.

---

## 11. Fase 6.4 — Painel Admin Read-Only

**Status:** implementado localmente.

A Fase 6.4 adiciona uma visualização administrativa somente leitura para o Real Trading Guard:

- rota: `/admin/risk/real-trading-guard`;
- helper: `lib/risk/real-trading-guard-status.ts`;
- navegação admin: `Risco / Real Guard`.

O painel serve para auditoria operacional e visibilidade do estado seguro do guard.

### 11.1 O que a tela mostra

- status operacional do guard;
- política padrão `BLOCK_REAL_BY_DEFAULT`;
- se `ENABLE_REAL_TRADING` está configurado, sem mostrar valor bruto;
- se existe allowlist configurada, sem mostrar IDs completos;
- quantidade de IDs em allowlist;
- IDs parcialmente mascarados, quando existirem;
- matriz conceitual DEMO/REAL;
- avisos de segurança.

### 11.2 O que a tela não faz

- não altera envs;
- não cria botão de ativar real;
- não cria toggle;
- não grava banco;
- não cria `Instruction`;
- não faz dispatch;
- não usa conta real;
- não libera produção real;
- não substitui gate jurídico, operacional e técnico.

### 11.3 Redação de envs e allowlist

Valores brutos de env não são retornados pelo helper de status.

Quando `REAL_TRADING_ALLOWED_LICENSE_IDS` existir, a tela mostra apenas:

- contagem de IDs;
- IDs mascarados no formato aproximado `cmpj3w...939p`.

---

## 12. Homologação staging — Fase 6.5

**Data:** 2026-05-26  
**Status:** `APPROVED_WITH_RESTRICTIONS`

Esta homologação registrou o deploy e a proteção da rota admin do painel read-only do Real Trading Guard.

### 12.1 Deploy realizado

| Item | Resultado |
|------|-----------|
| Comando | `vercel --prod --force` |
| Deploy ID | `dpl_EhrsMyozCUnb7qfr2BQMoqgXLxWa` |
| Ready state | `READY` |
| Alias oficial | `https://autotrade-staging.mercadodariqueza.com.br` |
| Rota no build | `/admin/risk/real-trading-guard` gerada com sucesso |

### 12.2 Rota protegida

| Verificação | Resultado |
|-------------|-----------|
| URL | `https://autotrade-staging.mercadodariqueza.com.br/admin/risk/real-trading-guard` |
| Sem sessão | HTTP 307 para `/login?callbackUrl=%2Fadmin%2Frisk%2Freal-trading-guard` |
| Após redirect | HTTP 200 na tela de login |
| Navegador | Tela de login exibida |

A rota está protegida por autenticação admin. Sem sessão autenticada, o painel não é exibido.

### 12.3 Validação visual

| Item | Resultado |
|------|-----------|
| Validação sem login | Aprovada — redirect para login |
| Validação autenticada admin | Pendente por ausência de sessão admin segura nesta execução |
| Status final | `APPROVED_WITH_RESTRICTIONS` |

Não foram usadas credenciais, secrets ou sessão admin forçada. A validação visual do conteúdo autenticado ficou restrita ao build local/staging e à revisão do código implementado na Fase 6.4.

Conteúdos esperados pelo painel:

- conta real bloqueada por padrão;
- produção real não liberada;
- dispatch automático desativado;
- política padrão: bloquear `REAL`;
- `DEMO` permitido conforme regras existentes;
- `REAL` sem flag bloqueado;
- `REAL` com flag sem allowlist bloqueado;
- `REAL` com flag e allowlist descrito como tecnicamente possível, mas sem liberação operacional;
- allowlist exibida apenas como contagem e IDs mascarados;
- nenhum valor bruto de env;
- nenhum secret;
- nenhum botão ou toggle de ativação.

### 12.4 Restrições mantidas

- Conta real não foi usada.
- Conta real continua não liberada.
- Produção real continua não liberada.
- Dinheiro real continua não liberado.
- Dispatch automático continua desativado.
- Nenhum env foi alterado.
- Nenhum schema/migration foi criado.
- Nenhum EA cliente ou EA Mãe foi alterado.
- Nenhum toggle ou botão de liberação foi criado.

---

## 13. Homologação staging — Fase 6.6 — Validação visual autenticada

**Data:** 2026-05-26  
**Status:** `APPROVED`

A validação visual autenticada do painel Real Trading Guard foi realizada manualmente em staging com usuário admin logado.

### 13.1 URL validada

`https://autotrade-staging.mercadodariqueza.com.br/admin/risk/real-trading-guard`

### 13.2 Evidências visuais confirmadas

- Painel Real Trading Guard abriu autenticado.
- Menu admin exibe `Risco / Real Guard`.
- Status principal mostra `REAL_TRADING_BLOCKED`.
- Badge/política mostra `BLOCK_REAL_BY_DEFAULT`.
- `ENABLE_REAL_TRADING` configurado: Não.
- Allowlist configurada: Não.
- Licenças permitidas: 0.
- Política padrão: Bloquear `REAL`.

Status principal informa:

- Conta real bloqueada por padrão.
- Produção real não liberada.
- Dispatch automático desativado.
- `DEMO` permitido conforme regras operacionais existentes.
- `REAL` exige flag futura e allowlist por licença.

Diagnóstico conceitual mostra:

- `DEMO`: Permitido.
- `REAL` sem flag: Bloqueado.
- `REAL` com flag sem allowlist: Bloqueado.
- `REAL` com flag + allowlist: Tecnicamente permitido, mas não é liberação operacional.

### 13.3 Segurança visual confirmada

- Allowlist mascarada não expõe IDs completos.
- Nenhum valor bruto de env foi exibido.
- Nenhum secret foi exibido.
- Nenhum botão de ativação foi exibido.
- Nenhum toggle foi exibido.
- Tela é somente leitura.

Avisos exibidos:

- Esta tela é somente leitura.
- Conta real não está liberada por esta tela.
- Produção real continua bloqueada.
- Dispatch automático continua desativado.
- Qualquer avanço exige gate jurídico, operacional e técnico específico.

### 13.4 Restrições mantidas

- Conta real continua não liberada.
- Produção real continua não liberada.
- Dinheiro real continua não liberado.
- Dispatch automático continua desativado.
- Nenhum env foi alterado.
- Nenhum schema/migration foi criado.
- Nenhum EA cliente ou EA Mãe foi alterado.
- Nenhum toggle ou botão de liberação foi criado.

---

## 14. Fase 6.7 — Smoke Test DEMO pós Real Trading Guard

**Data:** 2026-05-26  
**Status:** `APPROVED`

O smoke test DEMO pós Real Trading Guard foi executado em staging para confirmar que a trava global bloqueia `REAL` por padrão sem quebrar o fluxo operacional `DEMO`.

### 14.1 Ambiente e sinal validado

| Item | Resultado |
|------|-----------|
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `real-guard-demo-smoke-002` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Tipo | `DEMO` |
| `tradeMode` | `DEMO` |
| Ativo | `WDOM26` |
| Side | `BUY` |
| OrderType | `MARKET` |
| Purpose | `ENTRY` |
| Profile | `conservador` |
| DebugMode EA cliente | `true` |

### 14.2 Resultado operacional

| Item | Resultado |
|------|-----------|
| Status DB | `DISPATCHED` |
| Status consolidado | `EXECUTED` |
| Dispatches / instruções / executadas | `1 / 1 / 1` |
| Instruction `MASTER_SIGNAL` | Criada |
| Tracking final | `EXECUTED` |
| Real Trading Guard bloqueou DEMO | NÃO |
| Ordem real enviada | NÃO |
| Conta real usada | NÃO |
| Produção real liberada | NÃO |
| Dispatch automático | Desativado |

### 14.3 Confirmações de segurança

- O fluxo `DEMO` permaneceu elegível após a implementação do Real Trading Guard.
- O MasterSignal `real-guard-demo-smoke-002` foi despachado manualmente e chegou a tracking final `EXECUTED`.
- O Real Trading Guard não bloqueou `DEMO`.
- `ENABLE_REAL_TRADING` permanece não configurado.
- Allowlist permanece não configurada.
- A política padrão continua bloquear `REAL`.
- Conta real continua não liberada.
- Produção real continua não liberada.
- Dinheiro real continua não liberado.
- Dispatch automático continua desativado.

---

*Mercado da Riqueza AutoTrade — Real Trading Guard. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
