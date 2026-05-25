# Demanda: Semana 2 - Explorer + Monitor
**Status:** ✅ Completa
**Data início:** 2026-05-25
**Data conclusão:** 2026-05-25

## Escopo
Visualização em árvore de objetos do banco e monitoramento de queries em tempo real.

## Entregas

### Backend
- [x] Explorer routes: schemas, tables, columns, indexes, views, functions, triggers, procedures
- [x] Monitor routes: queries ativas, locks, kill query, stats (size, connections, cache hit)
- [x] Adapter pattern com getAdapter() helper (decrypt + connect)

### Frontend
- [x] ExplorerPage: tree view hierárquica (schema → tabelas/views/functions/triggers)
- [x] Selector de conexão no explorer
- [x] Busca global de objetos (filtro em tempo real)
- [x] Painel de detalhes (colunas com tipo, nullable, PK, FK, default)
- [x] MonitorPage: queries ativas com auto-refresh (5s)
- [x] Cards de stats: tamanho DB, conexões ativas, total, cache hit ratio
- [x] Kill query (botão com confirmação)
- [x] Lock viewer (tabela de bloqueios)
- [x] Sidebar atualizada com Explorer e Monitor

## Commits
| Hash | Mensagem |
|------|----------|
| da98db3 | fix: TypeORM entity column types (nullable varchar + simple-array) |
| 6848d80 | docs: demandas/ + changelog no CLAUDE.md |
| 7ac18d8 | feat: Explorer de objetos + Monitor real-time |
