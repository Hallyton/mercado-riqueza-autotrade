# Resultado da Auditoria — Ambiente, VPS, MT5 e Hardening Operacional

**Data:** 2026-05-26  
**Fase:** 7.9 — Auditoria de Ambiente, VPS, MT5 e Hardening Operacional  
**Status:** `APPROVED_WITH_RESTRICTIONS`

---

## 1. Contexto

A Fase 7.8 auditou estaticamente o EA cliente `MR_AutoTrade_Executor` e o EA Mãe `MR_AutoTrade_Master_Signal`.

O EA cliente usa um `device_token` local após ativação. Esse token é necessário para autenticar o terminal MetaTrader 5 nas APIs do AutoTrade, mas cria uma dependência operacional: o ambiente Windows/VPS onde o MT5 roda precisa ser tratado como superfície sensível.

Este documento define os requisitos mínimos de segurança para esse ambiente operacional.

Conta real continua bloqueada. Produção real continua bloqueada. Dispatch automático continua desativado.

---

## 2. Escopo

Esta auditoria/checklist cobre:

- Windows/VPS.
- MetaTrader 5.
- Pasta `MQL5/Files`.
- Logs do MT5.
- WebRequest.
- AutoTrading.
- Credenciais da conta MT5.
- Acesso remoto.
- Firewall.
- Atualizações.
- Backup.
- Operadores autorizados.
- Rollback operacional.

---

## 3. Fora de Escopo

Não faz parte desta fase:

- Conta real.
- Ordem real.
- Produção real.
- Alteração de EA.
- Alteração de backend.
- Alteração de envs.
- Dispatch automático.
- Deploy.
- Migration/schema.

---

## 4. Checklist de VPS/Windows

Requisitos mínimos:

- [ ] Usuário Windows dedicado exclusivamente à operação AutoTrade.
- [ ] Senha forte, única e armazenada em cofre aprovado.
- [ ] RDP protegido, com acesso restrito por IP/VPN quando possível.
- [ ] 2FA/VPN habilitado se o provedor permitir.
- [ ] Firewall ativo.
- [ ] Windows atualizado.
- [ ] Microsoft Defender/antivírus ativo.
- [ ] Sem acesso compartilhado ou genérico.
- [ ] Sem uso pessoal da VPS.
- [ ] Backup controlado e documentado.
- [ ] Lista de pessoas com acesso mantida atualizada.
- [ ] Logs de acesso/RDP preservados quando disponíveis.

Critério operacional: qualquer acesso novo à VPS deve ser autorizado e registrado.

---

## 5. Checklist MT5

Requisitos mínimos:

- [ ] Conta MT5 correta validada antes da sessão.
- [ ] Servidor MT5 correto validado antes da sessão.
- [ ] Ambiente `DEMO` / `REAL` claramente identificado.
- [ ] Senha da conta MT5 protegida e não compartilhada em chat/prints.
- [ ] AutoTrading sob controle operacional.
- [ ] WebRequest limitado somente ao domínio autorizado do ambiente.
- [ ] Sem URLs desnecessárias na lista de WebRequest.
- [ ] EA anexado apenas ao gráfico esperado.
- [ ] Símbolo correto confirmado.
- [ ] Magic number do EA conhecido quando aplicável.
- [ ] Sem ordens pendentes desconhecidas antes da sessão.
- [ ] Sem posições desconhecidas antes da sessão.
- [ ] Logs do MT5 visíveis para auditoria.

Critério operacional: antes de qualquer sessão controlada, confirmar conta, servidor, símbolo, AutoTrading, WebRequest e ausência de pendências desconhecidas.

---

## 6. Checklist MQL5/Files e Tokens Locais

O EA cliente pode armazenar `device_token` localmente para autenticação operacional.

Requisitos mínimos:

- [ ] `device_token` local protegido pelo usuário Windows dedicado.
- [ ] Pasta `MQL5/Files` com acesso restrito ao usuário operacional.
- [ ] Não compartilhar prints/logs que contenham token.
- [ ] Não subir arquivos locais do MT5 para Git.
- [ ] Não enviar token por WhatsApp, e-mail ou chat.
- [ ] Procedimento de revogação do device definido.
- [ ] Procedimento de reativação com novo activation code definido.
- [ ] Limpeza de tokens antigos documentada.
- [ ] Remoção de credenciais locais em caso de comprometimento.

Critério operacional: se houver suspeita de vazamento do `device_token`, revogar o device imediatamente e reativar apenas após limpeza do ambiente.

---

## 7. Checklist de Logs

Requisitos mínimos:

- [ ] Logs não exibem activation code bruto.
- [ ] Logs não exibem `device_token`.
- [ ] Logs não exibem `InpMasterSecret`.
- [ ] Logs não exibem `Authorization: Bearer <valor>`.
- [ ] Logs são suficientes para auditoria operacional.
- [ ] Logs podem ser coletados sem secrets.
- [ ] Prints de logs devem ser revisados antes de compartilhamento.

Critério operacional: qualquer log com secret/token deve ser tratado como incidente de segurança.

---

## 8. Checklist de AutoTrading e WebRequest

Requisitos mínimos:

- [ ] AutoTrading desligado por padrão fora de sessão autorizada.
- [ ] AutoTrading ligado apenas durante sessão formalmente autorizada.
- [ ] WebRequest limitado apenas ao domínio autorizado.
- [ ] Alterações de AutoTrading registradas quando fizerem parte de sessão controlada.
- [ ] Alterações de WebRequest registradas.
- [ ] Rollback conhecido: desligar AutoTrading e remover EA do gráfico.

Critério operacional: `DebugMode=false` só pode ser usado em conta DEMO com gate aprovado. Conta real segue bloqueada.

---

## 9. Operadores Autorizados

| Papel | Responsável |
|-------|-------------|
| Operador principal | A DEFINIR — BLOQUEIA CONTA REAL |
| Operador reserva | A DEFINIR — BLOQUEIA CONTA REAL |
| Quem pode acessar VPS | A DEFINIR — BLOQUEIA CONTA REAL |
| Quem pode alterar EA | A DEFINIR — BLOQUEIA CONTA REAL |
| Quem pode habilitar AutoTrading | A DEFINIR — BLOQUEIA CONTA REAL |
| Quem pode disparar admin | A DEFINIR — BLOQUEIA CONTA REAL |
| Quem pode executar rollback | A DEFINIR — BLOQUEIA CONTA REAL |

Sem operadores definidos, qualquer avaliação com conta real permanece bloqueada.

---

## 10. Procedimento de Rollback Ambiente

Procedimento mínimo:

1. Remover EA do gráfico.
2. Desativar AutoTrading.
3. Fechar MT5 se necessário.
4. Cancelar ordens pendentes demo/real conforme autorização formal.
5. Revogar device no backend/admin quando aplicável.
6. Rotacionar token/secret se houver suspeita de exposição.
7. Bloquear acesso RDP se o ambiente estiver comprometido.
8. Registrar incidente com horário, operador, motivo e evidências redigidas.
9. Preservar logs necessários para auditoria.

Em caso de dúvida, parar a operação e preservar histórico.

---

## 11. Critérios de Aprovação

O ambiente só pode ser aprovado se:

- [ ] Ambiente dedicado.
- [ ] Acesso controlado.
- [ ] Tokens protegidos.
- [ ] Logs sem secrets.
- [ ] WebRequest restrito.
- [ ] AutoTrading controlado.
- [ ] Rollback conhecido.
- [ ] Operadores definidos.
- [ ] Nenhum dado sensível exposto.

---

## 12. Critérios de Reprovação

O ambiente deve ser reprovado se houver:

- VPS compartilhada sem controle.
- RDP sem proteção.
- Token em print/log.
- WebRequest amplo sem necessidade.
- AutoTrading sempre ligado.
- Múltiplos operadores sem controle.
- Logs com secrets.
- Conta real aberta sem gate.
- Falta de rollback.

---

## 13. Status

**Status inicial:** `APPROVED_WITH_RESTRICTIONS`

Motivo:

- A auditoria define os requisitos mínimos do ambiente operacional.
- Não foi encontrado bloqueio técnico novo no código.
- A aprovação depende de validação manual do ambiente real/VPS/MT5 antes de qualquer conta real.
- Operadores autorizados ainda estão `A DEFINIR`, o que bloqueia qualquer avanço real.

---

## 14. Pendências

Pendências operacionais:

- Definir operador principal.
- Definir operador reserva.
- Definir política de acesso à VPS.
- Validar permissões da pasta `MQL5/Files`.
- Formalizar revogação de device.
- Validar logs reais do MT5.
- Definir política de AutoTrading.
- Revisar WebRequest na VPS real.
- Revisar ambiente antes de qualquer discussão de conta real.

---

## 15. Decisão Final

**Status:** `APPROVED_WITH_RESTRICTIONS`

Esta auditoria aprova o checklist de hardening como requisito operacional para staging/demo e para qualquer avaliação futura. Ela não aprova conta real.

Esta decisão:

- Não libera conta real.
- Não libera produção real.
- Não libera dinheiro real.
- Não ativa dispatch automático.
- Não altera envs.
- Não altera EA cliente ou EA Mãe.
- Não substitui validação manual da VPS/MT5.

---

*Mercado da Riqueza AutoTrade — auditoria de ambiente, VPS, MT5 e hardening operacional aprovada com restrições. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
