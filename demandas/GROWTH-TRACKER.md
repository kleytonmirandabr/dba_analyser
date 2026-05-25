# Demanda: Growth Tracker (Monitoramento de Crescimento)
**Status:** ✅ Concluída
**Data conclusão:** 2026-05-25

## Problema
Deploy com bug gera linhas infinitas em tabela (ex: 400/dia virou 4.000/dia). Sem baseline comparativo, ninguém percebe até disco lotar ou queries ficarem lentas.

## Solução
Cron diário que coleta snapshots de todas as tabelas monitoradas e compara com histórico (média 7 dias) para detectar anomalias automaticamente.

## Entregas
- [x] Entity TableSnapshot (snapshot diário por tabela)
- [x] Entity TableGrowthRule (regras customizáveis por tabela)
- [x] Growth Scheduler (cron midnight UTC + manual trigger)
- [x] Detecção de anomalias: spike (>3x), stopped, data_loss
- [x] Baseline automático (média últimos 7 dias)
- [x] API completa (growth data, anomalies, rules CRUD, manual snapshot)
- [x] Frontend GrowthPage com tabela + sparklines + anomalias banner
- [x] Modal de regras por tabela (thresholds customizáveis)
- [x] Botão "Snapshot Agora" para coleta imediata
- [x] WebSocket push quando anomalias são detectadas
- [x] Sidebar link "Crescimento" com ícone TrendingUp

## Rotas de API
- `GET /api/growth/:connectionId` — dados de crescimento (7 dias)
- `GET /api/growth/:connectionId/anomalies` — anomalias atuais
- `POST /api/growth/snapshot` — forçar snapshot manual
- `GET /api/growth/:connectionId/rules` — listar regras
- `POST /api/growth/:connectionId/rules` — criar/atualizar regra
- `DELETE /api/growth/rules/:id` — excluir regra

## Tipos de Anomalia
| Tipo | Condição | Severidade |
|------|----------|-----------|
| spike | Cresceu > 3x média (ou custom %) | warning/critical |
| stopped | Crescimento = 0 (média > 10/dia) | warning |
| data_loss | Encolheu > 10% (ou custom %) | critical |

## Impacto em Produção
Zero — usa n_live_tup do pg_stat_user_tables (metadado em memória) e sys.partitions.rows (MSSQL).
