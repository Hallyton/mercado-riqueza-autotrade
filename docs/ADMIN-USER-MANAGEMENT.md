# Admin — Gestão de usuários e códigos de ativação

**Status:** `ADMIN_USER_AND_ACTIVATION_MANAGEMENT_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

---

## Objetivo

Permitir que administradores cadastrem e gerenciem usuários, controlem acesso (bloqueio/inativação), resetem senhas, acessem licenças/devices e gerem códigos de ativação do EA de forma segura — **sem** expor tokens, hashes ou senhas.

---

## Rotas do painel

| Rota | Uso |
|------|-----|
| `/admin/users` | Listagem de usuários |
| `/admin/users/new` | Cadastro |
| `/admin/users/[userId]` | Detalhe, licenças, ações |
| `/admin/clientes` | Visão comercial + links |
| `/admin/licenses/[licenseId]` | Devices + código de ativação |

---

## Cadastrar usuário

1. **Clientes** → **Novo usuário** ou **Usuários** → **Novo usuário**
2. Preencher nome, e-mail, perfil (`CLIENT` ou papel admin)
3. Opcional: gerar senha temporária (exibida **uma vez**)
4. Opcional: criar assinatura + licença com plano

---

## Bloquear / inativar / reativar

Na tela do usuário (`/admin/users/[userId]`):

| Ação | Confirmação |
|------|-------------|
| Bloquear | `BLOQUEAR USUARIO` |
| Inativar | `INATIVAR USUARIO` |
| Reativar | `REATIVAR USUARIO` |

- **BLOCKED** e **INACTIVE** não autenticam no login
- Bloqueio também suspende licenças (fluxo comercial existente)
- Não é possível bloquear/inativar o próprio usuário logado
- **Sem delete físico** — apenas status

---

## Resetar senha

Confirmação: `RESETAR SENHA`

- Gera senha temporária (exibida uma vez)
- `mustChangePassword` ativado por padrão
- bcrypt cost **12**
- Nada de senha/hash em logs ou API de listagem

---

## Licenças e devices

1. Abrir usuário → lista de licenças
2. **Gerenciar licença / devices** → `/admin/licenses/[licenseId]`
3. Revogar device DEMO antigo se necessário
4. **Gerar novo código de ativação** (ver abaixo)

---

## Código de ativação (EA)

Na licença, seção **Gerar novo código de ativação**:

1. Digite exatamente: `GERAR CODIGO DE ATIVACAO`
2. **Gerar código**
3. Copie o código (botão **Copiar código**)
4. **Concluir** — o código some e não volta

Ver também: [`EA-DEVICE-ACTIVATION-AND-REVOCATION.md`](EA-DEVICE-ACTIVATION-AND-REVOCATION.md).

---

## Auditoria

Toda ação cria `AdminAction` + `AuditLog` (metadados redigidos — sem senha, token ou código).

---

## Cuidados

- Não compartilhar código de ativação ou senha temporária em canais inseguros
- Não aumentar `maxDevices` para contornar limite — revogar device antigo
- Nenhuma ordem real ou dispatch automático neste fluxo

---

*Mercado da Riqueza AutoTrade — modelo caixa preta.*
