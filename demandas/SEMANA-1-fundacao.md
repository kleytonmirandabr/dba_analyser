# Demanda: Semana 1 - Fundação + Infra + Auth + Conexões
**Status:** ✅ Completa
**Data início:** 2026-05-25
**Data conclusão:** 2026-05-25

## Escopo
Setup completo do monorepo com backend, frontend, Docker, autenticação e CRUD de conexões.

## Entregas

### Backend
- [x] Express + TypeScript + Socket.io bootstrap
- [x] TypeORM com 4 entities (User, Connection, ExecutionRequest, AuditLog)
- [x] Auth JWT (login, /me, roles admin/dba/viewer)
- [x] AES-256-GCM encryption para credenciais de banco
- [x] CRUD de conexões (POST, GET, DELETE, TEST)
- [x] PostgreSQL adapter completo (explorer, monitor, execute)
- [x] VPN service (upload .ovpn, status, remove config)
- [x] Permission middleware (requireRole)
- [x] Audit middleware (log automático)
- [x] Seed de admin padrão

### Frontend
- [x] React 18 + Vite + TypeScript + Tailwind CSS (dark mode)
- [x] Auth store (Zustand) com login/logout/loadUser
- [x] Login page funcional com validação
- [x] Conexões page (listagem + criação + teste + deleção)
- [x] VPN Setup Wizard (3 steps: upload → credenciais → confirmação)
- [x] Header com VPN status real-time (poll 30s)
- [x] Layout com Sidebar navegável
- [x] Protected routes (redirect para login)

### Infra
- [x] docker-compose.yml (4 services: vpn, backend, frontend, postgres)
- [x] docker-compose.prod.yml (com nginx)
- [x] Dockerfiles dev + prod (backend e frontend)
- [x] Nginx config com proxy API + WebSocket

## Commits
| Hash | Mensagem |
|------|----------|
| 1d8b70c | feat: setup monorepo completo - backend + frontend + Dockerfiles |
| 42e63b0 | feat: TypeORM entities + Auth JWT + Middlewares + Seed |
| bbe02eb | feat: Connection CRUD + AES-256 encryption + PostgreSQL adapter + VPN service |
| a5db2d1 | feat: Frontend funcional - Login, CRUD Conexões, VPN Wizard |
