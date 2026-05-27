# Validação Operacional — Hardening VPS/MT5

**Data:** 2026-05-27  
**Fase:** 8.1 — Validação Operacional do Hardening VPS/MT5  
**Status:** `APPROVED_WITH_RESTRICTIONS` (atualizado na Fase 8.2)

Documentos relacionados: [`docs/PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md`](PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md), [`docs/PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md), [`docs/PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md).

---

## 1. Contexto

A auditoria técnica pré-conta real (Fase 7) foi encerrada com status `PRE_REAL_TECHNICAL_AUDIT_APPROVED_WITH_RESTRICTIONS` e decisão `REAL_ACCOUNT_NOT_APPROVED`.

Uma das **restrições remanescentes** é validar o **hardening real** da VPS/Windows/MetaTrader 5 onde os EAs operam.

O EA cliente pode armazenar `device_token` localmente em `MQL5/Files`. Por isso, o ambiente MT5/VPS deve ser tratado como **componente sensível** — não apenas como terminal de trading.

Esta fase registra a validação operacional mínima desse ambiente.

Conta real continua bloqueada. Produção real continua bloqueada. Dispatch automático continua desativado.

---

## 2. Escopo da validação

Validar:

- Windows/VPS.
- Usuário de acesso.
- RDP / acesso remoto.
- Firewall / Microsoft Defender.
- Atualizações do sistema.
- MetaTrader 5.
- Pasta `MQL5/Files`.
- Logs do MT5.
- WebRequest.
- AutoTrading.
- Operadores autorizados.
- Rollback operacional do ambiente.

---

## 3. Fora de escopo

Não autorizado nesta fase:

- Conta real.
- Ordem real.
- Produção real.
- Dispatch automático.
- Alteração de EA cliente ou EA Mãe.
- Alteração de backend.
- Alteração de envs.
- Alteração de schema / migrations.
- Deploy.

---

## 4. Checklist VPS/Windows

| Item | Status |
|------|--------|
| VPS dedicada | PENDENTE |
| Usuário Windows dedicado | PENDENTE |
| Senha forte | PENDENTE |
| RDP protegido | PENDENTE |
| 2FA/VPN, se disponível | PENDENTE |
| Firewall ativo | PENDENTE |
| Windows atualizado | PENDENTE |
| Defender/antivírus ativo | PENDENTE |
| Sem uso pessoal na VPS | PENDENTE |
| Acesso compartilhado bloqueado | PENDENTE |
| Operadores autorizados definidos | PENDENTE |
| Logs de acesso disponíveis, se aplicável | PENDENTE |

---

## 5. Checklist MetaTrader 5

| Item | Status |
|------|--------|
| MT5 instalado de fonte confiável | PENDENTE |
| Conta demo identificada | PENDENTE |
| Conta real não usada | PENDENTE |
| Servidor correto | PENDENTE |
| EA cliente instalado | PENDENTE |
| EA Mãe instalado, se aplicável | PENDENTE |
| AutoTrading sob controle | PENDENTE |
| WebRequest restrito ao domínio autorizado | PENDENTE |
| Logs visíveis | PENDENTE |
| Nenhuma ordem pendente desconhecida | PENDENTE |
| Nenhuma posição aberta desconhecida | PENDENTE |

**Referência operacional (homologação staging):** conta demo `52609973 @ XPMT5-DEMO`, URL `https://autotrade-staging.mercadodariqueza.com.br` — conferir na VPS real antes de marcar itens como OK.

---

## 6. Checklist MQL5/Files e tokens locais

| Item | Status |
|------|--------|
| Pasta `MQL5/Files` localizada | PENDENTE |
| Acesso restrito ao usuário Windows | PENDENTE |
| `device_token` não exibido em prints | PENDENTE |
| `device_token` não enviado por WhatsApp/e-mail | PENDENTE |
| Arquivos locais não versionados em Git | PENDENTE |
| Procedimento de revogação do device conhecido | PENDENTE |
| Procedimento de reativação conhecido | PENDENTE |
| Tokens antigos removidos, se aplicável | PENDENTE |

---

## 7. Checklist WebRequest

| Item | Status |
|------|--------|
| Domínio staging autorizado | PENDENTE |
| Domínios desnecessários ausentes | PENDENTE |
| URL base do EA conferida | PENDENTE |
| WebRequest não aponta para ambiente errado | PENDENTE |

**Domínio esperado (staging):** `https://autotrade-staging.mercadodariqueza.com.br`

---

## 8. Checklist AutoTrading

| Item | Status |
|------|--------|
| AutoTrading desligado fora de sessão | PENDENTE |
| AutoTrading ligado apenas quando autorizado | PENDENTE |
| Operador sabe desligar AutoTrading | PENDENTE |
| Operador sabe remover EA do gráfico | PENDENTE |
| Procedimento de emergência conhecido | PENDENTE |

---

## 9. Checklist de logs

| Item | Status |
|------|--------|
| Logs não mostram activation code | PENDENTE |
| Logs não mostram `device_token` | PENDENTE |
| Logs não mostram `InpMasterSecret` | PENDENTE |
| Logs não mostram `Authorization` / `Bearer` | PENDENTE |
| Logs permitem auditoria operacional | PENDENTE |
| Logs podem ser coletados sem secrets | PENDENTE |

---

## 10. Operadores e responsabilidades

| Papel | Responsável |
|-------|-------------|
| Responsável técnico | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável operacional | A DEFINIR — BLOQUEIA CONTA REAL |
| Operador MT5/VPS | A DEFINIR — BLOQUEIA CONTA REAL |
| Admin autorizado ao dispatch | A DEFINIR — BLOQUEIA CONTA REAL |
| Responsável pelo rollback | A DEFINIR — BLOQUEIA CONTA REAL |

Sem operadores definidos, qualquer avanço para conta real permanece bloqueado.

---

## 11. Procedimento de rollback do ambiente

1. Pausar dispatch admin.
2. Remover EA do gráfico.
3. Desativar AutoTrading.
4. Cancelar ordens pendentes, se aplicável e autorizado.
5. Fechar posição somente com autorização documentada.
6. Revogar device/token, se necessário.
7. Rotacionar secret, se necessário.
8. Bloquear acesso remoto se comprometido.
9. Preservar logs e histórico.
10. Registrar incidente.

Em caso de dúvida, parar a operação e preservar evidências redigidas.

---

## 12. Critérios de aprovação

Aprovar somente se:

- VPS dedicada ou ambiente controlado.
- Acesso remoto protegido.
- Firewall/Defender ativo.
- MT5 configurado corretamente.
- WebRequest restrito.
- AutoTrading sob controle.
- `MQL5/Files` protegido.
- Logs sem secrets.
- Operadores definidos.
- Rollback conhecido.

---

## 13. Critérios de reprovação

Reprovar se:

- VPS compartilhada sem controle.
- RDP exposto sem proteção.
- Token aparece em print/log.
- WebRequest amplo sem necessidade.
- AutoTrading sempre ligado sem controle.
- Operadores indefinidos.
- Logs expõem secrets.
- Rollback incerto.
- Conta real usada sem gate.

---

## 14. Status da validação

**Status atual:** `APPROVED_WITH_RESTRICTIONS` (Fase 8.2)

**Status inicial:** `PENDING_OPERATIONAL_VALIDATION`

Status possíveis:

- `PENDING_OPERATIONAL_VALIDATION`
- `APPROVED`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

---

## 15. Decisão

**Status (Fase 8.2):** `APPROVED_WITH_RESTRICTIONS`

**Motivo:** checklist preenchido com evidências de homologação staging e runbook; pendências em VPS/Windows, operadores e alguns itens MT5/Files/AutoTrading. Conta real permanece bloqueada.

---

## 16. Próxima ação recomendada

1. Executar este checklist manualmente na VPS/MT5 de homologação.
2. Preencher cada item (`OK` / `PENDENTE` / `N/A`) com data e responsável.
3. Anexar evidências redigidas (prints sem secrets).
4. Definir operadores na seção 10.
5. Atualizar o status deste documento para `APPROVED` ou `APPROVED_WITH_RESTRICTIONS`.
6. Registrar o resultado final em [`docs/MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md).

---

---

## 17. Fase 8.2 — Preenchimento Manual do Checklist

**Data:** 2026-05-27  
**Documento de resultado:** [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md)  
**Status final:** `APPROVED_WITH_RESTRICTIONS`

| Resumo | Valor |
|--------|--------|
| Itens aprovados | MT5 DEMO, EA cliente, WebRequest staging, procedimentos de device, logs estáticos sem secrets |
| Itens pendentes | VPS/Windows (maioria), operadores, `MQL5/Files`, AutoTrading formal, amostra de logs MT5 |
| Itens reprovados | Nenhum |
| Conta real | Não usada — bloqueada |
| Produção real | Bloqueada |
| Dispatch automático | Desativado |

**Conclusão:** checklist preenchido com base em evidências documentais de homologação staging/VPS e runbook. Hardening de infraestrutura Windows e operadores nomeados permanecem como restrição antes de qualquer gate de conta real.

---

*Mercado da Riqueza AutoTrade — validação operacional de hardening VPS/MT5: `APPROVED_WITH_RESTRICTIONS` (Fase 8.2). Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
