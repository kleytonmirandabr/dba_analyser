import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap, placeholder as phPlugin, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { sql, MSSQL, PostgreSQL, MySQL } from '@codemirror/lang-sql'
import { autocompletion, CompletionContext, CompletionResult, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment, toggleBlockComment, undo, redo, indentMore, indentLess, moveLineUp, moveLineDown, copyLineDown, selectLine } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search'
import { foldGutter, foldKeymap, foldAll, unfoldAll, indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { lintGutter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import { useThemeStore } from '../../stores/theme.store'

interface TableCompletion { name: string; columns: string[] }

export interface EditorCommands {
  comment: () => void
  search: () => void
  uppercase: () => void
  lowercase: () => void
  undo: () => void
  redo: () => void
  foldAll: () => void
  unfoldAll: () => void
  focus: () => void
  indent: () => void
  dedent: () => void
  duplicateLine: () => void
  moveUp: () => void
  moveDown: () => void
  selectLine: () => void
}

interface SqlEditorProps {
  value: string
  onChange: (val: string) => void
  onExecute?: () => void
  onExecuteSelected?: (sql: string) => void
  onViewReady?: (commands: EditorCommands) => void
  placeholder?: string
  completions?: { tables: TableCompletion[] }
  dbType?: string
  height?: string
}

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1f2937', fontSize: '13px' },
  '.cm-gutters': { backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb', color: '#9ca3af' },
  '.cm-activeLineGutter': { backgroundColor: '#eff6ff' },
  '.cm-activeLine': { backgroundColor: '#eff6ff' },
  '.cm-cursor': { borderLeftColor: '#1f2937' },
  '.cm-selectionBackground': { backgroundColor: '#93c5fd !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#60a5fa !important', color: '#1e3a5f !important' },
  '.cm-matchingBracket': { backgroundColor: '#bbf7d0', outline: '1px solid #86efac' },
  '.cm-foldGutter': { width: '12px' },
  '.cm-searchMatch': { backgroundColor: '#fef08a', outline: '1px solid #fde047' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#fdba74' },
  '.cm-tooltip-autocomplete': { border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
})

// SQL syntax colors for light mode
const lightSqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff', fontWeight: '600' },        // SELECT, FROM, WHERE = blue bold
  { tag: tags.operatorKeyword, color: '#0000ff', fontWeight: '600' },
  { tag: tags.definitionKeyword, color: '#0000ff', fontWeight: '600' },
  { tag: tags.typeName, color: '#267f99' },                           // INT, VARCHAR = teal
  { tag: tags.string, color: '#a31515' },                             // 'strings' = red
  { tag: tags.number, color: '#098658' },                             // numbers = green
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },       // --comments = green italic
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.function(tags.variableName), color: '#795e26' },        // functions = brown
  { tag: tags.variableName, color: '#001080' },                       // variables/columns = dark blue
  { tag: tags.null, color: '#0000ff', fontWeight: '600' },
])

const darkThemeCustom = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-gutters': { color: '#6b7280' },
  '.cm-matchingBracket': { backgroundColor: '#365314', outline: '1px solid #4ade80' },
  '.cm-foldGutter': { width: '12px' },
  '.cm-searchMatch': { backgroundColor: '#854d0e', outline: '1px solid #ca8a04' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#92400e' },
  '.cm-tooltip-autocomplete': { border: '1px solid #374151', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  '.cm-tooltip-autocomplete .cm-completionIcon': { marginRight: '8px' },
})

// SQL keywords for autocomplete
const sqlKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX',
  'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL',
  'ON', 'AS', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'TOP',
  'UNION', 'ALL', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BEGIN', 'COMMIT', 'ROLLBACK',
  'TRANSACTION', 'WITH', 'CTE', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'ISNULL', 'CAST', 'CONVERT',
  'VARCHAR', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'BIT', 'DATETIME', 'DATE', 'TEXT', 'BOOLEAN',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE', 'DEFAULT', 'NOT NULL',
  'EXEC', 'EXECUTE', 'DECLARE', 'IF', 'WHILE', 'RETURN', 'PRINT', 'NOLOCK', 'NOCOUNT',
]

// SQL snippets (like SSMS templates)
const sqlSnippets = [
  { label: 'sel*', detail: 'SELECT * FROM', apply: 'SELECT *\nFROM ' },
  { label: 'selc', detail: 'SELECT COUNT(*)', apply: 'SELECT COUNT(*)\nFROM ' },
  { label: 'selt', detail: 'SELECT TOP 100', apply: 'SELECT TOP 100 *\nFROM ' },
  { label: 'ins', detail: 'INSERT INTO', apply: 'INSERT INTO table_name (col1, col2)\nVALUES (val1, val2);' },
  { label: 'upd', detail: 'UPDATE SET', apply: 'UPDATE table_name\nSET col1 = val1\nWHERE condition;' },
  { label: 'del', detail: 'DELETE FROM', apply: 'DELETE FROM table_name\nWHERE condition;' },
  { label: 'crt', detail: 'CREATE TABLE', apply: 'CREATE TABLE table_name (\n  id INT IDENTITY(1,1) PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  created_at DATETIME DEFAULT GETDATE()\n);' },
  { label: 'alt', detail: 'ALTER TABLE ADD', apply: 'ALTER TABLE table_name\nADD column_name VARCHAR(100) NULL;' },
  { label: 'idx', detail: 'CREATE INDEX', apply: 'CREATE INDEX idx_table_column\nON table_name (column_name);' },
  { label: 'jn', detail: 'INNER JOIN', apply: 'INNER JOIN table_name t ON t.id = ' },
  { label: 'ljn', detail: 'LEFT JOIN', apply: 'LEFT JOIN table_name t ON t.id = ' },
  { label: 'ex', detail: 'EXISTS subquery', apply: 'EXISTS (SELECT 1 FROM table_name WHERE condition)' },
  { label: 'cte', detail: 'WITH CTE', apply: 'WITH cte AS (\n  SELECT *\n  FROM table_name\n  WHERE condition\n)\nSELECT * FROM cte;' },
  { label: 'pag', detail: 'Pagination', apply: 'SELECT *\nFROM table_name\nORDER BY id\nOFFSET 0 ROWS\nFETCH NEXT 50 ROWS ONLY;' },
  { label: 'tran', detail: 'BEGIN TRANSACTION', apply: 'BEGIN TRANSACTION;\n\n-- statements here\n\nCOMMIT;\n-- ROLLBACK;' },
]

function buildCompletionSource(completions?: { tables: TableCompletion[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]*/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    const text = word.text

    // Dot-triggered: suggest columns for table
    if (text.includes('.') && completions?.tables?.length) {
      const [tablePart] = text.split('.')
      const table = completions.tables.find(t => t.name.toLowerCase() === tablePart.toLowerCase())
      if (!table) return null
      return {
        from: word.from + tablePart.length + 1,
        options: table.columns.map(col => ({ label: col, type: 'property', boost: 2 })),
      }
    }

    const options: any[] = []

    // Snippets (highest priority)
    sqlSnippets.forEach(s => {
      options.push({ label: s.label, detail: s.detail, type: 'text', apply: s.apply.replace(/\\n/g, '\n'), boost: 10 })
    })

    // SQL keywords
    sqlKeywords.forEach(kw => {
      options.push({ label: kw, type: 'keyword', boost: 1 })
      options.push({ label: kw.toLowerCase(), type: 'keyword', boost: 0 })
    })

    // Table names
    if (completions?.tables?.length) {
      completions.tables.forEach(t => {
        options.push({ label: t.name, type: 'class', detail: `${t.columns.length} cols`, boost: 5 })
      })
      // All columns with table context
      completions.tables.forEach(t => {
        t.columns.forEach(c => {
          options.push({ label: c, type: 'property', detail: t.name, boost: 3 })
        })
      })
    }

    return { from: word.from, options, validFor: /^[\w]*$/ }
  }
}

export default function SqlEditor({ value, onChange, onExecute, onExecuteSelected, onViewReady, placeholder, completions, dbType, height }: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const theme = useThemeStore(s => s.theme)
  const onChangeRef = useRef(onChange)
  const onExecuteRef = useRef(onExecute)
  const onExecuteSelectedRef = useRef(onExecuteSelected)
  onChangeRef.current = onChange
  onExecuteRef.current = onExecute
  onExecuteSelectedRef.current = onExecuteSelected

  useEffect(() => {
    if (!editorRef.current) return

    // Determine SQL dialect
    const dialect = dbType === 'mssql' ? MSSQL : dbType === 'mysql' ? MySQL : PostgreSQL

    const executeKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: (view) => {
          // Execute selected text if there's a selection, otherwise execute all
          const sel = view.state.selection.main
          if (sel.from !== sel.to && onExecuteSelectedRef.current) {
            const selectedSql = view.state.sliceDoc(sel.from, sel.to)
            onExecuteSelectedRef.current(selectedSql)
          } else {
            onExecuteRef.current?.()
          }
          return true
        },
      },
      {
        // Ctrl+/ toggle line comment (like SSMS Ctrl+K, Ctrl+C)
        key: 'Ctrl-/',
        mac: 'Cmd-/',
        run: toggleComment,
      },
      {
        // Ctrl+Shift+/ toggle block comment
        key: 'Ctrl-Shift-/',
        mac: 'Cmd-Shift-/',
        run: toggleBlockComment,
      },
      {
        // Ctrl+F find (SSMS-like)
        key: 'Ctrl-f',
        mac: 'Cmd-f',
        run: openSearchPanel,
      },
      {
        // Ctrl+Shift+U uppercase selection
        key: 'Ctrl-Shift-u',
        mac: 'Cmd-Shift-u',
        run: (view) => {
          const sel = view.state.selection.main
          if (sel.from === sel.to) return false
          const text = view.state.sliceDoc(sel.from, sel.to)
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text.toUpperCase() } })
          return true
        },
      },
      {
        // Ctrl+Shift+L lowercase selection
        key: 'Ctrl-Shift-l',
        mac: 'Cmd-Shift-l',
        run: (view) => {
          const sel = view.state.selection.main
          if (sel.from === sel.to) return false
          const text = view.state.sliceDoc(sel.from, sel.to)
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text.toLowerCase() } })
          return true
        },
      },
    ])

    const state = EditorState.create({
      doc: value,
      extensions: [
        // Core
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),

        // SQL Language
        sql({ dialect, upperCaseKeywords: true }),
        
        // Folding (collapse code blocks)
        foldGutter({
          openText: '▾',
          closedText: '▸',
        }),
        
        // Autocomplete with aggressive settings
        autocompletion({
          override: [buildCompletionSource(completions)],
          activateOnTyping: true,
          maxRenderedOptions: 50,
          icons: true,
        }),

        // Lint gutter (for future SQL validation)
        lintGutter(),

        // Keymaps
        executeKeymap,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),

        // Change listener
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),

        // Placeholder
        phPlugin(placeholder || 'SELECT * FROM table LIMIT 100;\n-- Ctrl+Enter para executar | Ctrl+/ para comentar | Ctrl+F para buscar'),
        EditorView.lineWrapping,

        // Theme + Syntax highlighting
        ...(theme === 'dark' ? [oneDark, darkThemeCustom] : [lightTheme, syntaxHighlighting(lightSqlHighlight)]),
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    // Expose commands
    if (onViewReady) {
      onViewReady({
        comment: () => { toggleComment(view); view.focus() },
        search: () => { openSearchPanel(view); },
        uppercase: () => {
          const sel = view.state.selection.main
          if (sel.from !== sel.to) {
            const text = view.state.sliceDoc(sel.from, sel.to)
            view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text.toUpperCase() } })
          }
          view.focus()
        },
        lowercase: () => {
          const sel = view.state.selection.main
          if (sel.from !== sel.to) {
            const text = view.state.sliceDoc(sel.from, sel.to)
            view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text.toLowerCase() } })
          }
          view.focus()
        },
        undo: () => { undo(view); view.focus() },
        redo: () => { redo(view); view.focus() },
        foldAll: () => { foldAll(view); view.focus() },
        unfoldAll: () => { unfoldAll(view); view.focus() },
        indent: () => { indentMore(view); view.focus() },
        dedent: () => { indentLess(view); view.focus() },
        duplicateLine: () => { copyLineDown(view); view.focus() },
        moveUp: () => { moveLineUp(view); view.focus() },
        moveDown: () => { moveLineDown(view); view.focus() },
        selectLine: () => { selectLine(view); view.focus() },
        focus: () => { view.focus() },
      })
    }

    return () => { view.destroy() }
  }, [theme, completions, dbType])

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return (
    <div ref={editorRef} className="w-full h-full [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:overflow-auto [&_.cm-tooltip]:z-50" style={height ? { height } : undefined} />
  )
}
