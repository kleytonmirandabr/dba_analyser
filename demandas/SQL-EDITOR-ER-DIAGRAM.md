# Demanda: SQL Editor com Syntax Highlight + ER Diagram
**Status:** ✅ Concluída
**Versão:** v1.3.0
**Data conclusão:** 2026-05-26

## Objetivo
Melhorar a experiência de edição SQL com syntax highlighting profissional e adicionar visualização de relacionamentos entre tabelas (ER Diagram).

## Entregas

### SQL Editor (CodeMirror 6)
- [x] Instalar e configurar CodeMirror 6 (extensões SQL)
- [x] Substituir textarea atual pelo CodeMirror no Query Editor
- [x] Tema claro/escuro sincronizado com o app
- [x] Atalho Ctrl+Enter para executar query
- [ ] Autocomplete de tabelas/colunas baseado no catálogo (backlog futuro)
- [ ] Highlight de erros inline (backlog futuro)

### ER Diagram Visual
- [x] Endpoint GET /api/explorer/:connId/relationships?schema=public
- [x] Componente React com ReactFlow para desenhar entidades
- [x] Auto-layout com dagre
- [x] Linhas conectando FKs com labels
- [x] Zoom + pan + minimap
- [x] Seletor de conexão + schema
- [x] Sidebar link "ER Diagram"
- [ ] Export como PNG/SVG (backlog futuro)
- [ ] Filtro por grupo de tabelas (backlog futuro)

## Dependências Instaladas
- `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-sql`, `@codemirror/theme-one-dark`, `codemirror`
- `@xyflow/react` (ReactFlow v12)
- `@dagrejs/dagre` (auto-layout)
