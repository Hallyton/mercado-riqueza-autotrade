# Minuta — Termos e Disclaimers para Participante Beta DEMO
## Mercado da Riqueza AutoTrade

---

> **Aviso inicial obrigatório**
>
> Esta é uma **minuta operacional preliminar** para **revisão jurídica**.
>
> - **Não** constitui contrato final.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** autoriza uso com dinheiro real.  
> - **Não** substitui revisão jurídica profissional.

**Data da minuta:** 2026-05-27  
**Fase:** 10.3 — Beta DEMO Terms & Disclaimer Draft  
**Status:** `DRAFT_FOR_LEGAL_REVIEW`  
**Decisão operacional:** `REAL_ACCOUNT_NOT_APPROVED`

Documentos relacionados: [`LEGAL-COMMERCIAL-REVIEW-PREPARATION.md`](LEGAL-COMMERCIAL-REVIEW-PREPARATION.md), [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md), [`BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md).

---

## 1. Objetivo

Definir uma **minuta** de termos, **ciência de risco** e **disclaimers** para participantes de validações **beta** em ambiente **DEMO/STAGING** do Mercado da Riqueza AutoTrade, pendente de revisão e aprovação por assessoria jurídica qualificada.

---

## 2. Escopo do beta DEMO

O participante poderá participar **apenas** de validações em:

- Ambiente **DEMO/STAGING** (`https://autotrade-staging.mercadodariqueza.com.br` ou ambiente designado)  
- Conta MT5 **DEMO** (ex.: login/servidor informados no onboarding)  
- Fluxo **supervisionado** conforme runbook operacional  
- **Dispatch manual** (administrativo)  
- **Tracking** operacional consolidado  
- Execução **simulada/controlada** (`DebugMode` conforme política da sessão)  
- **Sem** conta real  
- **Sem** dinheiro real  

---

## 3. O que o beta DEMO permite

- Testar **conectividade** (API, WebRequest, heartbeat)  
- Validar **EA cliente** em ambiente DEMO  
- Validar **heartbeat** e status online  
- Validar recebimento de **instruction** (`MASTER_SIGNAL`)  
- Validar **tracking** no dashboard  
- Validar **fluxo operacional** ponta a ponta  
- Validar **runbook** e procedimentos de sessão  
- Validar **suporte** e **rollback** em DEMO  

---

## 4. O que o beta DEMO não permite

- Uso de **conta real**  
- Envio de **ordem real** (fora de política aprovada e gates futuros)  
- Uso com **dinheiro real**  
- **Produção financeira** ou operação comercial ampla  
- **Promessa de rentabilidade** ou performance garantida  
- **Copy trade público** ou distribuição aberta de sinais  
- **Múltiplos clientes reais** em escala  
- **Alteração não autorizada** do EA (parâmetros, URL, símbolo)  
- **Compartilhamento** de token, `device_token`, activation code ou secrets  
- Uso **fora do runbook** ou sem orientação operacional  

---

## 5. Declaração sobre conta real

O participante declara **ciência** de que o Mercado da Riqueza AutoTrade, **nesta etapa**, **não está autorizado** para uso em **conta real**. Qualquer eventual avaliação futura com **dinheiro real** dependerá de **novo gate** jurídico, operacional, técnico e financeiro, com **autorização específica** e **documentação própria**.

---

## 6. Declaração sobre ausência de promessa de rentabilidade

O participante declara **ciência** de que **não há** promessa, garantia ou expectativa assegurada de **lucro**, **rentabilidade**, **resultado financeiro** ou **performance futura**. Resultados observados em ambiente **DEMO** **não representam** garantia de resultado em conta real.

---

## 7. Declaração de ambiente DEMO

O participante declara **ciência** de que a validação ocorre **exclusivamente** em ambiente **DEMO/STAGING**, podendo envolver **simulações**, conta **demo**, execução **controlada** e registros operacionais **sem** exposição a dinheiro real.

---

## 8. Declaração sobre risco tecnológico

O participante declara entender que sistemas automatizados e integrações podem sofrer, entre outros:

- Falhas de **conexão** ou rede  
- **Indisponibilidade** de servidor (cloud, API)  
- Falha de **VPS** ou ambiente de hospedagem  
- Falha de **MetaTrader 5** ou terminal  
- Falha de **WebRequest** ou domínio não autorizado  
- **Erro de configuração** (conta, EA, URL)  
- Comportamento **inesperado** do EA  
- **Divergência** de dados ou tracking  
- Falha de **corretora** ou plataforma de mercado  
- Falha ou atraso de **logs/tracking**  

O participante compromete-se a **comunicar** falhas ou inconsistências observadas.

---

## 9. Responsabilidades do Mercado da Riqueza nesta fase

Nesta fase beta DEMO, o Mercado da Riqueza compromete-se, na medida do escopo documentado, a:

- Manter ambiente **DEMO/STAGING** para validação  
- Manter **conta real bloqueada** (`REAL_ACCOUNT_NOT_APPROVED`)  
- Manter **dispatch automático desativado**  
- Manter **Real Trading Guard** ativo no backend  
- Manter **runbook operacional** e políticas documentadas  
- Registrar **evidências operacionais** (textuais; sem secrets no repositório público)  
- **Agir** em caso de incidente conforme procedimentos (pausa, rollback, revogação)  
- Manter **logs** e **redaction** conforme política de segurança e sigilo  

*Limitação:* esta minuta **não** cria obrigação de disponibilidade ininterrupta nem SLA comercial até contrato formal aprovado.

---

## 10. Responsabilidades do participante beta DEMO

O participante compromete-se a:

- Usar **somente** conta MT5 **DEMO** autorizada  
- **Não** inserir ou vincular **conta real**  
- **Não** compartilhar activation code, `device_token` ou credenciais  
- **Não** alterar EA sem **autorização** do responsável técnico  
- **Não** modificar parâmetros críticos (URL API, modo debug, etc.) sem autorização  
- **Não** divulgar prints ou logs com **dados sensíveis**  
- **Seguir** orientação operacional e runbook da sessão  
- **Comunicar** falhas, inconsistências ou incidentes  
- Reconhecer que **não há promessa de rentabilidade**  

---

## 11. Dados, logs e evidências

- Podem ser coletados **dados operacionais** do ambiente DEMO (status, heartbeat, tracking, execution report agregado).  
- Podem ser registrados **heartbeat**, status, **tracking**, execution report e **logs redigidos**.  
- **Tokens**, **secrets** e **senhas** **não** devem ser compartilhados pelo participante.  
- **Evidências visuais** podem ser dispensadas por **política de sigilo** (sem comprometer segurança).  
- Qualquer coleta deve respeitar **segurança** e **privacidade** — tratamento LGPD sujeito a revisão jurídica (Fase 10.2).

---

## 12. Incidentes e rollback

Em caso de incidente, o Mercado da Riqueza **poderá**:

- **Pausar** a sessão  
- **Interromper** novos dispatches  
- Solicitar **remoção** do EA do gráfico  
- **Revogar** device/token  
- Solicitar **reativação** com novo código  
- **Registrar** incidente  
- **Preservar** histórico de auditoria  
- **Encerrar** a participação beta  

O participante cooperará com instruções de rollback documentadas em [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md).

---

## 13. Comunicação permitida

O participante pode receber:

- Instruções de **instalação** e configuração DEMO  
- Orientações de **uso** em ambiente DEMO  
- **Atualizações operacionais** e avisos de manutenção  
- Pedidos de **feedback** sobre o beta  
- Orientações de **rollback** ou pausa de sessão  

---

## 14. Comunicação proibida

É **proibida** a interpretação ou divulgação por qualquer parte de que o beta constitui:

- **Recomendação de investimento**  
- **Promessa de lucro** ou rentabilidade  
- **Convite** para operação em conta real  
- **Garantia** de performance  
- **Liberação** de conta real  
- **Oferta pública** de copy trade  

---

## 15. Aceite do participante

*(Preencher após revisão jurídica e antes do início do beta — formato final a definir com jurídico.)*

| Campo | Valor |
|-------|--------|
| **Nome do participante** | A PREENCHER |
| **E-mail** | A PREENCHER |
| **Conta MT5 DEMO** | A PREENCHER |
| **Data** | A PREENCHER |

**Declaro que li e compreendi que:**

- Este beta é **somente DEMO/STAGING**;  
- **Conta real não está liberada**;  
- **Não há promessa de rentabilidade**;  
- **Dinheiro real permanece bloqueado**;  
- Qualquer uso real exigirá **novo gate** e documentação específica.

| Campo | Valor |
|-------|--------|
| **Assinatura / aceite** | A PREENCHER |

---

## 16. Status da minuta

| Campo | Valor |
|-------|--------|
| **Status** | `DRAFT_FOR_LEGAL_REVIEW` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Natureza** | Minuta preliminar — **não** contrato final |

---

## 17. Pendências para revisão jurídica

- [ ] Validar **linguagem jurídica** e enquadramento regulatório  
- [ ] Validar **disclaimers** (redação final)  
- [ ] Validar necessidade de **aceite eletrônico** ou assinatura  
- [ ] Validar **LGPD** (base legal, retenção, direitos do titular)  
- [ ] Validar **responsabilidade** por falhas (plataforma, participante, corretora)  
- [ ] Validar **suitability**, se aplicável ao beta  
- [ ] Validar **comunicação comercial** associada ao beta  
- [ ] Validar se a minuta **pode ser usada** em programa beta DEMO atual  
- [ ] Definir versão **aprovada** e data de vigência (se aplicável)  

---

*Mercado da Riqueza AutoTrade — minuta beta DEMO para revisão jurídica (Fase 10.3). Não autoriza conta real, produção real nem dispatch automático.*
