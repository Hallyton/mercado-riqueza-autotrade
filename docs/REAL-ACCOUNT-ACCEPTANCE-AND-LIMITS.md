# Termo Operacional de Aceite e Limites — Conta Real Ultra-Controlada

Documento da **Fase 5.2** para definir requisitos mínimos de aceite, ciência de risco, limites operacionais e responsabilidades para qualquer futura sessão ultra-controlada em conta real.

Este documento **NÃO** é contrato jurídico final.  
Este documento **NÃO** substitui revisão jurídica.  
Este documento **NÃO** libera conta real.  
Este documento **NÃO** libera produção real.  
Este documento **NÃO** libera dispatch automático.  
Este documento **NÃO** autoriza ordem com dinheiro real por si só.  
Este documento exige revisão jurídica antes de uso externo.  
Qualquer sessão real futura exigirá aprovação explícita separada.

---

## 1. Contexto

O projeto já validou:

- produção simulada;
- beta demo;
- conta demo com `DebugMode=false`;
- tracking;
- dispatch manual;
- rollback;
- idempotência;
- bloqueios por expiração e perfil.

Também permanece registrado:

- nenhuma conta real usada até agora;
- nenhuma ordem real enviada até agora;
- produção real continua bloqueada.

---

## 2. Finalidade do aceite

O aceite serve para garantir que o participante compreende:

- riscos de mercado;
- riscos tecnológicos;
- ausência de promessa de lucro;
- operação limitada;
- possibilidade de pausa;
- estratégia caixa preta;
- responsabilidades próprias.

---

## 3. Identificação mínima do participante

```text
Participante:
Documento/identificação:
E-mail:
Telefone:
Corretora:
Conta:
Servidor:
Tipo de conta:
Perfil autorizado:
Ativo autorizado:
Responsável interno:
Data de aceite:
```

---

## 4. Ciência de risco

O participante deve declarar ciência de que:

- operações no mercado financeiro envolvem risco;
- pode haver perdas financeiras;
- resultados passados não garantem resultados futuros;
- falhas técnicas podem ocorrer;
- conexão, VPS, corretora, MetaTrader e internet podem falhar;
- ordens podem ser rejeitadas, atrasadas ou executadas em preço diferente;
- a estratégia não garante lucro;
- o serviço pode ser pausado a qualquer momento por segurança.

---

## 5. Estratégia caixa preta

- O participante não terá acesso à lógica interna.
- Parâmetros, filtros, stops, alvos, horários e regras internas são propriedade do Mercado da Riqueza.
- O participante não parametriza o robô.
- O participante acompanha status, ordens, execuções e resultados.
- Alterações só podem ser feitas pelo responsável autorizado.

---

## 6. Limites operacionais obrigatórios

Todos os limites abaixo devem ser definidos antes de qualquer conta real:

```text
Capital máximo autorizado: A DEFINIR ANTES DE QUALQUER CONTA REAL
Perda máxima diária: A DEFINIR ANTES DE QUALQUER CONTA REAL
Perda máxima total da sessão: A DEFINIR ANTES DE QUALQUER CONTA REAL
Quantidade máxima por ordem: A DEFINIR ANTES DE QUALQUER CONTA REAL
Número máximo de sinais: A DEFINIR ANTES DE QUALQUER CONTA REAL
Ativo permitido: A DEFINIR ANTES DE QUALQUER CONTA REAL
Horário permitido: A DEFINIR ANTES DE QUALQUER CONTA REAL
Perfil permitido: A DEFINIR ANTES DE QUALQUER CONTA REAL
Tempo máximo de sessão: A DEFINIR ANTES DE QUALQUER CONTA REAL
Critério de encerramento: A DEFINIR ANTES DE QUALQUER CONTA REAL
Critério de pausa imediata: A DEFINIR ANTES DE QUALQUER CONTA REAL
```

---

## 7. Regras da sessão real ultra-controlada

Se futuramente aprovada, a sessão deve seguir:

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
- sem aumento de lote;
- sem mudança de ativo;
- sem operação fora do horário aprovado.

---

## 8. Responsabilidades do participante

O participante deve:

- manter a conta correta;
- não alterar configurações do EA;
- não alterar permissões do MetaTrader sem aviso;
- não operar manualmente durante a sessão sem alinhamento;
- informar qualquer posição/ordem prévia;
- informar falhas de conexão;
- aceitar pausa/cancelamento por segurança;
- não compartilhar secrets, tokens ou acessos.

---

## 9. Responsabilidades operacionais internas

O Mercado da Riqueza deve:

- validar ambiente antes da sessão;
- confirmar conta, ativo e perfil;
- acompanhar em tempo real;
- manter rollback disponível;
- registrar evidências;
- pausar em caso de inconsistência;
- preservar logs e histórico;
- não ativar dispatch automático;
- não extrapolar limites aprovados.

---

## 10. Critérios de pausa imediata

Pausar se:

- conta divergente;
- ativo divergente;
- perfil divergente;
- posição ou ordem prévia não mapeada;
- tracking inconsistente;
- EA offline;
- ordem duplicada;
- secret exposto;
- dispatch automático detectado;
- limite de perda atingido;
- falha de rollback;
- participante alterar parâmetros;
- instabilidade na corretora/MT5/VPS.

---

## 11. Autorização específica

O participante declara que autoriza, somente se houver aprovação futura específica, uma sessão ultra-controlada dentro dos limites definidos neste documento.

Esta autorização não é permanente.  
Esta autorização não vale para múltiplas sessões.  
Esta autorização não libera operação contínua.  
Cada nova sessão real exige nova aprovação ou aditivo.

---

## 12. Assinaturas

```text
Participante:
Data:
Assinatura:

Responsável Mercado da Riqueza:
Data:
Assinatura:

Revisão jurídica:
PENDENTE
```

---

## 13. Status do documento

**Status inicial:** `DRAFT_OPERATIONAL`

Status possíveis:

- `DRAFT_OPERATIONAL`
- `PENDING_LEGAL_REVIEW`
- `APPROVED_FOR_INTERNAL_USE`
- `REJECTED`

---

## 14. Próxima ação

Próxima ação recomendada:

Revisar juridicamente, definir limites numéricos e criar checklist de aprovação individual antes de qualquer conta real.

---

*Mercado da Riqueza AutoTrade — minuta operacional de aceite e limites. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
