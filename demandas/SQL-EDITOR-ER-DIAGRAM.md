# Demanda: SQL Editor com Syntax Highlight + ER Diagram
**Status:** 🔜 Planejada
**Versão alvo:** v1.3.0
**Data criação:** 2026-05-26

## Objetivo
Melhorar a experiência de edição SQL com syntax highlighting profissional e adicionar visualização de relacionamentos entre tabelas (ER Diagram).

## Entregas

### SQL Editor (CodeMirror 6)
- [ ] Instalar e configurar CodeMirror 6 (extensões SQL)
- [ ] Substituir textarea atual pelo CodeMirror no Query Editor
- [ ] Autocomplete de tabelas/colunas baseado no catálogo
- [ ] Tema claro/escuro sincronizado com o app
- [ ] Highlight de erros inline (feedback do backend)
- [ ] Atalhos: Ctrl+Enter (executar), Ctrl+Shift+F (formatar)

### ER Diagram Visual
- [ ] Endpoint /api/explorer/:connectionId/relationships (FKs + constraints)
- [ ] Componente React com canvas/SVG para desenhar entidades
- [ ] Arrastar e posicionar tabelas livremente
- [ ] Linhas conectando FKs com labels (1:N, N:N)
- [ ] Zoom + pan + minimap
- [ ] Export como PNG/SVG
- [ ] Filtro por schema/grupo de tabelas

## Dependências
- `@codemirror/lang-sql` — syntax highlight SQL
- `@codemirror/autocomplete` — autocomplete
- `reactflow` ou `elkjs` — layout de grafo para ER diagram

## Impacto
- SQL Editor: melhora UX significativa para DBAs que escrevem queries longas
- ER Diagram: elimina necessidade de ferramentas externas (DBeaver, pgAdmin) para visualizar relacionamentos
