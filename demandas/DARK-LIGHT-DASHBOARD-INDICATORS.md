# Demanda: Dark/Light Mode + Dashboard Indicadores Gráficos
**Status:** ✅ Concluída
**Versão:** v1.1.0
**Data conclusão:** 2026-05-26

## Problema
Dashboard era apenas cards estáticos sem impacto visual. Sem modo claro para uso diurno ou ambientes bem iluminados.

## Solução

### 🌗 Tema Claro/Escuro
- Toggle no Header (Sun/Moon icon)
- Persistência via localStorage (zustand persist)
- Script inline no `<html>` previne flash de tema errado
- Todos os componentes atualizados com classes `dark:` do Tailwind
- Transição suave (transition-colors)

### 📊 Indicadores Gráficos Conclusivos
- **Gauge de Saúde Geral** — RadialBarChart 0-100% com cores semafóricas (verde/amarelo/vermelho)
- **Status Badges** — VPN, Conexões, Fila limpa — ícone + label com CheckCircle/XCircle
- **Donut de Conexões** — PieChart mostrando slots ativos vs disponíveis
- **Badge de Pendências** — Círculo grande com contagem e mensagem conclusiva
- **Sparklines de Tendência** — AreaChart para queries e execuções nas últimas 12h

## Dependências Adicionadas
- `recharts` — biblioteca de gráficos React

## Arquivos Modificados/Criados
- `frontend/src/stores/theme.store.ts` (novo)
- `frontend/src/pages/DashboardPage.tsx` (reescrito)
- `frontend/src/components/layout/Header.tsx` (toggle + dark classes)
- `frontend/src/components/layout/AppLayout.tsx` (dark classes)
- `frontend/src/components/layout/Sidebar.tsx` (dark classes)
- `frontend/src/index.css` (transition layer)
- `frontend/index.html` (script anti-flash)

## Próximos Passos
- Endpoint `/api/metrics/history` no backend para dados reais nos sparklines
- Endpoint `/api/health/score` para score calculado (atualmente fallback 72%)
