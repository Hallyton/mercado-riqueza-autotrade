# Checklist oficial de validação — MVP Mercado da Riqueza AutoTrade

**Versão do checklist:** 1.0  
**Data:** 20/05/2026  
**Escopo:** validação manual e técnica do MVP antes de homologação / go-live  
**Referências obrigatórias:**

| Documento / artefato | Caminho |
|---------------------|---------|
| Documento mestre | [`docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`](docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md) (v1.1) |
| Regras para agentes/dev | [`AGENTS.md`](AGENTS.md) |
| Schema Prisma | [`prisma/schema.prisma`](prisma/schema.prisma) |
| API EA | [`docs/EA-API.md`](docs/EA-API.md) |
| Assinatura e licença | [`docs/SUBSCRIPTION-LICENSING.md`](docs/SUBSCRIPTION-LICENSING.md) |
| EA MQL5 | [`ea/mql5/MR_AutoTrade_Executor.mq5`](ea/mql5/MR_AutoTrade_Executor.mq5) |

---

## Como usar este checklist

1. Preencha **Status** após cada teste: `Pendente` | `OK` | `Falha` | `N/A` (com justificativa em Observações).
2. Registre evidências (screenshot, `request_id`, ID de instrução/licença, trecho de log) em **Observações**.
3. Testes de EA exigem MT5 com WebRequest liberado, conta de homologação e ambiente de staging quando possível.
4. Não confundir validação de **estratégia** (vault, fora do MVP web) com validação de **executor + plataforma**.

**Legenda de ambiente sugerida:** `[LOCAL]` `[STAGING]` `[PROD]`

---

## 1. Validação da arquitetura

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 1 — Arquitetura caixa preta e separação de camadas | Modelo SaaS: estratégia no servidor (vault isolado); cliente só executor + dashboard de resultado; Next.js (web + API BFF) + PostgreSQL + EA REST | Revisar `AGENTS.md`, seções 3–4 do documento mestre e estrutura `app/`, `lib/`, `prisma/`, `ea/mql5/`; confirmar ausência de `strategy_configs` no schema público | Nenhum módulo de vault/estratégia exposto em API pública, dashboard cliente ou inputs do EA; comunicação EA apenas via `/api/v1/ea/*` | Pendente | |

---

## 2. Validação do banco de dados

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 2 — Schema, migrations e integridade | Tabelas MVP: auth, planos, assinaturas, licenças, instruções, execuções, heartbeats, auditoria, billing | `npx prisma migrate deploy` em ambiente limpo; `npx prisma db seed`; inspecionar tabelas `users`, `plans`, `subscriptions`, `licenses`, `instructions`, `instruction_status_logs`, `executions`, `ea_heartbeats`, `audit_logs`, `admin_actions`, `webhook_events` | Migrations aplicam sem erro; FKs e índices críticos presentes (`licenses(user_id,status)`, `instructions(license_id,current_status)`, `ea_heartbeats(license_id,received_at)`); seed cria planos Start/Pro/Black e perfis de exposição | Pendente | |

---

## 3. Validação da autenticação

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 3 — Auth.js (credenciais) e proteção de rotas | Login, sessão JWT, rotas públicas vs protegidas | Acessar `/login` sem sessão; logar com usuário seed; tentar `/dashboard` e `/admin` sem login; verificar cookie/sessão e redirect pós-login | Sem sessão → redirect `/login`; com sessão válida → acesso conforme papel; `/api/auth/*` operacional; landing `/` permanece pública | Pendente | |

---

## 4. Validação de roles ADMIN e CLIENT

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 4 — RBAC web (ADMIN vs CLIENT) | Mapeamento `UserRole` → `appRole`; middleware | Logar como `CLIENT`: acessar `/admin` e `POST /api/admin/*`; logar como `SUPERADMIN`/`OPS`/etc.: acessar `/dashboard` | Cliente redirecionado para `/dashboard` se tentar `/admin`; admin redirecionado para `/admin` se tentar `/dashboard`; APIs `/api/admin/*` retornam 403 para cliente | Pendente | Papéis admin no Prisma: SUPPORT, OPS, FINANCE, STRATEGY_OPS, SUPERADMIN |

---

## 5. Validação dos planos

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 5 — Catálogo Start / Pro / Black | Planos seed, limites e perfis permitidos | Consultar `plans`, `plan_features`, `plan_exposure_profiles` após seed; conferir slugs `start`, `pro`, `black` e `max_mt5_accounts` / `max_devices` / `allow_demo` | Três planos ativos; Start só conservador; Pro conservador+moderado; Black todos os perfis; limites coerentes com documento mestre | Pendente | |

---

## 6. Validação da assinatura

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 6 — Ciclo de vida da assinatura | Estados `SubscriptionStatus`, exibição no dashboard e API | Criar/alterar assinatura via seed ou webhook; `GET /api/me/subscription` autenticado; tela `/dashboard/assinatura` | Status exibido corretamente (ACTIVE, PAST_DUE, CANCELLED, etc.); transições refletidas em `subscriptions` e auditoria quando aplicável | Pendente | |

---

## 7. Validação da licença

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 7 — Licença, ativação e flags operacionais | Estados `LicenseStatus`, `halt_new_entries`, `halt_all_trading`, vínculo MT5 | Fluxo: assinatura ativa → licença → código ativação → `POST /api/v1/ea/activate`; `GET /api/licenses/:id/status`; `GET /api/v1/ea/config` | Licença evolui PENDING_ACTIVATION → ACTIVE; config retorna flags e perfil de exposição sem parâmetros estratégicos; uma licença por conta MT5 (login+server únicos) | Pendente | |

---

## 8. Validação das APIs do EA

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 8 — Contrato REST `/api/v1/ea` | activate, config, heartbeat, instructions, executions, ignore, errors | Executar suite `tests/ea/*` e chamadas manuais com Bearer + headers `X-Request-Id`, `X-Device-Id`, `X-EA-Version` conforme `docs/EA-API.md` | Respostas JSON válidas; erros em `application/problem+json`; rotas públicas no middleware apenas para `/api/v1/ea/*` e activate | Pendente | |

---

## 9. Validação do heartbeat

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 9 — Heartbeat e telemetria | Registro em `ea_heartbeats`, `devices.last_seen_at`, snapshots equity/posição | EA ou `POST /api/v1/ea/heartbeat` com payload completo; aguardar intervalo; consultar último registro no banco | Heartbeat gravado; `device.lastSeenAt` atualizado; `equity_snapshots` e `position_snapshots` atualizados; resposta inclui flags `halt_new_entries` / `can_accept_new_entries` | Pendente | Limiar offline: 120s (`lib/ea/status.ts`) |

---

## 10. Validação do recebimento de sinal

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 10 — Instrução registrada (sinal → fila) | Criação de `instructions` com status inicial e pull pelo EA | Inserir instrução de teste (script/admin/seed interno) com `purpose` ENTRY; `GET /api/v1/ea/instructions` com token válido | Registro em `instructions` com `current_status=RECEIVED`; log em `instruction_status_logs`; payload sem campos de estratégia; transição para `SENT` no pull | Pendente | Motor de sinais/vault pode ser simulado no MVP |

---

## 11. Validação da execução do sinal

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 11 — Execução e ACK | `POST /api/v1/ea/executions` após ordem no MT5 (ou simulada) | EA em conta de teste com `InpDebugMode=false` **somente em homologação**; reportar FILLED com ticket/preço/slippage | Registro em `executions`; status da instrução → `EXECUTED`; correlação `instruction_id` + `request_id`; auditoria EA quando aplicável | Pendente | Homologação preferir conta demo dedicada |

---

## 12. Validação de ordem ignorada

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 12 — Estado IGNORED | EA reporta instrução não executada (expirada, duplicada, política) | `POST /api/v1/ea/instructions/ignore` com motivo; ou deixar instrução expirar e EA ignorar | `current_status=IGNORED`; entrada append-only em `instruction_status_logs` com `message`/motivo; visível no admin (ordens ignoradas) | Pendente | |

---

## 13. Validação de ordem rejeitada

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 13 — Estado REJECTED | Rejeição por risco, licença, broker ou validação | Forçar rejeição: execução `REJECTED` via API ou política `assertInstructionAllowed` / broker | `current_status=REJECTED` ou `executions.status=REJECTED`; log com `error_code`/`message` quando houver; admin lista rejeições | Pendente | |

---

## 14. Validação de posição aberta

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 14 — Posição aberta refletida | Snapshot de posição no heartbeat e dashboard | Abrir posição no MT5 (homologação); enviar heartbeat com `open_positions`; abrir `/dashboard` | `position_snapshots` com quantity ≠ 0; dashboard exibe posição (símbolo, qty, preço médio, P&L não realizado); admin KPI “clientes posicionados” incrementa | Pendente | |

---

## 15. Validação de posição encerrada

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 15 — Encerramento de posição | Instrução EXIT e limpeza de snapshot | Emitir instrução `purpose=EXIT`; EA executa e reporta; heartbeat subsequente sem posição | Posição zerada no MT5; snapshot atualizado ou vazio; P&L realizado refletido em `daily_pnls` quando aplicável; histórico operacional no dashboard | Pendente | |

---

## 16. Validação de evolução patrimonial

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 16 — Curva de equity e P&L | `equity_snapshots`, `daily_pnls`, gráficos no dashboard | Série de heartbeats ao longo de dias de teste; consultar `/dashboard` (gráfico equity) | Curva coerente com saldos reportados; P&L dia/mês exibidos; sem exposição de parâmetros internos | Pendente | |

---

## 17. Validação do comparativo com Ibovespa

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 17 — Benchmark Ibovespa | Tabela `benchmark_ibov_daily` (seed) vs equity do cliente | Após seed de benchmark; cliente com snapshots de equity; ver gráfico comparativo no dashboard | Série Ibovespa alinhada por data; comparação visual no período (1D/1M conforme UI); disclaimer de risco visível | Pendente | |

---

## 18. Validação do dashboard do cliente

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 18 — Dashboard `/dashboard` | Status do dia, EA online/offline, ordens, posição, P&L, histórico — sem setup estratégico | Login CLIENT; percorrer `/dashboard` e `/dashboard/assinatura`; inspecionar UI (preto/dourado) e ausência de formulários de stop/alvo/horário | Apenas status e resultado; perfil de exposição somente onde permitido; avisos de risco presentes; nenhum campo de estratégia | Pendente | |

---

## 19. Validação do painel administrativo

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 19 — Painel `/admin` | KPIs, sinais, execuções, rejeitadas/ignoradas, slippage, latência, P&L, erros EA, billing, licenças, ações | Login ADMIN; `/admin` e `/admin/clientes`; testar botões pausar entradas, bloquear cliente, emergência (OPS/SUPERADMIN) | Todas as seções do escopo MVP carregam dados; cliente não acessa `/admin`; ações gravam `admin_actions` + `audit_logs` | Pendente | Emergência: `POST /api/admin/emergency/cancel-orders` |

---

## 20. Validação dos logs e auditoria

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 20 — Trilha imutável | `audit_logs`, `instruction_status_logs`, `admin_actions` | Executar fluxo completo ordem + ação admin; consultar DB por `entity_id` / `request_id` | Histórico append-only (sem sobrescrever status antigo); correlação EA ↔ API; ator correto (`USER`, `ADMIN`, `SYSTEM`, `EA`) | Pendente | |

---

## 21. Validação de segurança

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 21 — Segurança MVP | Secrets, HTTPS, tokens EA, não vazamento de estratégia | Revisar `.env` não commitado; tentar acessar API admin/EA sem credencial; inspecionar respostas JSON cliente/EA | 401/403 adequados; `device_token` só via activate; webhook billing exige secret; nenhum campo `strategy`, `parameters`, indicadores internos nas APIs públicas | Pendente | |

---

## 22. Validação de billing/webhook

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 22 — Webhook de pagamento | `POST /api/webhooks/billing` idempotente | Enviar payload válido com header `x-webhook-secret`; repetir mesmo `event_id`; tipos `payment.approved`, `payment.failed`, `subscription.cancelled`, `chargeback` | Primeira chamada processa; duplicata não duplica efeito; `webhook_events` registrado; assinatura/licença atualizadas conforme tipo | Pendente | Ver `docs/SUBSCRIPTION-LICENSING.md` |

---

## 23. Validação de inadimplência

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 23 — Assinatura PAST_DUE / licença suspensa | Bloqueio de novas entradas mantendo gestão | Webhook `payment.failed` ou marcar `subscription.status=PAST_DUE`; `GET /api/v1/ea/config` e tentativa ENTRY | `halt_new_entries=true`; `can_accept_new_entries=false`; `can_manage_open_positions=true` (SUSPENDED + política); mensagem genérica no dashboard | Pendente | |

---

## 24. Validação de bloqueio de novas entradas

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 24 — Pausa admin e flags servidor | `POST /api/admin/licenses/:id/pause-entries` e comportamento do EA | Admin pausa entradas; EA consulta config/heartbeat; tentar ENTRY | EA não abre nova posição de entrada; flag persistida em `licenses.halt_new_entries`; registro em `admin_actions` | Pendente | Retomar: `pause: false` + sync de flags |

---

## 25. Validação de posição aberta com licença vencida

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 25 — Gestão com assinatura inativa | Regra P5 / AGENTS.md §5: sem novas entradas, saída permitida | Com posição aberta, inativar assinatura; emitir instrução `EXIT`; `GET /api/v1/ea/instructions` | ENTRY bloqueada (`assertInstructionAllowed` / EA); EXIT/ADJUSTMENT entregues; posição pode ser encerrada; cliente vê mensagem de proteção, não lógica estratégica | Pendente | |

---

## 26. Validação do EA em DebugMode

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 26 — `InpDebugMode=true` | EA não envia ordens reais ao broker | Anexar EA com `InpDebugMode=true` (default no fonte); receber instrução ENTRY | Nenhum `OrderSend` real; execução simulada/reportada à API conforme módulo `MR_AT_Execution.mqh`; heartbeats e pulls normais | Pendente | Recomendado até fim da homologação |

---

## 27. Validação do EA em conta demo

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 27 — `trade_mode=DEMO` vs plano | Planos seed com `allow_demo=false` | Heartbeat com `trade_mode: DEMO` em licença plano Start/Pro/Black | API rejeita ou sinaliza bloqueio conforme política implementada no heartbeat/config; licença real-only não opera em demo | Pendente | Validar mensagem de erro ao usuário |

---

## 28. Validação de VPS desconectada

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 28 — EA offline (VPS parada) | Sem heartbeat > 120s | Parar EA/VPS; aguardar >2 min; dashboard cliente e admin | Status EA **offline**; admin conta EAs offline; opcional: evento `HEARTBEAT_TIMEOUT` em `risk_events` se configurado | Pendente | |

---

## 29. Validação de perda de conexão

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 29 — Falha de rede / WebRequest | Interrupção HTTPS entre MT5 e API | Bloquear URL no firewall ou desligar rede; observar logs EA (`MR_AT_Http.mqh`, `MR_AT_Error.mqh`) | EA não executa ordens órfãs sem ACK; erros reportados via `POST /api/v1/ea/errors` quando possível; ao restabelecer, heartbeat recupera estado | Pendente | |

---

## 30. Validação de emergência

| Item | O que testar | Como testar | Resultado esperado | Status | Observações |
|------|--------------|-------------|-------------------|--------|-------------|
| 30 — Cancelamento de emergência (admin) | `POST /api/admin/emergency/cancel-orders` apenas SUPERADMIN/OPS | Criar instruções RECEIVED/SENT; acionar botão/API; tentar com papel SUPPORT (deve falhar) | Ordens pendentes → `CANCELLED` + log; `admin_actions` e `audit_logs` preenchidos; 403 para papéis sem permissão | Pendente | Cancela fila no servidor; EA não executa instruções canceladas |

---

## Resumo de execução (preencher ao final)

| Métrica | Valor |
|---------|-------|
| Total de itens | 30 |
| OK | |
| Falha | |
| N/A | |
| Pendente | |
| Data da validação | |
| Responsável | |
| Ambiente | |
| Versão do commit / tag | |

---

## Critérios de aceite do MVP (gate)

- [ ] **0 itens críticos em Falha** nos blocos 3, 4, 7, 8, 21, 22, 23, 25 e 30.
- [ ] Fluxo feliz completo: assinar → ativar EA → heartbeat → instrução → execução → dashboard.
- [ ] Nenhuma regressão de caixa preta (checklist `AGENTS.md` §9).
- [ ] Homologação EA com `InpDebugMode=true` documentada antes de conta real.

---

*Mercado da Riqueza AutoTrade — checklist de validação MVP. Não substitui testes automatizados (`vitest`), pentest ou homologação regulatória.*
