# Resultado da homologação staging/VPS — Mercado da Riqueza AutoTrade

Registro formal da homologação **online** (Vercel + Neon + EA na VPS/demo) **aprovada** na branch `staging-vps-homologacao`, incluindo **domínio próprio de staging** validado ponta a ponta.

Documentos relacionados: [`docs/STAGING-VPS-HOMOLOGATION.md`](STAGING-VPS-HOMOLOGATION.md), [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md).

**Status:** homologação staging com domínio próprio **aprovada**.

---

## Identificação do ambiente

| Campo | Valor |
|-------|--------|
| **Ambiente** | Vercel staging + Neon PostgreSQL staging (separado de produção e de homologação local) |
| **URL oficial (API/web/EA)** | [https://autotrade-staging.mercadodariqueza.com.br](https://autotrade-staging.mercadodariqueza.com.br) |
| **Fallback técnico** | [https://mercado-riqueza-autotrade-staging.vercel.app](https://mercado-riqueza-autotrade-staging.vercel.app) — apenas contingência; não é o padrão operacional |
| **`AUTH_URL` (Vercel staging)** | `https://autotrade-staging.mercadodariqueza.com.br` (Production e Preview) |
| **Branch de referência** | `staging-vps-homologacao` |
| **Projeto Vercel** | `mercado-riqueza-autotrade-staging` |
| **Banco** | Neon staging (instância/projeto dedicado; não localhost, não produção) |

---

## Atores e configuração usados

| Item | Detalhe |
|------|---------|
| **Cliente homologação** | `cliente.staging@mercadodariqueza.com.br` |
| **Conta MT5** | Login **52609973**, servidor **XPMT5-DEMO** |
| **EA** | `MR_AutoTrade_Executor.mq5` |
| **Inputs EA** | `InpDebugMode=true`, `InpLogLevel=2`, `InpApiBaseUrl=https://autotrade-staging.mercadodariqueza.com.br` (sem barra final) |
| **WebRequest MT5** | `https://autotrade-staging.mercadodariqueza.com.br` liberado em *Permitir WebRequest* |
| **Scripts homolog** | Cliente, assinatura ACTIVE, licença ACTIVE, `allow_demo=true` no plano (staging) |
| **Migrations** | Aplicadas com sucesso (`prisma migrate deploy`) |
| **Seed** | Executado com sucesso (`db:seed`) |

---

## Fluxo aprovado (ponta a ponta online)

1. Login do cliente staging no dashboard.
2. Vínculo da conta MT5 (login/servidor).
3. Correção de conta errada via botão **Alterar conta MT5** no `/dashboard/assinatura`.
4. Revogação de device/token antigo no servidor após alteração MT5.
5. Correção do EA para detectar **401 INVALID_TOKEN**, limpar credenciais locais e tentar reativação.
6. Reativação do EA com **novo código de ativação** gerado no dashboard.
7. **Heartbeat** OK (EA online no painel).
8. **GET /api/v1/ea/instructions** — HTTP 200.
9. Admin criou instrução **TEST** (`/admin/instrucoes`).
10. EA recebeu e parseou a instrução.
11. **DebugMode** — nenhuma ordem real enviada ao broker.
12. **POST /api/v1/ea/executions** — OK.
13. Painel admin — instrução em **EXECUTED**.

### Travas (validadas em homologação anterior, mantidas válidas)

- `halt_new_entries=true` — bloqueio de novas entradas testado.
- `halt_all_trading=true` — bloqueio total testado.
- Retomada com `halt_new_entries=false` e `halt_all_trading=false`.

---

## Homologação com domínio próprio (aprovada)

Subdomínio oficial de staging: **`autotrade-staging.mercadodariqueza.com.br`**

| Verificação | Resultado |
|-------------|-----------|
| DNS (registro **A** `autotrade-staging` → `76.76.21.21`) | OK |
| TLS / certificado SSL | OK |
| `AUTH_URL` alinhada ao subdomínio | OK (Production + Preview) |
| Login admin | OK |
| Login cliente staging | OK |
| `/dashboard/assinatura` | OK |
| EA — ativação | OK |
| Heartbeat | OK |
| **GET** `/api/v1/ea/instructions` | HTTP **200** |
| Admin — instrução **TEST** | OK |
| EA — recebe instrução (`InpDebugMode=true`, sem ordem real) | OK |
| **POST** `/api/v1/ea/executions` | OK |
| Painel admin — status **EXECUTED** | OK |

### Domínios explicitamente fora do escopo de staging

| Host | Motivo |
|------|--------|
| `www.mercadodariqueza.com.br` | Institucional / outro produto — **não** usar para AutoTrade staging |
| `autotrade.mercadodariqueza.com.br` | Reservado para **produção** AutoTrade futura |

---

## Estado final esperado (após homologação aprovada)

| Componente | Estado |
|------------|--------|
| `plans.allow_demo` (staging) | `true` |
| `halt_new_entries` | `false` |
| `halt_all_trading` | `false` |
| Devices ativos | **1** |
| Heartbeat | **Recente** (EA online) |
| Assinatura / licença | `ACTIVE` |
| Conta MT5 vinculada | **52609973** @ **XPMT5-DEMO** |

---

## Observações de segurança e operação

### Credenciais expostas durante a homologação — ação obrigatória

| Item | Ação recomendada |
|------|------------------|
| **URL do Deploy Hook** | Exposta durante homologação inicial — **revogada**; não reutilizar URL antiga. |
| **DATABASE_URL do Neon** | Exposta durante homologação inicial — senha **rotacionada** e variável atualizada no Vercel staging. |

### Domínios e staging

- **Não** usar `www.mercadodariqueza.com.br` para o ambiente AutoTrade staging (institucional / outro produto).
- **Não** usar `autotrade.mercadodariqueza.com.br` nesta fase — reservado para produção futura.
- Padrão operacional: **`https://autotrade-staging.mercadodariqueza.com.br`** (EA, WebRequest, `AUTH_URL`, bookmarks).
- A ferramenta **DARF** permanece em projeto e domínio **separados** — fora do escopo deste registro.

### Infraestrutura de domínio staging

- **Concluído:** `autotrade-staging.mercadodariqueza.com.br` no projeto Vercel `mercado-riqueza-autotrade-staging`, DNS, TLS e homologação EA/web revalidados no subdomínio.

---

## Escopo explicitamente fora desta homologação

- Produção AutoTrade com clientes reais.
- Billing/webhooks de gateway em ambiente live (apenas variáveis preparadas; sem promessa de rentabilidade).
- Ordens reais no broker (`InpDebugMode=true` em todo o ciclo aprovado).

---

## Aprovação

| Papel | Situação |
|-------|----------|
| Homologação staging/VPS online (`.vercel.app`) | **Aprovada** |
| Homologação staging com domínio próprio | **Aprovada** — `autotrade-staging.mercadodariqueza.com.br` |
| Homologação local (baseline) | Ver [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md) |
| Próximo gate sugerido | Gate de produção em `autotrade.mercadodariqueza.com.br` (futuro), billing live e `allow_demo=false` em produção |

---

*Documento de registro — não substitui checklist de produção nem o documento mestre do produto.*
