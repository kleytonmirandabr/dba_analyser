# Demanda: Health Monitor & Database Discovery
**Status:** ✅ Concluída
**Data conclusão:** 2026-05-25

## Escopo
Monitoramento avançado de saúde dos bancos de dados + descoberta automática de databases no servidor.

## Entregas
- [x] Botão de editar conexão (Pencil icon)
- [x] Campo Database agora opcional (conexão = servidor)
- [x] Descoberta de databases (lupa → lista todos DBs → seleciona quais monitorar)
- [x] Sub-conexões automáticas por database selecionado
- [x] Health Monitor - Tab Visão Geral (cards: tabelas, tamanho, cache hit, conexões, bloat, índices)
- [x] Health Monitor - Tab Tabelas (bloat %, dead tuples, last vacuum, seq/idx scans)
- [x] Health Monitor - Tab Queries Lentas (pg_stat_statements / sys.dm_exec_query_stats)
- [x] Health Monitor - Tab Índices (não usados + sugestões de missing indexes)
- [x] Health Monitor - Tab Configurações (parâmetros críticos com descrição)
- [x] Suporte PostgreSQL completo (pg_stat_*, pg_settings)
- [x] Suporte SQL Server completo (DMVs: dm_exec_query_stats, dm_db_index_usage_stats, dm_db_missing_index_details)
- [x] Zero impacto em produção (read-only, views de sistema, timeout 30s)

## Rotas de API
- `POST /api/connections/:id/databases` — descobrir databases
- `POST /api/connections/:id/select-databases` — selecionar para monitorar
- `GET /api/connections/:id/health/overview` — resumo geral
- `GET /api/connections/:id/health/tables` — saúde das tabelas
- `GET /api/connections/:id/health/slow-queries` — queries lentas
- `GET /api/connections/:id/health/indexes` — índices (unused + missing)
- `GET /api/connections/:id/health/config` — configurações do banco
- `GET /api/connections/:id/health/long-transactions` — transações longas
