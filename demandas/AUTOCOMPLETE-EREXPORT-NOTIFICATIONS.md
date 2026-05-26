# Demanda: SQL Autocomplete + ER Export + Notifications
**Status:** ✅ Concluída
**Versão:** v1.4.0
**Data conclusão:** 2026-05-26

## Entregas

### SQL Autocomplete Inteligente
- [x] Endpoint GET /api/explorer/:connId/completions?schema=public
- [x] CompletionSource customizado no CodeMirror (tabelas + colunas)
- [x] Dot-trigger: digita "tabela." e sugere colunas daquela tabela
- [x] QueryPage busca completions ao selecionar conexão

### ER Diagram Export
- [x] Botão exportar PNG (html-to-image)
- [x] Botão exportar SVG
- [x] Filename automático: er-diagram-{conn}-{schema}.{format}

### Notification Bell
- [x] Backend emite evento WebSocket 'execution:pending'
- [x] Componente NotificationBell com badge + dropdown
- [x] Lista execuções pendentes com SQL preview + tempo
- [x] Click navega para /executions
- [x] Integrado no Header.tsx, dark/light theme
