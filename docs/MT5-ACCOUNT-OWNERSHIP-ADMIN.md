# Liberação e transferência administrativa de conta MT5

Status: **MT5_ACCOUNT_OWNERSHIP_RELEASE_AND_TRANSFER_IMPLEMENTED**

## Problema

A tabela `mt5_accounts` possui unique `(login, server)` e `userId`. Quando um usuário é **inativado/cancelado**, o registro MT5 **permanece** no banco por design (histórico operacional). Um novo cliente que tenta vincular a mesma conta recebe:

> Esta conta MT5 pertence a outro usuário.

Isso **não é bug** — é trava de segurança contra roubo acidental de conta ativa.

## Fluxo admin

1. Admin tenta vincular conta na licença (`/admin/licenses/[licenseId]`).
2. Se houver conflito, a UI mostra card **Conflito de propriedade MT5** com diagnóstico.
3. Admin clica **Analisar liberação da conta MT5** ou usa trace direto.
4. Se seguro, **Liberar conta órfã** ou **Transferir para esta licença**.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/mt5-accounts/ownership/trace` | Diagnóstico de dono, risco e ação recomendada |
| POST | `/api/admin/mt5-accounts/ownership/release` | Libera conta órfã (remove vínculo + delete registro MT5) |
| POST | `/api/admin/mt5-accounts/ownership/transfer` | Transfere conta de licença antiga para nova |

Permissões:

- **Trace:** qualquer admin padrão (`requireAdminApiSession`)
- **Release/Transfer:** `SUPERADMIN` ou `OPS` apenas

## Confirmações obrigatórias

- Release: `LIBERAR CONTA MT5 ORFA`
- Transfer: `TRANSFERIR CONTA MT5 PARA ESTA LICENCA`

Nota admin obrigatória em ambos.

## Travas de segurança (bloqueiam release/transfer)

- Usuário **ACTIVE** + assinatura **ACTIVE** + licença **ACTIVE/PENDING**
- Device com **atividade EA recente** (≤ 300s)
- Snapshot com **posição aberta**
- Snapshot com **ordens pendentes**
- **Comando operacional** PENDING/ACKED
- **Aprovação REAL** ativa (`APPROVED`)

## O que a liberação faz

- Desvincula `mt5AccountId` das licenças antigas
- Limpa `expectedAccountLogin/Server` quando aplicável
- Revoga devices ativos e invalida activation codes pendentes
- Suspende robot instances operacionais
- **Remove** registro `Mt5Account` (login/server ficam livres)
- **Preserva** histórico: snapshots, heartbeats, audit logs, approvals

## O que a transferência faz

- Mesmo desvinculo da origem
- Atualiza `Mt5Account.userId` para o novo usuário
- Vincula na licença destino com symbol/magic/environment
- **Não** cria approval REAL nem strategy-config automaticamente

## AuditLog / AdminAction

- `mt5_account.ownership.trace`
- `mt5_account.ownership.released`
- `mt5_account.ownership.transfered`
- `mt5_account.ownership.release_failed`
- `mt5_account.ownership.transfer_failed`

Metadata redigida: login mascarado, IDs, reasonCode, riskFlags, adminNote.

## Reason codes

`MT5_ACCOUNT_AVAILABLE`, `MT5_ACCOUNT_OWNED_BY_ACTIVE_USER`, `MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE`, `MT5_ACCOUNT_HELD_BY_CANCELLED_LICENSE`, `MT5_ACCOUNT_HELD_BY_DELETED_USER`, `MT5_ACCOUNT_HAS_RECENT_EA_ACTIVITY`, `MT5_ACCOUNT_HAS_OPEN_POSITION_SNAPSHOT`, `MT5_ACCOUNT_HAS_PENDING_ORDERS`, `MT5_ACCOUNT_HAS_PENDING_COMMANDS`, `MT5_ACCOUNT_HAS_ACTIVE_REAL_APPROVAL`, `MT5_ACCOUNT_UNKNOWN_CONFLICT`.

## Regras de produto

- Delete/inativação de usuário **não apaga** histórico operacional.
- Conta MT5 pode continuar presa até admin diagnosticar e liberar/transferir.
- **Nunca** apagar direto no banco sem audit.
- **Nenhuma ordem real** é enviada neste fluxo.
