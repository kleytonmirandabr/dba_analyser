import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Square, Download, Clock, AlertCircle, Database, Loader2, FileText, Search, CaseUpper, CaseLower, Undo2, Redo2, FoldVertical, UnfoldVertical, Copy, Table2, FileSpreadsheet, FileJson, FileType, ChevronDown, ChevronRight, Plus, X, History, Star, Code2, AlignLeft, Braces, ChevronLeft, Eye, Zap, Key, FolderOpen, RefreshCw, Keyboard, GripVertical, Server } from 'lucide-react'
import api from '../lib/api'
import SqlEditor, { EditorCommands } from '../components/editor/SqlEditor'
import { format as formatSQL } from 'sql-formatter'

interface Connection { id: string; name: string; environment: string; mode: string; dbType: string; }
type NodeType = 'connection' | 'schema' | 'tables_folder' | 'views_folder' | 'functions_folder' | 'triggers_folder' | 'table' | 'view' | 'function' | 'trigger' | 'column'

interface TreeNode {
  id: string; label: string; type: NodeType; children?: TreeNode[]; loaded?: boolean
  connId?: string; schema?: string; table?: string; meta?: any
}

interface TabState {
  id: string; title: string; sql: string; connectionId: string; result: any; error: string
  loading: boolean; elapsed: number; history: { sql: string; time: string; duration: number }[]
}

interface SavedQuery { id: string; name: string; sql: string; connectionId?: string }

function createTab(num: number): TabState {
  return { id: `tab-${Date.now()}`, title: `Query ${num}`, sql: '', connectionId: '', result: null, error: '', loading: false, elapsed: 0, history: [] }
}

// ─── Toolbar Button ──────────────────────────────────────────
function ToolbarBtn({ icon: Icon, label, onClick, disabled, active }: { icon: any; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  const [show, setShow] = useState(false)
  const timeout = useRef<any>(null)
  return (
    <div className="relative" onMouseEnter={() => { timeout.current = setTimeout(() => setShow(true), 500) }} onMouseLeave={() => { clearTimeout(timeout.current); setShow(false) }}>
      <button onClick={onClick} disabled={disabled}
        className={`p-1.5 rounded-md transition-all ${active ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-gray-800'} disabled:opacity-30`}>
        <Icon className="w-4 h-4" />
      </button>
      {show && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="px-2 py-1 bg-gray-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap">{label}</div>
        </div>
      )}
    </div>
  )
}

// ─── Export Menu ─────────────────────────────────────────────
function ExportMenu({ rows }: { rows: any[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const dl = (c: string, f: string, t: string) => { const b = new Blob([c], { type: t }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = f; a.click(); URL.revokeObjectURL(u); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-secondary rounded border border-border transition">
        <Download className="w-3 h-3" /> Exportar <ChevronDown className={`w-2.5 h-2.5 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
          {[
            ['Excel', () => dl(`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="R"><Table><Row>${headers.map(h=>`<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>${rows.map(r=>'<Row>'+headers.map(h=>{const v=r[h];return v==null?'<Cell><Data ss:Type="String"></Data></Cell>':typeof v==='number'?`<Cell><Data ss:Type="Number">${v}</Data></Cell>`:`<Cell><Data ss:Type="String">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>`}).join('')+'</Row>').join('')}</Table></Worksheet></Workbook>`, `q_${ts}.xls`, 'application/vnd.ms-excel')],
            ['CSV', () => dl([headers.join(','), ...rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))].join('\n'), `q_${ts}.csv`, 'text/csv')],
            ['JSON', () => dl(JSON.stringify(rows,null,2), `q_${ts}.json`, 'application/json')],
            ['Copiar', () => { navigator.clipboard.writeText([headers.join('\t'), ...rows.map(r=>headers.map(h=>String(r[h]??'')).join('\t'))].join('\n')); setOpen(false) }],
          ].map(([label, fn]: any) => (
            <button key={label} onClick={fn} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 text-text-primary">{label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────
export default function QueryPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])

  // Tree state (Explorer)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeSearch, setTreeSearch] = useState('')
  const [treeWidth, setTreeWidth] = useState(() => Number(localStorage.getItem('dba-tree-width') || '280'))
  const [showTree, setShowTree] = useState(true)

  // Tabs
  const [tabs, setTabs] = useState<TabState[]>([createTab(1)])
  const [activeTabId, setActiveTabId] = useState('')
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // Editor
  const [splitPos, setSplitPos] = useState(() => Number(localStorage.getItem('dba-query-split') || '40'))
  const [editorCmds, setEditorCmds] = useState<EditorCommands | null>(null)
  const [completions, setCompletions] = useState<any>(undefined)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Results
  const [resultView, setResultView] = useState<'grid' | 'json'>('grid')
  const [page, setPage] = useState(0)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})

  // Saved queries
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => { try { return JSON.parse(localStorage.getItem('dba-saved-queries') || '[]') } catch { return [] } })
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const splitRef = useRef<HTMLDivElement>(null)
  const treeDragRef = useRef(false)
  const splitDragRef = useRef(false)
  const ROWS_PER_PAGE = 100

  // Init
  useEffect(() => {
    setActiveTabId(tabs[0].id)
    api.get('/api/connections').then(r => {
      const conns = r.data.data
      setConnections(conns)
      // Build connection tree
      const nodes: TreeNode[] = conns.map((c: Connection) => ({
        id: `conn:${c.id}`, label: c.name, type: 'connection' as NodeType, connId: c.id, loaded: false,
        meta: { env: c.environment, mode: c.mode, dbType: c.dbType },
        children: []
      }))
      setTree(nodes)
      // Prefill
      const prefill = sessionStorage.getItem('dba_prefill_connId')
      if (prefill) { updateTab({ connectionId: prefill }); sessionStorage.removeItem('dba_prefill_connId') }
    }).catch(() => {})
    const pq = sessionStorage.getItem('dba_prefill_query')
    if (pq) { updateTab({ sql: pq }); sessionStorage.removeItem('dba_prefill_query') }
  }, [])

  // Load completions when connection changes
  useEffect(() => {
    if (!activeTab.connectionId) { setCompletions(undefined); return }
    api.get(`/api/explorer/${activeTab.connectionId}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
  }, [activeTab.connectionId])

  const updateTab = (patch: Partial<TabState>) => setTabs(ts => ts.map(t => t.id === (activeTabId || tabs[0]?.id) ? { ...t, ...patch } : t))

  // Tree operations
  const loadSchemas = async (connId: string) => {
    try {
      const { data } = await api.get(`/api/explorer/${connId}/schemas`)
      const schemas: TreeNode[] = data.data.map((s: string) => ({
        id: `${connId}:schema:${s}`, label: s, type: 'schema' as NodeType, connId, schema: s, loaded: false,
        children: [
          { id: `${connId}:${s}:tables`, label: 'Tabelas', type: 'tables_folder' as NodeType, connId, schema: s, children: [], loaded: false },
          { id: `${connId}:${s}:views`, label: 'Views', type: 'views_folder' as NodeType, connId, schema: s, children: [], loaded: false },
          { id: `${connId}:${s}:functions`, label: 'Funções', type: 'functions_folder' as NodeType, connId, schema: s, children: [], loaded: false },
          { id: `${connId}:${s}:triggers`, label: 'Triggers', type: 'triggers_folder' as NodeType, connId, schema: s, children: [], loaded: false },
        ]
      }))
      setTree(prev => prev.map(n => n.id === `conn:${connId}` ? { ...n, children: schemas, loaded: true } : n))
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao conectar'
      const errorNode: TreeNode = { id: `${connId}:error`, label: '⚠ ' + (msg.includes('decriptar') ? 'Credenciais inválidas - re-salve a conexão' : msg), type: 'column' as NodeType, connId }
      setTree(prev => prev.map(n => n.id === `conn:${connId}` ? { ...n, children: [errorNode], loaded: true } : n))
    }
  }

  const loadChildren = async (node: TreeNode) => {
    if (node.loaded || !node.connId) return
    const schema = node.schema || 'dbo'
    try {
      let children: TreeNode[] = []
      if (node.type === 'tables_folder') {
        const { data } = await api.get(`/api/explorer/${node.connId}/tables?schema=${schema}`)
        children = data.data.map((t: any) => ({ id: `${node.connId}:${schema}.table.${t.name}`, label: t.name, type: 'table' as NodeType, connId: node.connId, schema, table: t.name, loaded: false, children: [] }))
      } else if (node.type === 'views_folder') {
        const { data } = await api.get(`/api/explorer/${node.connId}/views?schema=${schema}`)
        children = data.data.map((v: any) => ({ id: `${node.connId}:view.${v.name}`, label: v.name, type: 'view' as NodeType, connId: node.connId, schema }))
      } else if (node.type === 'functions_folder') {
        const { data } = await api.get(`/api/explorer/${node.connId}/functions?schema=${schema}`)
        children = data.data.map((f: any) => ({ id: `${node.connId}:fn.${f.name}`, label: f.name + '(' + (f.parameters || '') + ')', type: 'function' as NodeType, connId: node.connId, schema }))
      } else if (node.type === 'triggers_folder') {
        const { data } = await api.get(`/api/explorer/${node.connId}/triggers?schema=${schema}`)
        children = data.data.map((t: any) => ({ id: `${node.connId}:trg.${t.name}`, label: t.name, type: 'trigger' as NodeType, connId: node.connId, schema }))
      } else if (node.type === 'table') {
        const { data } = await api.get(`/api/explorer/${node.connId}/columns/${schema}/${node.table}`)
        children = data.data.map((c: any) => ({ id: `${node.id}.${c.name}`, label: `${c.name} (${c.type})${c.isPrimaryKey ? ' 🔑' : ''}`, type: 'column' as NodeType, connId: node.connId, schema }))
      }
      // Update tree immutably
      const updateNode = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => n.id === node.id ? { ...n, children, loaded: true } : { ...n, children: n.children ? updateNode(n.children) : undefined })
      setTree(prev => updateNode(prev))
    } catch {}
  }

  const toggleNode = async (node: TreeNode) => {
    const next = new Set(expanded)
    if (next.has(node.id)) { next.delete(node.id) } else {
      next.add(node.id)
      if (!node.loaded) {
        if (node.type === 'connection') await loadSchemas(node.connId!)
        else await loadChildren(node)
      }
    }
    setExpanded(next)
  }

  const selectConnection = (connId: string) => {
    updateTab({ connectionId: connId })
  }

  // Render tree node
  const nodeIcon = (type: NodeType) => {
    const icons: Record<string, any> = { connection: Server, schema: FolderOpen, tables_folder: Table2, views_folder: Eye, functions_folder: Code2, triggers_folder: Zap, table: Table2, view: Eye, function: Code2, trigger: Zap, column: Braces }
    return icons[type] || Database
  }
  const nodeColor = (type: NodeType) => {
    const colors: Record<string, string> = { connection: 'text-blue-500', schema: 'text-amber-500', tables_folder: 'text-green-500', views_folder: 'text-purple-500', functions_folder: 'text-orange-500', triggers_folder: 'text-red-500', table: 'text-green-600 dark:text-green-400', view: 'text-purple-500', function: 'text-orange-500', trigger: 'text-red-500', column: 'text-text-tertiary' }
    return colors[type] || 'text-text-tertiary'
  }

  const renderNode = (node: TreeNode, depth = 0): JSX.Element => {
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.type !== 'column' && node.type !== 'view' && node.type !== 'function' && node.type !== 'trigger'
    const Icon = nodeIcon(node.type)
    const isConn = node.type === 'connection'
    const isActive = isConn && node.connId === activeTab.connectionId

    // Filter by search
    if (treeSearch && !node.label.toLowerCase().includes(treeSearch.toLowerCase())) {
      if (!node.children?.some(c => c.label.toLowerCase().includes(treeSearch.toLowerCase()) || c.children?.some(gc => gc.label.toLowerCase().includes(treeSearch.toLowerCase())))) return <></>
    }

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 px-1.5 py-[3px] rounded cursor-pointer text-[12px] transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          onClick={() => {
            if (hasChildren) toggleNode(node)
            if (isConn) selectConnection(node.connId!)
            if (node.type === 'table') {
              // Double-click inserts table name
              selectConnection(node.connId!)
            }
          }}
          onDoubleClick={() => {
            if (node.type === 'table') updateTab({ sql: activeTab.sql + (activeTab.sql ? '\n' : '') + `SELECT TOP 100 * FROM ${node.schema}.${node.label};` })
            if (node.type === 'view') updateTab({ sql: activeTab.sql + (activeTab.sql ? '\n' : '') + `SELECT TOP 100 * FROM ${node.schema}.${node.label};` })
          }}
        >
          {hasChildren ? (
            <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
              {isExpanded ? <ChevronDown className="w-3 h-3 text-text-tertiary" /> : <ChevronRight className="w-3 h-3 text-text-tertiary" />}
            </span>
          ) : <span className="w-3.5" />}
          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${nodeColor(node.type)}`} />
          <span className={`truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-text-primary'}`}>{node.label}</span>
          {isConn && node.meta && <span className="ml-auto text-[9px] text-text-tertiary px-1 bg-gray-100 dark:bg-gray-800 rounded">{node.meta.env}</span>}
          {node.type === 'table' && node.loaded && node.children && <span className="ml-auto text-[9px] text-text-tertiary">{node.children.length}</span>}
        </div>
        {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  // Tree resize
  const startTreeDrag = (e: React.MouseEvent) => {
    e.preventDefault(); treeDragRef.current = true; const startX = e.clientX; const startW = treeWidth
    const onMove = (ev: MouseEvent) => { if (!treeDragRef.current) return; setTreeWidth(Math.max(180, Math.min(500, startW + ev.clientX - startX))); localStorage.setItem('dba-tree-width', String(Math.round(startW + ev.clientX - startX))) }
    const onUp = () => { treeDragRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // Split resize
  const startSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); splitDragRef.current = true; const startY = e.clientY; const startP = splitPos
    const onMove = (ev: MouseEvent) => { if (!splitDragRef.current || !splitRef.current) return; const h = splitRef.current.getBoundingClientRect().height; setSplitPos(Math.max(15, Math.min(85, startP + ((ev.clientY - startY) / h) * 100))); localStorage.setItem('dba-query-split', String(Math.round(startP + ((ev.clientY - startY) / h) * 100))) }
    const onUp = () => { splitDragRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [splitPos])

  // Execute
  const runQuery = async (sql: string) => {
    if (!activeTab.connectionId || !sql.trim()) return
    const ctrl = new AbortController(); setAbortController(ctrl)
    updateTab({ loading: true, error: '', result: null, elapsed: 0 })
    const start = Date.now()
    const timer = setInterval(() => updateTab({ elapsed: Math.floor((Date.now() - start) / 1000) }), 1000)
    try {
      const { data } = await api.post(`/api/query/${activeTab.connectionId}/execute`, { sql, limit: 5000 }, { signal: ctrl.signal })
      if (data.data.success) { updateTab({ result: data.data, history: [{ sql: sql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...activeTab.history.slice(0, 49)] }); setPage(0) }
      else updateTab({ error: data.data.error || 'Erro' })
    } catch (err: any) {
      updateTab({ error: err.code === 'ERR_CANCELED' ? 'Cancelado pelo usuário' : (err.response?.data?.error || err.message) })
    }
    clearInterval(timer); updateTab({ loading: false }); setAbortController(null)
  }

  const execute = () => runQuery(activeTab.sql)
  const executeSelected = (sel: string) => runQuery(sel)
  const stopExec = () => { abortController?.abort(); setAbortController(null) }
  const explainQuery = () => { if (!activeTab.sql.trim()) return; const conn = connections.find(c => c.id === activeTab.connectionId); runQuery(conn?.dbType === 'sqlserver' ? `SET SHOWPLAN_TEXT ON; ${activeTab.sql}` : `EXPLAIN ${activeTab.sql}`) }
  const formatSql = () => { try { updateTab({ sql: formatSQL(activeTab.sql, { language: 'transactsql', tabWidth: 2, keywordCase: 'upper' }) }) } catch {} }

  // Tabs
  const addTab = () => { const t = createTab(tabs.length + 1); t.connectionId = activeTab.connectionId; setTabs([...tabs, t]); setActiveTabId(t.id) }
  const closeTab = (id: string) => { if (tabs.length === 1) return; const idx = tabs.findIndex(t => t.id === id); const next = tabs.filter(t => t.id !== id); setTabs(next); if (activeTabId === id) setActiveTabId(next[Math.min(idx, next.length - 1)].id) }

  // Save query
  const saveQuery = () => { const q: SavedQuery = { id: Date.now().toString(), name: saveName || 'Query', sql: activeTab.sql, connectionId: activeTab.connectionId }; const updated = [q, ...savedQueries]; setSavedQueries(updated); localStorage.setItem('dba-saved-queries', JSON.stringify(updated)); setShowSaveDialog(false); setSaveName('') }
  const removeSaved = (id: string) => { const u = savedQueries.filter(q => q.id !== id); setSavedQueries(u); localStorage.setItem('dba-saved-queries', JSON.stringify(u)) }

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) { e.preventDefault(); execute() }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); explainQuery() }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); formatSql() }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); addTab() }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); closeTab(activeTabId) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [activeTab.sql, activeTab.connectionId, activeTabId, tabs])

  const connObj = connections.find(c => c.id === activeTab.connectionId)
  const allRows = activeTab.result?.rows || []
  const totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE)
  const pagedRows = allRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
  const headers = allRows.length > 0 ? Object.keys(allRows[0]) : []

  const startColResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault(); const startX = e.clientX; const startW = colWidths[col] || 150
    const onMove = (ev: MouseEvent) => setColWidths(w => ({ ...w, [col]: Math.max(50, startW + ev.clientX - startX) }))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ─── Object Explorer Tree (SSMS style) ─── */}
      {showTree && (
        <>
          <div style={{ width: treeWidth + 'px' }} className="flex flex-col bg-white dark:bg-gray-900/95 border-r border-border flex-shrink-0">
            {/* Tree header */}
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-blue-500" /> Object Explorer</span>
              <button onClick={() => setShowTree(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-3 h-3 text-text-tertiary" /></button>
            </div>
            {/* Search */}
            <div className="px-2 py-1.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1.5 w-3 h-3 text-text-tertiary" />
                <input value={treeSearch} onChange={e => setTreeSearch(e.target.value)} placeholder="Filtrar..."
                  className="w-full pl-7 pr-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-800 border border-border rounded text-text-primary placeholder-text-tertiary" />
              </div>
            </div>
            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1 px-1">
              {tree.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-tertiary">Carregando conexões...</div>
              ) : tree.map(node => renderNode(node))}
            </div>
            {/* Saved queries */}
            {savedQueries.length > 0 && (
              <div className="border-t border-border max-h-32 overflow-y-auto px-2 py-1.5">
                <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-wide mb-1">⭐ Queries Salvas</p>
                {savedQueries.map(q => (
                  <div key={q.id} onClick={() => updateTab({ sql: q.sql })} className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer group">
                    <Star className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                    <span className="text-[10px] text-text-secondary truncate flex-1">{q.name}</span>
                    <button onClick={e => { e.stopPropagation(); removeSaved(q.id) }} className="opacity-0 group-hover:opacity-100"><X className="w-2.5 h-2.5 text-text-tertiary hover:text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Tree resize handle */}
          <div onMouseDown={startTreeDrag} className="w-1 cursor-col-resize hover:bg-blue-400 transition-colors flex-shrink-0" />
        </>
      )}

      {/* ─── Main Editor Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-900 border-b border-border px-1 flex-shrink-0">
          {!showTree && <button onClick={() => setShowTree(true)} className="p-1.5 mr-1 text-text-tertiary hover:text-text-primary rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Object Explorer"><Database className="w-3.5 h-3.5" /></button>}
          <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer border-b-2 transition whitespace-nowrap ${
                  tab.id === activeTabId ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-surface font-medium' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tab.loading ? 'bg-amber-500 animate-pulse' : tab.error ? 'bg-red-500' : tab.result ? 'bg-green-500' : 'bg-gray-400'}`} />
                {tab.title}
                {tabs.length > 1 && <button onClick={e => { e.stopPropagation(); closeTab(tab.id) }} className="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X className="w-2.5 h-2.5" /></button>}
              </div>
            ))}
          </div>
          <button onClick={addTab} className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Ctrl+T"><Plus className="w-3.5 h-3.5" /></button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border bg-white dark:bg-gray-900/95 flex-shrink-0">
          {/* Connection indicator */}
          {connObj ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <Server className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">{connObj.name}</span>
              <span className={`text-[9px] px-1 rounded ${connObj.mode === 'readonly' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>{connObj.mode}</span>
            </div>
          ) : (
            <span className="text-[10px] text-text-tertiary italic px-2">← Selecione uma conexão na árvore</span>
          )}

          <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

          {activeTab.loading ? (
            <button onClick={stopExec} className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-[11px] font-medium rounded-md"><Square className="w-3 h-3 fill-current" /> Parar{activeTab.elapsed > 0 ? ` ${activeTab.elapsed}s` : ''}</button>
          ) : (
            <button onClick={execute} disabled={!activeTab.connectionId} className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white text-[11px] font-medium rounded-md transition"><Play className="w-3 h-3" /> Executar</button>
          )}
          <button onClick={explainQuery} disabled={!activeTab.connectionId} className="flex items-center gap-1 px-2 py-1 text-[11px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-40"><Zap className="w-3 h-3" /> Explain</button>

          <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

          <ToolbarBtn icon={AlignLeft} label="Formatar (Ctrl+Shift+F)" onClick={formatSql} disabled={!activeTab.sql.trim()} />
          <ToolbarBtn icon={Undo2} label="Desfazer" onClick={() => editorCmds?.undo()} disabled={!editorCmds} />
          <ToolbarBtn icon={Redo2} label="Refazer" onClick={() => editorCmds?.redo()} disabled={!editorCmds} />
          <ToolbarBtn icon={Search} label="Buscar (Ctrl+F)" onClick={() => editorCmds?.search()} disabled={!editorCmds} />
          <ToolbarBtn icon={CaseUpper} label="UPPER" onClick={() => editorCmds?.uppercase()} disabled={!editorCmds} />
          <ToolbarBtn icon={CaseLower} label="lower" onClick={() => editorCmds?.lowercase()} disabled={!editorCmds} />

          <div className="ml-auto flex items-center gap-1.5">
            <ToolbarBtn icon={History} label="Histórico" onClick={() => setShowHistory(!showHistory)} active={showHistory} />
            <ToolbarBtn icon={Star} label="Salvar" onClick={() => setShowSaveDialog(true)} disabled={!activeTab.sql.trim()} />
            <ToolbarBtn icon={Keyboard} label="Atalhos" onClick={() => setShowShortcuts(!showShortcuts)} active={showShortcuts} />
            {allRows.length > 0 && <ExportMenu rows={allRows} />}
            {activeTab.result && <span className="text-[10px] text-text-tertiary"><Clock className="w-3 h-3 inline mr-0.5" />{activeTab.result.durationMs}ms • {allRows.length} rows</span>}
          </div>
        </div>

        {/* Popups */}
        {showShortcuts && (
          <div className="absolute top-28 right-4 z-50 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl p-3 w-64">
            <div className="flex justify-between items-center mb-2"><h4 className="text-[11px] font-bold">⌨️ Atalhos</h4><button onClick={() => setShowShortcuts(false)}><X className="w-3.5 h-3.5 text-text-tertiary" /></button></div>
            <div className="space-y-1 text-[10px]">
              {[['F5/Ctrl+Enter','Executar'],['Ctrl+Shift+E','Explain'],['Ctrl+Shift+F','Formatar'],['Ctrl+T','Nova aba'],['Ctrl+W','Fechar aba'],['Dbl-click tabela','SELECT TOP 100']].map(([k,d]) => (
                <div key={k} className="flex justify-between"><span className="text-text-secondary">{d}</span><kbd className="px-1 bg-gray-100 dark:bg-gray-800 border border-border rounded text-[9px] font-mono">{k}</kbd></div>
              ))}
            </div>
          </div>
        )}
        {showSaveDialog && (
          <div className="absolute top-28 right-16 z-50 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl p-3 w-56">
            <h4 className="text-[11px] font-bold mb-2">⭐ Salvar Query</h4>
            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Nome..." className="w-full px-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-800 border border-border rounded text-text-primary mb-2" autoFocus />
            <div className="flex gap-1.5"><button onClick={() => setShowSaveDialog(false)} className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 rounded">Cancelar</button><button onClick={saveQuery} className="flex-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded">Salvar</button></div>
          </div>
        )}
        {showHistory && activeTab.history.length > 0 && (
          <div className="absolute top-28 right-32 z-50 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl p-3 w-80 max-h-60 overflow-y-auto">
            <div className="flex justify-between items-center mb-2"><h4 className="text-[11px] font-bold">🕐 Histórico</h4><button onClick={() => setShowHistory(false)}><X className="w-3.5 h-3.5 text-text-tertiary" /></button></div>
            {activeTab.history.map((h, i) => (
              <div key={i} onClick={() => { updateTab({ sql: h.sql }); setShowHistory(false) }} className="px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
                <p className="text-[10px] font-mono text-text-secondary truncate">{h.sql.slice(0, 80)}</p>
                <p className="text-[9px] text-text-tertiary">{h.time} • {h.duration}ms</p>
              </div>
            ))}
          </div>
        )}

        {/* Editor + Results */}
        <div className="flex-1 flex flex-col min-h-0" ref={splitRef}>
          <div style={{ height: `${splitPos}%` }} className="min-h-[80px]">
            <SqlEditor value={activeTab.sql} onChange={v => updateTab({ sql: v })} onExecute={execute} onExecuteSelected={executeSelected} onViewReady={setEditorCmds} placeholder="SELECT * FROM tabela LIMIT 100;" completions={completions} dbType={connObj?.dbType} />
          </div>

          {/* Splitter */}
          <div onMouseDown={startSplitDrag} className="h-1 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 cursor-row-resize flex items-center justify-center transition-colors flex-shrink-0 border-y border-border/30">
            <div className="w-8 h-0.5 rounded bg-gray-400 dark:bg-gray-600" />
          </div>

          {/* Results */}
          <div style={{ height: `${100 - splitPos}%` }} className="min-h-[80px] flex flex-col overflow-hidden bg-white dark:bg-background">
            {/* Results toolbar */}
            {allRows.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                <div className="flex bg-gray-200/50 dark:bg-gray-800 rounded p-0.5">
                  <button onClick={() => setResultView('grid')} className={`px-2 py-0.5 text-[10px] rounded ${resultView === 'grid' ? 'bg-white dark:bg-surface shadow font-medium text-text-primary' : 'text-text-tertiary'}`}>Grid</button>
                  <button onClick={() => setResultView('json')} className={`px-2 py-0.5 text-[10px] rounded ${resultView === 'json' ? 'bg-white dark:bg-surface shadow font-medium text-text-primary' : 'text-text-tertiary'}`}>JSON</button>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0} className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <span className="text-[10px] text-text-secondary">{page+1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1} className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronRight className="w-3.5 h-3.5" /></button>
                    <span className="text-[10px] text-text-tertiary ml-1">({allRows.length} total)</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {activeTab.error && (
                <div className={`m-3 p-3 rounded-lg flex items-start gap-2 ${activeTab.error.includes('WHERE') ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeTab.error.includes('WHERE') ? 'text-amber-500' : 'text-red-500'}`} />
                  <div>
                    <p className={`text-xs font-medium ${activeTab.error.includes('WHERE') ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>{activeTab.error.includes('WHERE') ? 'Proteção de segurança' : 'Erro na execução'}</p>
                    <pre className="text-[11px] whitespace-pre-wrap mt-1 text-red-600 dark:text-red-300/80">{activeTab.error}</pre>
                  </div>
                </div>
              )}

              {allRows.length > 0 && resultView === 'grid' && (
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                    <tr>
                      <th className="py-1.5 px-2 text-text-tertiary font-medium border-b border-r border-border/30 w-8 text-[9px]">#</th>
                      {headers.map(col => (
                        <th key={col} style={{ width: colWidths[col] ? colWidths[col]+'px' : 'auto', minWidth: '50px' }}
                          className="text-left py-1.5 px-2 text-text-secondary font-semibold border-b border-border whitespace-nowrap relative group">
                          {col}
                          <div onMouseDown={e => startColResize(col, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                        <td className="py-1 px-2 text-text-tertiary text-[9px] font-mono text-right border-r border-border/20 w-8">{page*ROWS_PER_PAGE+i+1}</td>
                        {Object.entries(row).map(([k, val]: [string, any], j) => (
                          <td key={j} style={{ width: colWidths[k] ? colWidths[k]+'px' : 'auto' }}
                            className="py-1 px-2 font-mono whitespace-nowrap max-w-[300px] truncate text-text-primary"
                            onDoubleClick={() => navigator.clipboard.writeText(String(val ?? ''))}>
                            {val === null ? <span className="text-text-tertiary italic">NULL</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {allRows.length > 0 && resultView === 'json' && (
                <pre className="p-3 text-[11px] font-mono text-text-secondary whitespace-pre overflow-auto">{JSON.stringify(pagedRows, null, 2)}</pre>
              )}

              {activeTab.result && allRows.length === 0 && (
                <div className="p-4 text-center text-xs text-text-secondary">✓ Executada com sucesso • {activeTab.result.rowsAffected ?? 0} linhas afetadas • {activeTab.result.durationMs}ms</div>
              )}

              {!activeTab.result && !activeTab.error && !activeTab.loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center opacity-50">
                    <Database className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                    <p className="text-xs text-text-secondary">Execute uma query para ver resultados</p>
                    <p className="text-[10px] text-text-tertiary mt-1"><kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded border border-border text-[9px]">F5</kbd> ou <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded border border-border text-[9px]">Ctrl+Enter</kbd></p>
                  </div>
                </div>
              )}

              {activeTab.loading && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-xs text-text-secondary">Executando... {activeTab.elapsed > 0 && `${activeTab.elapsed}s`}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
