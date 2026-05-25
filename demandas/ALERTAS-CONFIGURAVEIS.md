# Demanda: Alertas Configuráveis (Regras de Negócio)
**Status:** ✅ Concluída
**Data conclusão:** 2026-05-25

## Escopo
Sistema de alertas baseado em queries SQL customizadas que rodam periodicamente nos bancos monitorados e avaliam regras de negócio.

## Entregas
- [x] Entity Alert + AlertHistory (TypeORM)
- [x] Scheduler interno (timer por alerta, min 30s, timeout 10s)
- [x] Validação de SQL (só SELECT, rejeita DML)
- [x] API CRUD completa (create, read, update, delete, test, validate-query)
- [x] Tipos de avaliação: has_rows, no_rows, threshold, scalar_value, row_count
- [x] Operadores: >, <, =, !=, >=, <=
- [x] WebSocket push em tempo real ao disparar
- [x] Frontend: AlertsPage com lista + semáforo + cards de resumo
- [x] Frontend: Wizard 3 passos (conexão → query → condição)
- [x] Frontend: Histórico expandível por alerta (timeline)
- [x] Frontend: Badge no Header com contagem de alertas ativos
- [x] Frontend: Botão testar query antes de salvar
- [x] Sidebar: link "Alertas" com ícone Bell

## Rotas de API
- `GET /api/alerts` — listar todos
- `GET /api/alerts/summary` — contagem para badge
- `GET /api/alerts/:id` — detalhe + histórico
- `POST /api/alerts` — criar
- `PUT /api/alerts/:id` — atualizar
- `DELETE /api/alerts/:id` — excluir
- `POST /api/alerts/:id/test` — executar manualmente
- `POST /api/alerts/validate-query` — validar SQL
