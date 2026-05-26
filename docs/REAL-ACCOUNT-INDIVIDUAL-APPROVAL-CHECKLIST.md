# Checklist Individual de Aprovação — Conta Real Ultra-Controlada

Documento da **Fase 5.3** para registrar o checklist individual mínimo antes de qualquer revisão de risco para uma possível sessão ultra-controlada em conta real.

Este checklist **NÃO** libera conta real.  
Este checklist **NÃO** libera produção real.  
Este checklist **NÃO** libera dispatch automático.  
Este checklist **NÃO** autoriza ordem com dinheiro real por si só.  
Mesmo `APPROVED_FOR_RISK_COMMITTEE_REVIEW` não libera operação real; apenas permite revisão final de risco.

---

## 1. Identificação do participante

```text
Participante:
Documento/identificação:
E-mail:
Telefone:
Responsável interno:
Data da análise:
Origem da solicitação:
```

---

## 2. Identificação da conta

```text
Corretora:
Servidor:
Conta:
Tipo de conta:
Titularidade confirmada:
Moeda:
Ambiente:
```

Critérios mínimos:

- [ ] Conta real claramente identificada.
- [ ] Corretora/servidor identificados.
- [ ] Titularidade/responsável operacional confirmado.
- [ ] Nenhuma conta demo confundida com conta real.
- [ ] Nenhuma conta real autorizada antes de decisão final separada.

---

## 3. Escopo operacional pretendido

```text
Ativo pretendido:
Perfil pretendido:
Tipo de operação:
Quantidade de sinais pretendida:
Horário pretendido:
Modo do EA:
Dispatch:
Responsável pelo acompanhamento:
Critério de encerramento pretendido:
```

Escopo máximo permitido para revisão:

- 1 participante;
- 1 conta real;
- 1 ativo;
- 1 perfil conservador;
- 1 sinal;
- dispatch manual;
- monitoramento ao vivo;
- sem retry após execução;
- sem dispatch automático;
- sem múltiplos clientes;
- sem operação fora do horário aprovado.

---

## 4. Limites financeiros obrigatórios

Todos os limites abaixo bloqueiam conta real até definição formal:

```text
Capital máximo autorizado: A DEFINIR — BLOQUEIA CONTA REAL
Perda máxima diária: A DEFINIR — BLOQUEIA CONTA REAL
Perda máxima total da sessão: A DEFINIR — BLOQUEIA CONTA REAL
Quantidade máxima por ordem: A DEFINIR — BLOQUEIA CONTA REAL
Número máximo de sinais: A DEFINIR — BLOQUEIA CONTA REAL
Ativo permitido: A DEFINIR — BLOQUEIA CONTA REAL
Horário permitido: A DEFINIR — BLOQUEIA CONTA REAL
Perfil permitido: A DEFINIR — BLOQUEIA CONTA REAL
Tempo máximo de sessão: A DEFINIR — BLOQUEIA CONTA REAL
Critério de encerramento: A DEFINIR — BLOQUEIA CONTA REAL
Critério de pausa imediata: A DEFINIR — BLOQUEIA CONTA REAL
```

Enquanto qualquer limite permanecer `A DEFINIR — BLOQUEIA CONTA REAL`, nenhuma sessão real pode ser aprovada.

---

## 5. Aceite e ciência de risco

- [ ] Participante recebeu minuta operacional de aceite e limites.
- [ ] Participante entende risco de mercado.
- [ ] Participante entende risco tecnológico.
- [ ] Participante entende que não há promessa de lucro.
- [ ] Participante entende o modelo de estratégia caixa preta.
- [ ] Participante entende que a sessão pode ser pausada/cancelada.
- [ ] Participante aceita não alterar configurações do EA sem autorização.
- [ ] Participante aceita não operar manualmente sem alinhamento durante a sessão.
- [ ] Participante aceita limites financeiros e operacionais formais.
- [ ] Revisão jurídica concluída, se aplicável.

---

## 6. Pré-check técnico

- [ ] EA testado em demo.
- [ ] WebRequest validado.
- [ ] Logs visíveis.
- [ ] Painel admin acessível.
- [ ] Tracking funcionando.
- [ ] Device/token/licença identificados.
- [ ] Rollback testado.
- [ ] Nenhuma ordem pendente desconhecida.
- [ ] Nenhuma posição aberta desconhecida.
- [ ] Responsável acompanhando ao vivo definido.
- [ ] Dispatch automático desativado.
- [ ] Secrets protegidos.

---

## 7. Bloqueadores imediatos

Bloqueiam a evolução do checklist:

- conta real não identificada;
- ausência de aceite formal;
- revisão jurídica pendente quando exigida;
- limite financeiro indefinido;
- divergência de ativo;
- divergência de perfil;
- ordem pendente desconhecida;
- posição aberta desconhecida;
- dispatch automático ativo;
- tracking inconsistente;
- secret exposto;
- EA sem logs;
- rollback não testado;
- ausência de responsável ao vivo;
- tentativa de operar mais de 1 sinal;
- tentativa de operar múltiplos clientes.

---

## 8. Decisão individual

**Status inicial:** `DRAFT_CHECKLIST`

Status possíveis:

- `DRAFT_CHECKLIST`
- `PENDING_INFORMATION`
- `PENDING_LEGAL_REVIEW`
- `APPROVED_FOR_RISK_COMMITTEE_REVIEW`
- `REJECTED`

Mesmo `APPROVED_FOR_RISK_COMMITTEE_REVIEW` não libera operação real. Apenas permite revisão final de risco.

```text
Decisão:
Justificativa:
Responsável pela decisão:
Data:
Observações:
```

---

## 9. Próxima ação recomendada

Completar informações do participante, conta, aceite, limites financeiros e pré-check técnico. Depois, encaminhar para revisão jurídica/operacional e, se elegível, para comitê de risco.

Nenhuma conta real pode ser usada antes de aprovação futura específica, separada e documentada.

---

*Mercado da Riqueza AutoTrade — checklist individual de aprovação para conta real ultra-controlada. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
