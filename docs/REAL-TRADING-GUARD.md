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

*Mercado da Riqueza AutoTrade — Real Trading Guard. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
