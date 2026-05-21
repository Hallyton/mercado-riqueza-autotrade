# AGENTS.md — Mercado da Riqueza AutoTrade

Instruções obrigatórias para agentes de IA e desenvolvedores neste repositório.  
Qualquer código, UI, API, documentação ou artefato gerado **deve** respeitar estas regras.

Documento de referência do produto: [`docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`](docs/MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md).

---

## 1. Identidade do produto

1. O projeto é uma plataforma **SaaS** chamada **Mercado da Riqueza AutoTrade**.
2. O modelo do produto é **caixa preta**: toda estratégia, parâmetros, filtros, horários, stops, alvos, regras de entrada, regras de saída e gestão ficam **exclusivamente no servidor/admin** do Mercado da Riqueza.
3. O cliente **não parametriza estratégia**.
4. O cliente **não vê** lógica de entrada, saída, filtros, horários, alvos, stops ou regras internas.
5. **Toda regra estratégica** fica no servidor/admin do Mercado da Riqueza — nunca no frontend do cliente, na API pública voltada ao cliente ou no EA distribuído.

---

## 2. EA cliente (MetaTrader 5)

6. O **EA cliente é apenas executor licenciado e monitorado** — não é robô estratégico.
7. **Não criar** inputs MQL5 de estratégia (indicadores, horários, stops editáveis, lotes manuais além do perfil, símbolos extras, trailing, parciais configuráveis pelo usuário, etc.).
8. **Não distribuir** arquivos `.set` ou configs que exponham parâmetros operacionais ao cliente.
9. Integração EA ↔ plataforma: **API REST HTTPS** com heartbeat; ver contratos em `docs/` e rotas `/ea/*` — sem expor vault de estratégia.

---

## 3. Interface do cliente (web)

10. **Não criar telas** onde o cliente configure setup, stop, alvo, parcial, trailing, horário ou filtro.
11. O cliente pode **apenas escolher perfil de exposição** permitido pelo plano (rótulo comercial + limites — sem detalhar tática).
12. O **dashboard do cliente** deve mostrar **status e resultado** (licença, EA online, ordens, posição, P&L, evolução patrimonial, benchmark vs Ibovespa) — **não estratégia**.
13. Incluir **avisos de risco** visíveis; o sistema **não pode prometer rentabilidade** (evitar copy de “lucro garantido”, retorno fixo ou promessas de performance).

---

## 4. Painel administrativo

14. O **painel admin** pode mostrar informações operacionais internas (licenças, heartbeats, instruções, execuções, kill switch, eventos de risco).
15. Parâmetros do **vault de estratégia** só para roles autorizadas (`strategy_ops` / engenharia), em ambiente isolado — **não** expor vault a suporte genérico na UI.

---

## 5. Assinatura, licença e gestão de posição

16. **Assinatura vencida** bloqueia **novas entradas**, mas **não abandona gestão de posição aberta** (saídas/ajustes autorizados pelo servidor conforme política de risco — implementar no motor de instruções, não “abandonar” posições no broker).
17. Licença suspensa/revogada: EA deve receber `halt_trading` / equivalente; novas instruções de entrada negadas; gestão de posição existente segue regra server-side documentada.

---

## 6. Auditoria e logs de ordens

18. **Toda execução precisa ser auditável** (quem, quando, qual licença, qual instrução, qual resultado).
19. **Toda ordem** precisa ter log com status explícito, no mínimo:
    - `RECEIVED` — instrução registrada no servidor
    - `SENT` — despachada ao EA
    - `EXECUTED` — preenchida no MT5 (com ticket/preço quando aplicável)
    - `REJECTED` — recusada por risco, licença ou broker
    - `IGNORED` — expirada, duplicada ou fora de política sem envio
    - `CANCELLED` — cancelada server-side ou pelo fluxo de gestão

Persistir transições; não sobrescrever histórico. Usar `request_id` / `instruction_id` para correlação EA ↔ API.

---

## 7. Identidade visual (obrigatória)

20. **Toda alteração de UI** deve preservar a identidade visual do Mercado da Riqueza:
    - **Cores:** preto (base/fundo), dourado (destaques, CTAs, bordas premium), acentos discretos para dados financeiros
    - **Tom:** premium, trading, confiança institucional
    - **Marca:** uso consistente do touro/escudo da marca (assets oficiais; não substituir por ícones genéricos de “bull market”)
21. Reutilizar tokens de design (Tailwind theme / CSS variables) centralizados — **não** introduzir paletas paralelas (ex.: azul startup, roxo genérico) em telas novas.
22. Componentes: preferir **shadcn/ui** customizado ao tema da marca, não tema default cru.

---

## 8. Stack e convenções técnicas

### Stack obrigatória

| Camada | Tecnologia |
|--------|------------|
| Frontend | **Next.js** (App Router), **TypeScript**, **Tailwind CSS**, **shadcn/ui** |
| Backend | **Next.js API Routes** (MVP); evoluir para serviços separados se necessário |
| Banco | **PostgreSQL** |
| ORM | **Prisma** (migrations versionadas) |
| Auth | **Auth.js** (NextAuth) ou equivalente acordado no repo |
| Billing | Integração com gateway (Mercado Pago, Asaas ou Stripe) via webhooks idempotentes |
| API | **REST** JSON, HTTPS, versionada (`/v1`) |
| EA (futuro) | **MQL5** — executor; comunicação REST + heartbeat |

### Convenções de código

- **TypeScript estrito** — sem `any` casual em domínio de trading/billing.
- Validação de entrada com **Zod** (ou padrão já adotado no repo) em todas as rotas API.
- Erros HTTP: formato consistente (Problem Details ou envelope único do projeto).
- Secrets apenas em variáveis de ambiente — nunca commitar `.env`, chaves ou `.set` estratégicos.
- Nomes e comentários de domínio em **português** aceitável para regras de negócio; código (identificadores) em inglês salvo padrão existente no repo.

### Estrutura sugerida (referência)

```
app/                 # Next.js App Router (rotas web + API)
components/          # UI shadcn + composables da marca
lib/                 # Domínio, clients, utils
prisma/              # Schema e migrations
docs/                # Documentação de produto e API
```

### APIs — o que não expor ao cliente

- **Proibido** em API pública / dashboard cliente: rotas ou campos de `strategy`, `parameters`, `backtest`, `signals` explicativos, indicadores internos, horários operacionais editáveis.
- **Permitido** cliente: auth, assinatura, licença, vínculo MT5, perfil de exposição, dashboard agregado, benchmark Ibovespa.
- **EA:** apenas `/ea/*` (ativação, heartbeat, instruções, execuções, erros técnicos).

---

## 9. Checklist antes de merge (agente / dev)

- [ ] Nenhuma tela ou form de setup estratégico para o cliente
- [ ] Nenhum campo API que vaze parâmetros internos da estratégia
- [ ] Logs de ordem com estados `RECEIVED` → … → terminal
- [ ] Assinatura vencida: sem novas entradas; gestão de posição aberta preservada
- [ ] Disclaimers de risco presentes em fluxos relevantes
- [ ] UI respeita preto + dourado + marca touro/escudo
- [ ] Alterações alinhadas ao `MERCADO_DA_RIQUEZA_AUTOTRADE_MASTER.md`

---

## 10. Quando em dúvida

**Pergunta-guia:** “Isso permite ao cliente ver ou controlar *como* operamos?”  
Se **sim** → **não implementar** sem aprovação explícita de produto/compliance e atualização do documento mestre.

**Pergunta-guia 2:** “Um log ou screenshot disso revelaria entrada, saída, filtro ou parâmetro interno?”  
Se **sim** → redigir, agregar ou restringir ao admin/vault.

---

*Mercado da Riqueza AutoTrade — desenvolvimento em modelo caixa preta. Violações destas regras são regressões de produto e de IP.*
