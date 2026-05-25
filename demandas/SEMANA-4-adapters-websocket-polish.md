# Demanda: Semana 4 - Adapters + WebSocket + Polish
**Status:** ✅ Completa
**Data início:** 2026-05-25
**Data conclusão:** 2026-05-25

## Escopo
Suporte multi-banco (MSSQL + MySQL), monitoramento real-time via WebSocket, e polish geral.

## Entregas

### Adapters Multi-Banco
- [x] mssql.adapter.ts: SQL Server via tedious (explorer, monitor, execute, kill)
- [x] mysql.adapter.ts: MySQL via mysql2 (explorer, monitor, execute, kill)
- [x] adapter.factory.ts: factory pattern `createAdapter(dbType)`
- [x] Refactor de TODAS as routes para usar factory (zero hardcode PG)

### WebSocket Real-Time
- [x] services/monitor.ws.ts: Socket.io rooms por conexão
- [x] Poll automático 5s para rooms com clients conectados
- [x] hooks/useSocket.ts: useSocket + useMonitorSocket
- [x] Frontend: socket.io-client integrado

### Polish
- [x] SettingsPage: perfil do usuário + alterar senha
- [x] POST /api/auth/change-password com validação
- [x] Sidebar: 9 itens navegáveis
- [x] Version bump v0.4.0

## Commits
| Hash | Mensagem |
|------|----------|
| ca9609a | feat: MSSQL/MySQL adapters + WebSocket monitor + Settings + Polish |
