# Arquitetura — EA Mãe / Robô Mestre e distribuição de sinais

Documento de **arquitetura alvo** para o fluxo **EA Mãe (Robô Mestre) → Plataforma AutoTrade → EAs cliente**, no modelo **caixa preta** do Mercado da Riqueza AutoTrade.

**Branch de referência:** `staging-vps-homologacao`  
**Homologação vigente:** local e staging aprovadas ([`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md), [`docs/STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md)).  
**Staging:** [https://autotrade-staging.mercadodariqueza.com.br](https://autotrade-staging.mercadodariqueza.com.br)

Este documento **não** descreve implementação atual de endpoint mestre — apenas o desenho acordado para as próximas fases.

---

## 1. Visão geral

O **EA Mãe** (Robô Mestre) é o componente que **origina ou consolida sinais oficiais** da operação controlada pelo Mercado da Riqueza. Ele **não** envia ordens nem sinais **diretamente** para os MetaTraders dos clientes.

O fluxo correto é sempre **mediado pela plataforma**:

```text
EA Mãe / Robô Mestre
    → API AutoTrade (sinal mestre)
    → validação centralizada
    → criação de instruções por licença/cliente
    → EA cliente consulta GET /instructions
    → EA cliente executa ou simula (DebugMode)
    → EA cliente reporta POST /executions
    → painel atualiza status (admin / cliente agregado)
```

```mermaid
flowchart LR
  ME[EA Mãe] --> API[API AutoTrade]
  API --> VAL[Validação e auditoria]
  VAL --> DISP[Dispatch por licença]
  DISP --> INS[Instruções individuais]
  INS --> CE[EA cliente]
  CE --> EX[POST /executions]
  EX --> PNL[Painel / auditoria]
```

**Por que não ponto a ponto (Mãe → clientes)?**

- A plataforma é a **única fonte de verdade** para quem pode operar, quando e com qual exposição.
- Regras de assinatura, licença, demo, halts e dispositivos são aplicadas **uma vez**, de forma consistente.
- O cliente permanece no modelo **caixa preta**: recebe apenas instruções já autorizadas, sem visão da lógica mestre.

---

## 2. Princípio caixa preta

Alinhado a [`AGENTS.md`](../AGENTS.md) e [`docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`](MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md):

| O cliente **não** | O cliente **pode** |
|-------------------|-------------------|
| Conhecer ou parametrizar estratégia | Conectar conta MT5 autorizada |
| Ver filtros, horários operacionais internos, stops/alvos táticos | Escolher **perfil de exposição** permitido pelo plano (rótulo comercial) |
| Escolher regras de entrada/saída | Acompanhar status da licença, EA online, ordens/resultados agregados |
| Receber sinais do EA Mãe diretamente | Ativar o EA executor com código; heartbeat; pull de instruções |

Toda **regra estratégica** e o **vault** permanecem no servidor/admin do Mercado da Riqueza — nunca no EA distribuído ao cliente, na API pública voltada ao cliente nem em payloads que revelem tática.

---

## 3. Responsabilidades do EA Mãe

O EA Mãe (ou processo equivalente em ambiente controlado) **deve**:

| Responsabilidade | Detalhe |
|------------------|---------|
| Ambiente controlado | Rodar somente em infraestrutura/autorização do Mercado da Riqueza (VPS/conta/servidor designados). |
| Sinal oficial | Gerar ou receber eventos de operação já aprovados pela engenharia de estratégia (fora do escopo do cliente). |
| Envio à API | Enviar **sinal mestre** para a API AutoTrade (não para IPs ou tokens de clientes). |
| Identificação | Incluir identificador estável do sinal (`master_signal_id` ou equivalente) e `idempotency_key`. |
| Conteúdo mínimo do sinal | Ativo (`symbol`), lado (`side`), tipo de ordem (`order_type`), propósito (`purpose`: ENTRY, EXIT, ADJUSTMENT, etc.), quantidade base ou referência de **perfil** comercial — **sem** expor parâmetros internos de estratégia. |
| Origem declarada | Campo `source` (ex.: `MASTER_EA`) para auditoria. |

O EA Mãe **nunca** deve:

- Distribuir mensagens, arquivos ou ordens **diretamente** para EAs ou terminais de clientes.
- Usar credenciais, `device_token` ou dados de conta MT5 de clientes.
- Depender de estado local do cliente para decidir quem opera.
- Enviar payload com indicadores, horários editáveis, stops/alvos táticos ou `.set` estratégicos.

---

## 4. Responsabilidades da Plataforma AutoTrade

A plataforma é o **motor de distribuição e compliance**:

| Etapa | Responsabilidade |
|-------|------------------|
| Recepção | Receber sinal mestre em endpoint dedicado (futuro). |
| Autenticação | Validar origem mestre (token/segredo **separado** dos tokens de EA cliente). |
| Política | Validar se o sinal é permitido (símbolo, purpose, janela operacional interna, kill switch global, etc.). |
| Auditoria | Persistir registro imutável do sinal original (quem, quando, payload redigido se necessário). |
| Elegibilidade | Selecionar licenças/clientes elegíveis ao dispatch. |
| Regras por licença | Aplicar plano, assinatura, `allow_demo`, MT5 vinculado, `max_devices`, `max_mt5`, halts, expiração. |
| Materialização | Criar **instruções individuais** (uma por licença/device elegível), com `instruction_id` e correlação ao `master_signal_id`. |
| Idempotência | Ignorar ou deduplicar reenvio do mesmo `idempotency_key` / `master_signal_id`. |
| Status | Manter trilha por cliente: RECEIVED → SENT → terminal; consolidar visão admin. |
| Painel | Expor status agregado **sem** vazar lógica estratégica ao cliente. |

A plataforma **não** delega ao EA Mãe a decisão de “quem entra na operação”.

---

## 5. Responsabilidades do EA cliente

O EA cliente (`MR_AutoTrade_Executor`) permanece **executor licenciado e monitorado** — não robô estratégico. Ver [`docs/EA-API.md`](EA-API.md).

| Responsabilidade | Detalhe |
|------------------|---------|
| Ativação | `POST /activate` com código gerado no dashboard. |
| Heartbeat | `POST /heartbeat` com login/servidor MT5 vinculados à licença. |
| Pull | `GET /instructions` — somente instruções já autorizadas pela API. |
| Execução | Executar no broker **ou** simular em `DebugMode` (homologação). |
| Reporte | `POST /executions` com resultado; `POST /errors` para falhas técnicas. |
| Limites | Respeitar `halt_new_entries`, `halt_all_trading` e flags do heartbeat/config. |

O EA cliente **não** deve:

- Conhecer existência ou lógica do EA Mãe.
- Aceitar inputs MQL5 de estratégia (indicadores, horários, stops editáveis pelo usuário, etc.).
- Processar sinais de origem não autenticada pela API `/api/v1/ea/*`.

---

## 6. Fluxo de estados

### 6.1 Sinal mestre (conceitual)

Estados no domínio **Master Signal** (nomes alvo; implementação futura):

| Estado | Significado |
|--------|-------------|
| `RECEIVED` | Payload mestre aceito na API e persistido. |
| `VALIDATED` | Autenticação, schema, política global e idempotência OK. |
| `DISPATCHED` | Instruções individuais criadas (ou decisão registrada de zero elegíveis). |
| `FAILED` | Rejeitado antes do dispatch (origem inválida, política, replay, etc.). |

### 6.2 Instrução individual (por licença/cliente)

Alinhado a [`AGENTS.md`](../AGENTS.md) e trilha atual de ordens:

| Estado | Significado |
|--------|-------------|
| `RECEIVED` | Instrução registrada no servidor após regras de risco/licença. |
| `SENT` | Disponível no pull do EA / despachada na fila entregável. |
| `EXECUTED` | Preenchida ou reportada como `FILLED`/`PARTIAL` (incl. DebugMode). |
| `REJECTED` | Recusada por risco, licença, broker ou política no reporte. |
| `IGNORED` | Expirada, duplicada ou fora de política sem envio efetivo. |
| `CANCELLED` | Cancelada server-side ou pelo fluxo de gestão. |
| `EXPIRED` | Não executada dentro da janela (pode mapear para `IGNORED` conforme implementação). |

```text
Master Signal:  RECEIVED → VALIDATED → DISPATCHED
                                              ↓
Por licença:    RECEIVED → SENT → EXECUTED | REJECTED | IGNORED | CANCELLED | EXPIRED
```

Correlação: `master_signal_id` + `instruction_id` + `request_id` (EA) para auditoria ponta a ponta.

---

## 7. Segurança

| Controle | Requisito |
|----------|-----------|
| Autenticação mestre | Endpoint do EA Mãe com credencial **própria** (API key, mTLS ou JWT de serviço) — **nunca** reutilizar `device_token` de cliente. |
| Segregação de segredos | `MASTER_EA_*` (nome ilustrativo) em variáveis de ambiente separadas de `AUTH_SECRET` e tokens de dispositivo. |
| Rate limit | Limitar POST de sinais por origem/IP/chave. |
| Idempotência | Obrigatório `idempotency_key` (e/ou `master_signal_id` único) para evitar duplicar instruções em retry. |
| Anti-replay | Janela de tempo + nonce ou timestamp assinado; rejeitar sinais antigos reenviados. |
| Origem confiável | Allowlist de IPs ou assinatura HMAC do body; rejeitar sinal sem prova de origem. |
| Auditoria | Log estruturado: recebimento mestre, decisão por licença, motivo de rejeição (código interno, não estratégia). |
| Payload cliente | Instruções em `/instructions` contêm apenas o necessário para execução autorizada — **sem** indicadores, filtros ou parâmetros de vault. |
| TLS | Apenas HTTPS em produção e staging. |

---

## 8. Risco e travas (pré-dispatch)

Antes de criar instrução individual para um cliente, a plataforma **deve** avaliar (não exaustivo):

| Verificação | Efeito típico |
|-------------|----------------|
| Assinatura `ACTIVE` | Sem assinatura ativa: sem novas entradas; gestão de posição aberta conforme política documentada. |
| Licença `ACTIVE` / não revogada | Bloqueio de novas instruções. |
| `allow_demo` | Conta MT5 demo só recebe entrada se plano staging/homolog permitir. |
| `max_devices` | Device atual deve estar ativo e dentro do limite. |
| `max_mt5` | Conta vinculada deve coincidir com heartbeat/pull. |
| `halt_new_entries` | Bloqueia novas **ENTRY**; EXIT/ADJUSTMENT podem seguir conforme `lib/licensing/flags.ts`. |
| `halt_all_trading` | Bloqueia execução material nova conforme política. |
| Expiração da instrução | Não entregar instrução expirada no pull. |
| Status do device | Token válido; heartbeat recente se política exigir. |
| MT5 vinculado | Login/servidor da licença = conta autorizada. |
| Kill switch global | Pode impedir dispatch de todos os clientes. |

Falhas geram **não criação** da instrução ou instrução em estado terminal `REJECTED`/`IGNORED`, com motivo interno auditável.

---

## 9. Modelo de payload conceitual

> **Atenção:** exemplos **ilustrativos**. Não são contrato implementado. Campos finais serão definidos na Fase 2–3 com Zod e versionamento `/v1`.

### 9.1 Entrada — sinal mestre (EA Mãe → plataforma)

```http
POST /api/master/signals
Authorization: Bearer <master_service_token>
Content-Type: application/json
Idempotency-Key: <uuid>
```

```json
{
  "master_signal_id": "msig_20260524_001",
  "source": "MASTER_EA",
  "symbol": "WDOM26",
  "side": "BUY",
  "order_type": "MARKET",
  "purpose": "ENTRY",
  "profile": "START",
  "idempotency_key": "idem_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Campos opcionais futuros (ainda conceituais): `quantity_hint`, `valid_until`, `correlation_group`, `metadata_internal` (restrito ao admin/vault — **nunca** repassado ao EA cliente).

### 9.2 Transformação — instrução individual (plataforma → EA cliente)

A plataforma **deriva** N instruções (uma por licença elegível), por exemplo:

```json
{
  "instruction_id": "inst_lic_abc123",
  "master_signal_id": "msig_20260524_001",
  "symbol": "WDOM26",
  "side": "BUY",
  "order_type": "MARKET",
  "purpose": "ENTRY",
  "volume": 1.0,
  "status": "SENT"
}
```

O volume e símbolo efetivos podem ser ajustados por **perfil de exposição** e política de risco **no servidor** — o cliente não escolhe esses ajustes.

### 9.3 Resposta mestre (conceitual)

```json
{
  "master_signal_id": "msig_20260524_001",
  "status": "DISPATCHED",
  "instructions_created": 42,
  "instructions_skipped": 3,
  "skip_reasons_summary": {
    "halt_new_entries": 2,
    "license_inactive": 1
  }
}
```

`skip_reasons_summary` é visão **admin**; não expor detalhes estratégicos ao dashboard cliente.

---

## 10. Fora de escopo nesta etapa

Nesta fase (**somente documentação**), **não** será feito:

- Implementar endpoint `POST /api/master/signals` ou equivalente.
- Alterar schema Prisma ou criar migrations.
- Alterar EA cliente (`ea/mql5/`) ou criar EA Mãe em MQL5 no repositório.
- Alterar dashboard, landing, billing ou integração DARF.
- Alterar variáveis de ambiente em Vercel/VPS.
- Expor estratégia, backtest ou parâmetros de vault em API pública.
- Operar conta real de cliente ou conta mestre em produção sem gate formal.

---

## 11. Próximas fases sugeridas

| Fase | Entrega | Observação |
|------|---------|------------|
| **1** | Documentação da arquitetura | Este documento — **concluído nesta etapa**. |
| **2** | Modelagem `MasterSignal` (e correlatos) no banco | Migrations versionadas; auditoria e idempotência. |
| **3** | Endpoint seguro `POST /api/master/signals` | Auth mestre, Zod, rate limit, anti-replay. |
| **4** | Dispatch para licenças elegíveis | Job síncrono ou fila; regras da seção 8. |
| **5** | Painel admin: visão mestre × clientes | Status agregado; sem vazamento de estratégia ao cliente. |
| **6** | Testes em staging | EA Mãe simulado ou fixture; EAs cliente em `DebugMode` no subdomínio staging. |
| **7** | Produção simulada | Contas demo/real limitadas; halts e kill switch exercitados. |
| **8** | Produção real | Somente após validações, `allow_demo=false` em produção, domínio `autotrade.mercadodariqueza.com.br` e gate de release formal. |

---

## Referências

| Documento | Conteúdo |
|-----------|----------|
| [`AGENTS.md`](../AGENTS.md) | Regras de produto (caixa preta, auditoria, halts) |
| [`docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`](MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md) | Visão de produto e domínios |
| [`docs/EA-API.md`](EA-API.md) | Contrato atual EA cliente |
| [`docs/STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md) | Homologação staging aprovada |

---

*Arquitetura alvo — Mercado da Riqueza AutoTrade. Não substitui aprovação de compliance nem implementação.*
