# Resultado da homologação staging/VPS — Mercado da Riqueza AutoTrade

Registro formal da homologação **online** (Vercel + Neon + EA na VPS/demo) **aprovada** na branch `staging-vps-homologacao`.

Documentos relacionados: [`docs/STAGING-VPS-HOMOLOGATION.md`](STAGING-VPS-HOMOLOGATION.md), [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md).

---

## Identificação do ambiente

| Campo | Valor |
|-------|--------|
| **Ambiente** | Vercel staging + Neon PostgreSQL staging (separado de produção e de homologação local) |
| **URL pública da API/web** | [https://mercado-riqueza-autotrade-staging.vercel.app](https://mercado-riqueza-autotrade-staging.vercel.app) |
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
| **Inputs EA** | `InpDebugMode=true`, `InpLogLevel=2`, `InpApiBaseUrl=https://mercado-riqueza-autotrade-staging.vercel.app` (sem barra final) |
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
| **URL do Deploy Hook** | Foi exposta durante a homologação — **revogar/regenerar** o hook no Vercel e não reutilizar a URL em canais públicos. |
| **DATABASE_URL do Neon** | Foi exposta durante a homologação — **rotacionar a senha** do usuário/banco no Neon e atualizar a variável `DATABASE_URL` no projeto Vercel staging. |

### Domínios e staging

- **Não** usar `www.mercadodariqueza.com.br` para o ambiente AutoTrade staging (produção / outro produto).
- A ferramenta **DARF** permanece em projeto e domínio **separados** — fora do escopo deste registro.

### Próximo passo de infraestrutura (recomendado)

- Subdomínio dedicado para staging AutoTrade, por exemplo:  
  **`autotrade-staging.mercadodariqueza.com.br`**  
  apontando para o deploy Vercel staging, com TLS e `AUTH_URL` alinhada.

---

## Escopo explicitamente fora desta homologação

- Produção AutoTrade com clientes reais.
- Billing/webhooks de gateway em ambiente live (apenas variáveis preparadas; sem promessa de rentabilidade).
- Ordens reais no broker (`InpDebugMode=true` em todo o ciclo aprovado).

---

## Aprovação

| Papel | Situação |
|-------|----------|
| Homologação staging/VPS online | **Aprovada** |
| Homologação local (baseline) | Ver [`docs/HOMOLOGATION-RESULTS.md`](HOMOLOGATION-RESULTS.md) |
| Próximo gate sugerido | Domínio staging dedicado + rotação de secrets expostos + gate de produção |

---

*Documento de registro — não substitui checklist de produção nem o documento mestre do produto.*
