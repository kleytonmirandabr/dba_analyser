# Sprint: perfilusuario
**Data início:** 2026-05-27 04:26 UTC  
**Branch:** `feature/perfilusuario`  
**Status:** 🟡 Em andamento

---

## Objetivo
Implementar sistema completo de permissões com: Clientes, Funcionalidades (auto-registradas), Perfis, Usuários multi-tenant, Soft Delete global e Audit Trail completo.

---

## Escopo

### 1. Base Entity (audit + soft delete)
- [ ] Criar `BaseAuditEntity` com: createdAt, createdById, updatedAt, updatedById, deletedAt, deletedById, isDeleted
- [ ] TypeORM Subscriber para preencher automaticamente audit fields
- [ ] Global scope `WHERE isDeleted = false` em todas as queries

### 2. Entidade: clients
- [ ] Campos: name, code (unique), timezone (obrigatório), language (obrigatório), country, dateFormat, timeFormat, logo, primaryContact, contactEmail, contractStart, contractEnd, maxUsers, maxConnections, notes, isActive
- [ ] CRUD API: GET, POST, PUT, SOFT DELETE
- [ ] Tela de gestão (Configurações → Clientes)

### 3. Entidade: features (imutável)
- [ ] Campos: code (unique), name, description, module, moduleOrder, featureOrder, registeredAt
- [ ] Registro automático no boot (UPSERT por code)
- [ ] Lista completa de ~30 features por módulo
- [ ] Tela somente leitura com descrição e agrupamento

### 4. Entidade: profiles
- [ ] Campos: name, description, clientId (nullable = global), isDefault + audit base
- [ ] Tabela pivot `profile_features` (profileId, featureCode, grantedAt, grantedById)
- [ ] CRUD API
- [ ] Tela com seleção agrupada por módulo (checkbox grupo + individual + indeterminate)

### 5. Entidade: users (atualizado)
- [ ] Novos campos: clientId, profileId, preferredLanguage, preferredTimezone, avatar, lastLoginAt, phone
- [ ] Remover campo `role` (substituído por profileId)
- [ ] Migration de dados existentes (admin → perfil Administrador)
- [ ] CRUD API atualizado
- [ ] Tela de gestão atualizada

### 6. Middleware: requireFeature()
- [ ] Substituir `requireRole()` por `requireFeature(code)`
- [ ] JWT payload: userId, clientId, profileId, features[], timezone, language
- [ ] Atualizar todas as rotas existentes

### 7. Audit Logs
- [ ] Tabela `audit_logs`: tableName, recordId, action, userId, userName, clientId, changes (JSON diff), metadata (IP, userAgent), timestamp
- [ ] TypeORM Subscriber grava diff automático em UPDATE
- [ ] Tela de visualização (Configurações → Audit Log)

### 8. User Activity Logs
- [ ] Tabela: userId, action (login/logout/failed/locked/etc), ip, userAgent, details, timestamp
- [ ] Integrar no auth routes (login, logout, password change)

### 9. Frontend: timezone/language
- [ ] Componente utilitário `formatDate(utc, timezone, format)`
- [ ] i18n: idioma do cliente como default, override por usuário
- [ ] Seletor de timezone (lista IANA)
- [ ] Seletor de idioma (pt-BR, en-US, es-ES)

### 10. Seed
- [ ] Client padrão: "Sistema" (timezone America/Sao_Paulo, pt-BR)
- [ ] Perfis: Administrador (tudo), DBA (tudo - admin), Operador (view + execute), Viewer (somente view)
- [ ] Usuário admin migrado para client Sistema + perfil Administrador
- [ ] Features registradas

---

## Regras de Negócio
1. **Soft delete em tudo** — nunca DELETE FROM
2. **Audit automático** — subscriber preenche createdById, updatedById, grava diff
3. **Features imutáveis** — sistema registra, humano não edita
4. **Perfil agrupa features** — seleção por módulo com "selecionar todos"
5. **Multi-tenant** — clientId filtra dados em todas as queries
6. **Timezone/Language obrigatório** no cliente
7. **Banco sempre UTC** — conversão no frontend usando config do cliente

---

## Itens adicionais recomendados
- [ ] Rate limiting por cliente (evitar abuso)
- [ ] Expiração de sessão configurável por cliente
- [ ] Política de senha configurável por cliente (min chars, complexidade, expiração)
- [ ] Notificação quando usuário é bloqueado (tentativas de login)
- [ ] Tela "Minha Conta" para usuário alterar senha, idioma, timezone pessoal
- [ ] Webhook/integração quando perfil é alterado (audit notify)

---

## Estimativa
| Fase | Esforço |
|------|---------|
| Entidades + Migrations | 2h |
| Subscriber audit | 1h |
| Feature registration boot | 30min |
| Middleware requireFeature | 1h |
| APIs (CRUD clients, profiles, users) | 3h |
| Telas frontend (3 telas) | 4h |
| Integração timezone/language | 1h |
| Seed + migration dados existentes | 1h |
| Testes e ajustes | 2h |
| **Total estimado** | **~15h** |

---

## Notas
- Iniciar pela base (entidades + subscriber) para não quebrar o que já funciona
- Migration gradual: manter `role` temporariamente até perfis estarem funcionando
- Feature flags: se feature não está no perfil, botão/menu fica invisível no frontend
