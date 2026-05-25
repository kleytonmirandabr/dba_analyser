# Demanda: Semana 2 - Explorer de Objetos
**Status:** 🔜 Próxima
**Data início:** -
**Previsão:** Semana 2

## Escopo
Visualização em árvore de todos os objetos do banco (schemas, tabelas, colunas, indexes, views, functions, triggers).

## Entregas planejadas
- [ ] Tree view hierárquica (schema → table → columns/indexes)
- [ ] Painel de detalhes ao clicar no objeto
- [ ] DDL viewer (CREATE TABLE statement)
- [ ] Busca global de objetos
- [ ] Suporte MSSQL adapter
- [ ] Suporte MySQL adapter

---

# Demanda: Semana 3 - Comparador + Monitor
**Status:** 🔜 Backlog
**Previsão:** Semana 3

## Escopo
Comparar estruturas entre bancos e monitorar queries ativas em tempo real.

## Entregas planejadas
- [ ] Diff visual entre dois bancos (schema diff)
- [ ] Gerar script de migração
- [ ] Monitor de queries ativas (real-time via WebSocket)
- [ ] Kill query
- [ ] Lock viewer
- [ ] Alertas de performance

---

# Demanda: Semana 4 - Execução + Audit + Polish
**Status:** 🔜 Backlog
**Previsão:** Semana 4

## Escopo
Workflow de execução de SQL com aprovação, audit trail completo, e polimento geral.

## Entregas planejadas
- [ ] SQL Editor com syntax highlight
- [ ] Workflow: submeter → aprovar → executar
- [ ] Rollback SQL associado
- [ ] Audit log viewer (filtros por user, connection, action)
- [ ] Export audit para CSV
- [ ] Dashboard com métricas reais
