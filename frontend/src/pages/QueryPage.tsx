import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Play, Square, Download, Clock, AlertCircle, Database, Loader2, FileText, MessageSquareCode, Search, CaseUpper, CaseLower, Undo2, Redo2, FoldVertical, UnfoldVertical, Copy, Table2, FileSpreadsheet, FileJson, FileType, ChevronDown, RotateCcw, Plus, X, History, Star, StarOff, Code2, AlignLeft, BarChart3, Braces, ChevronLeft, ChevronRight, GripVertical, Zap, Keyboard, ArrowUpDown } from 'lucide-react'
import api from '../lib/api'
import SqlEditor, { EditorCommands } from '../components/editor/SqlEditor'
import { format as formatSQL } from 'sql-formatter'

interface Connection { id: string; name: string; environment: string; mode: string; dbType: string; }

// ─── Tab State ───────────────────────────────────────────────
interface TabState {
  id: string
  title: string
  sql: string
  connectionId: string
  result: any
  error: string
  loading: boolean
  elapsed: number
  history: { sql: string; time: string; duration: number }[]
}

function createTab(id?: string): TabState {
  return {
    id: id || `tab-${Date.now()}`,
    title: 'Query ' + (id ? id.slice(-3) : '1'),
    sql: 'SELECT 1;',
    connectionId: '',
    result: null,
    error: '',
    loading: false,
    elapsed: 0,
    history: []
  }
}

// ─── Toolbar Button ──────────────────────────────────────────
function ToolbarBtn({ icon: Icon, label, onClick, disabled, active }: { icon: any; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleEnter = () => { timeoutRef.current = setTimeout(() => setShow(true), 400) }
  const handleLeave = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setShow(false) }
  const match = label.match(/^(.+?)\s*\((.+)\)$/)
  const name = match ? match[1] : label
  const shortcut = match ? match[2] : null

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button onClick={onClick} disabled={disabled}
        className={`p-1.5 rounded-md transition-all duration-150 ${active ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-surface-active'} active:scale-90 disabled:opacity-30 disabled:pointer-events-none`}>
        <Icon className="w-4 h-4" />
      </button>
      {show && (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="px-2.5 py-1.5 bg-gray-900 dark:bg-surface-elevated border border-gray-700 dark:border-border rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
            <span className="text-[11px] text-white dark:text-text-primary font-medium">{name}</span>
            {shortcut && <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-800 dark:bg-surface border border-gray-600 rounded text-gray-300 dark:text-text-secondary font-mono">{shortcut}</kbd>}
          </div>
        </div>
      )}
    </div>
  )
}

function ToolbarSep() { return <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-0.5" /> }

// ─── Export Menu ─────────────────────────────────────────────
function ExportMenu({ rows }: { rows: any[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); setOpen(false)
  }

  const exportCSV = () => { const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n'); download(csv, `query_${timestamp}.csv`, 'text/csv') }
  const exportJSON = () => download(JSON.stringify(rows, null, 2), `query_${timestamp}.json`, 'application/json')
  const exportSQL = () => { const ins = rows.map(r => `INSERT INTO result (${headers.join(', ')}) VALUES (${headers.map(h => { const v = r[h]; return v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'` }).join(', ')});`).join('\n'); download(ins, `query_${timestamp}.sql`, 'text/plain') }
  const exportExcel = () => { const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Result"><Table><Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>${rows.map(r => '<Row>' + headers.map(h => { const v = r[h]; return v === null ? '<Cell><Data ss:Type="String"></Data></Cell>' : typeof v === 'number' ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>` }).join('') + '</Row>').join('')}</Table></Worksheet></Workbook>`; download(xml, `query_${timestamp}.xls`, 'application/vnd.ms-excel') }
  const copyClipboard = () => { navigator.clipboard.writeText([headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t'))].join('\n')); setOpen(false) }

  const items = [
    { icon: FileSpreadsheet, label: 'Excel (.xls)', fn: exportExcel },
    { icon: Table2, label: 'CSV (.csv)', fn: exportCSV },
    { icon: FileJson, label: 'JSON (.json)', fn: exportJSON },
    { icon: Database, label: 'SQL INSERTs', fn: exportSQL },
    { icon: Copy, label: 'Copiar (Clipboard)', fn: copyClipboard },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-surface-elevated hover:bg-gray-200 dark:hover:bg-surface-active text-text-secondary text-xs rounded-lg border border-border transition">
        <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-56 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl z-50 py-1">
          {items.map((item, i) => (
            <button key={i} onClick={item.fn} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-surface-elevated transition text-left">
              <item.icon className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs text-text-primary">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Saved Queries ───────────────────────────────────────────
interface SavedQuery { id: string; name: string; sql: string; connectionId?: string; createdAt: string }

function useSavedQueries() {
  const [queries, setQueries] = useState<SavedQuery[]>(() => {
    try { return JSON.parse(localStorage.getItem('dba-saved-queries') || '[]') } catch { return [] }
  })
  const save = (name: string, sql: string, connectionId?: string) => {
    const q: SavedQuery = { id: Date.now().toString(), name, sql, connectionId, createdAt: new Date().toISOString() }
    const updated = [q, ...queries]
    setQueries(updated); localStorage.setItem('dba-saved-queries', JSON.stringify(updated))
  }
  const remove = (id: string) => {
    const updated = queries.filter(q => q.id !== id)
    setQueries(updated); localStorage.setItem('dba-saved-queries', JSON.stringify(updated))
  }
  return { queries, save, remove }
}

// ─── Results View Modes ──────────────────────────────────────
type ResultView = 'grid' | 'json' | 'chart'

// ─── Main Component ──────────────────────────────────────────
export default function QueryPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  
  // Tab management
  const [tabs, setTabs] = useState<TabState[]>([createTab('001')])
  const [activeTabId, setActiveTabId] = useState('tab-001')
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]
  
  // UI state
  const [splitPos, setSplitPos] = useState(() => Number(localStorage.getItem('dba-query-split') || '35'))
  const [showHistory, setShowHistory] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [resultView, setResultView] = useState<ResultView>('grid')
  const [page, setPage] = useState(0)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [editorCmds, setEditorCmds] = useState<EditorCommands | null>(null)
  const [completions, setCompletions] = useState<any>(undefined)
  const { queries: savedQueries, save: saveQuery, remove: removeSavedQuery } = useSavedQueries()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const splitRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const ROWS_PER_PAGE = 100

  // Helpers to update active tab
  const updateTab = (patch: Partial<TabState>) => {
    setTabs(ts => ts.map(t => t.id === activeTabId ? { ...t, ...patch } : t))
  }

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data)
      const prefill = sessionStorage.getItem('dba_prefill_connId')
      if (prefill) { updateTab({ connectionId: prefill }); sessionStorage.removeItem('dba_prefill_connId') }
    }).catch(() => {})
    const prefillQuery = sessionStorage.getItem('dba_prefill_query')
    if (prefillQuery) { updateTab({ sql: prefillQuery }); sessionStorage.removeItem('dba_prefill_query') }
  }, [])

  useEffect(() => {
    if (!activeTab.connectionId) { setCompletions(undefined); return }
    api.get(`/api/explorer/${activeTab.connectionId}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
  }, [activeTab.connectionId])

  // Split panel drag
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); dragging.current = true
    const startY = e.clientY; const startSplit = splitPos
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return
      const containerH = splitRef.current.getBoundingClientRect().height
      const delta = ev.clientY - startY
      const newPos = Math.max(15, Math.min(85, startSplit + (delta / containerH) * 100))
      setSplitPos(newPos); localStorage.setItem('dba-query-split', String(Math.round(newPos)))
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [splitPos])

  // Execute
  const runQuery = async (querySql: string) => {
    if (!activeTab.connectionId || !querySql.trim()) return
    const controller = new AbortController()
    setAbortController(controller)
    updateTab({ loading: true, error: '', result: null, elapsed: 0 })
    const startTime = Date.now()
    const timer = setInterval(() => updateTab({ elapsed: Math.floor((Date.now() - startTime) / 1000) }), 1000)
    try {
      const { data } = await api.post(`/api/query/${activeTab.connectionId}/execute`, { sql: querySql, limit: 5000 }, { signal: controller.signal })
      if (data.data.success) {
        updateTab({ result: data.data, history: [{ sql: querySql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...activeTab.history.slice(0, 49)] })
        setPage(0)
      } else { updateTab({ error: data.data.error || 'Erro desconhecido' }) }
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED') { updateTab({ error: t('query.cancelledByUser') }) }
      else { updateTab({ error: err.response?.data?.error || err.message }) }
    }
    clearInterval(timer); updateTab({ loading: false }); setAbortController(null)
  }

  const execute = () => runQuery(activeTab.sql)
  const executeSelected = (sel: string) => runQuery(sel)
  const stopExecution = () => { abortController?.abort(); setAbortController(null) }

  // Explain
  const explainQuery = async () => {
    if (!activeTab.connectionId || !activeTab.sql.trim()) return
    const connObj = connections.find(c => c.id === activeTab.connectionId)
    const prefix = connObj?.dbType === 'sqlserver' ? 'SET SHOWPLAN_TEXT ON;\n' : 'EXPLAIN '
    const explainSql = connObj?.dbType === 'sqlserver' ? `SET SHOWPLAN_TEXT ON; ${activeTab.sql}` : `EXPLAIN ${activeTab.sql}`
    await runQuery(explainSql)
  }

  // Format SQL
  const formatSql = () => {
    try {
      const formatted = formatSQL(activeTab.sql, { language: 'transactsql', tabWidth: 2, keywordCase: 'upper' })
      updateTab({ sql: formatted })
    } catch {}
  }

  // Tab operations
  const addTab = () => {
    const id = Date.now().toString()
    const newTab = createTab(id)
    newTab.title = `Query ${tabs.length + 1}`
    newTab.connectionId = activeTab.connectionId
    setTabs([...tabs, newTab]); setActiveTabId(newTab.id)
  }
  const closeTab = (id: string) => {
    if (tabs.length === 1) return
    const idx = tabs.findIndex(t => t.id === id)
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) setActiveTabId(newTabs[Math.min(idx, newTabs.length - 1)].id)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) { e.preventDefault(); execute() }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); explainQuery() }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); formatSql() }
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); addTab() }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); closeTab(activeTabId) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab.sql, activeTab.connectionId, activeTabId, tabs])

  const connObj = connections.find(c => c.id === activeTab.connectionId)
  const connMode = connObj?.mode

  // Pagination
  const allRows = activeTab.result?.rows || []
  const totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE)
  const pagedRows = allRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
  const headers = allRows.length > 0 ? Object.keys(allRows[0]) : []

  // Column resize
  const startColResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX; const startW = colWidths[col] || 150
    const onMove = (ev: MouseEvent) => { setColWidths(w => ({ ...w, [col]: Math.max(60, startW + ev.clientX - startX) })) }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ─── History Sidebar ─── */}
      {showHistory && (
        <div className="w-72 border-r border-border bg-white dark:bg-gray-900/80 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Histórico & Salvos</h3>
            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-surface-active rounded"><X className="w-3.5 h-3.5 text-text-tertiary" /></button>
          </div>
          {/* Saved */}
          {savedQueries.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide px-1 mb-1">⭐ Salvos</p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {savedQueries.map(q => (
                  <div key={q.id} onClick={() => updateTab({ sql: q.sql })} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-surface-elevated rounded cursor-pointer group">
                    <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-text-primary font-medium truncate">{q.name}</p>
                      <p className="text-[10px] text-text-tertiary font-mono truncate">{q.sql.slice(0, 50)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeSavedQuery(q.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 text-text-tertiary hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Session History */}
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide px-1 mb-1">🕐 Sessão</p>
            <div className="space-y-0.5">
              {activeTab.history.map((h, i) => (
                <div key={i} onClick={() => updateTab({ sql: h.sql })} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-surface-elevated rounded cursor-pointer group">
                  <FileText className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-text-secondary font-mono truncate group-hover:text-text-primary">{h.sql.slice(0, 60)}</p>
                    <p className="text-[9px] text-text-tertiary">{h.time} • {h.duration}ms</p>
                  </div>
                </div>
              ))}
              {activeTab.history.length === 0 && <p className="text-[10px] text-text-tertiary px-2 py-4 text-center">Nenhuma query executada ainda</p>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-900 border-b border-border px-1">
          <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition whitespace-nowrap ${
                  tab.id === activeTabId
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-surface font-medium'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-surface-elevated'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tab.loading ? 'bg-amber-500 animate-pulse' : tab.error ? 'bg-red-500' : tab.result ? 'bg-green-500' : 'bg-gray-400'}`} />
                {tab.title}
                {tabs.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }} className="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addTab} className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-surface-elevated rounded ml-1" title="Nova aba (Ctrl+T)">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-white dark:bg-gray-900/95 shadow-sm overflow-visible relative z-50">
          <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 rounded-md transition ${showHistory ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-surface-active'}`} title="Histórico">
            <History className="w-4 h-4" />
          </button>
          <ToolbarSep />
          <SearchableSelect value={activeTab.connectionId} onChange={(v) => updateTab({ connectionId: v })} placeholder={t('common.select') + '...'} options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.environment})` }))} className="min-w-[200px]" />
          {connMode && <span className={`text-[10px] px-2 py-0.5 rounded border ${connMode === 'readonly' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'}`}>{connMode}</span>}
          <ToolbarSep />

          {activeTab.loading ? (
            <button onClick={stopExecution} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition active:scale-95">
              <Square className="w-3.5 h-3.5 fill-current" /> Parar{activeTab.elapsed > 0 ? ` (${activeTab.elapsed}s)` : ''}
            </button>
          ) : (
            <button onClick={execute} disabled={!activeTab.connectionId} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded-lg transition active:scale-95">
              <Play className="w-3.5 h-3.5" /> Executar
            </button>
          )}

          <button onClick={explainQuery} disabled={!activeTab.connectionId} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-100 dark:bg-purple-900/20 hover:bg-purple-200 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-lg border border-purple-200 dark:border-purple-800 transition disabled:opacity-40" title="Explain Plan (Ctrl+Shift+E)">
            <Zap className="w-3.5 h-3.5" /> Explain
          </button>

          <ToolbarSep />

          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-gray-100/80 dark:bg-gray-800/50 rounded-lg border border-border/50">
            <ToolbarBtn icon={AlignLeft} label="Formatar SQL (Ctrl+Shift+F)" onClick={formatSql} disabled={!activeTab.sql.trim()} />
            <ToolbarSep />
            <ToolbarBtn icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={() => editorCmds?.undo()} disabled={!editorCmds} />
            <ToolbarBtn icon={Redo2} label="Refazer (Ctrl+Y)" onClick={() => editorCmds?.redo()} disabled={!editorCmds} />
            <ToolbarSep />
            <ToolbarBtn icon={Search} label="Buscar (Ctrl+F)" onClick={() => editorCmds?.search()} disabled={!editorCmds} />
            <ToolbarBtn icon={CaseUpper} label="UPPERCASE (Ctrl+Shift+U)" onClick={() => editorCmds?.uppercase()} disabled={!editorCmds} />
            <ToolbarBtn icon={CaseLower} label="lowercase (Ctrl+Shift+L)" onClick={() => editorCmds?.lowercase()} disabled={!editorCmds} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSaveDialogOpen(true)} disabled={!activeTab.sql.trim()} className="p-1.5 text-text-tertiary hover:text-amber-500 rounded-md transition disabled:opacity-30" title="Salvar query">
              <Star className="w-4 h-4" />
            </button>
            <button onClick={() => setShowShortcuts(!showShortcuts)} className="p-1.5 text-text-tertiary hover:text-text-primary rounded-md transition" title="Atalhos">
              <Keyboard className="w-4 h-4" />
            </button>
            {activeTab.result?.rows?.length > 0 && <ExportMenu rows={activeTab.result.rows} />}
            {activeTab.result && <span className="text-[10px] text-text-tertiary flex items-center gap-1"><Clock className="w-3 h-3" />{activeTab.result.durationMs}ms • {activeTab.result.rows?.length || 0} rows</span>}
          </div>
        </div>

        {/* Shortcuts overlay */}
        {showShortcuts && (
          <div className="absolute top-24 right-4 z-50 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl p-4 w-72">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-text-primary">⌨️ Atalhos</h4>
              <button onClick={() => setShowShortcuts(false)}><X className="w-4 h-4 text-text-tertiary" /></button>
            </div>
            <div className="space-y-1.5 text-[11px]">
              {[['F5 / Ctrl+Enter', 'Executar query'], ['Ctrl+Shift+E', 'Explain Plan'], ['Ctrl+Shift+F', 'Formatar SQL'], ['Ctrl+T', 'Nova aba'], ['Ctrl+W', 'Fechar aba'], ['Ctrl+Z / Y', 'Desfazer / Refazer'], ['Ctrl+F', 'Buscar'], ['Ctrl+/', 'Comentar linha']].map(([key, desc]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-text-secondary">{desc}</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-surface-elevated border border-border rounded text-[10px] font-mono text-text-tertiary">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save dialog */}
        {saveDialogOpen && (
          <div className="absolute top-24 right-16 z-50 bg-white dark:bg-surface border border-border rounded-xl shadow-2xl p-4 w-64">
            <h4 className="text-xs font-bold text-text-primary mb-2">⭐ Salvar Query</h4>
            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Nome da query..." className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-surface-elevated border border-border rounded-lg text-text-primary mb-2" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setSaveDialogOpen(false)} className="flex-1 px-2 py-1.5 text-xs text-text-secondary bg-gray-100 dark:bg-surface-elevated rounded-lg">Cancelar</button>
              <button onClick={() => { saveQuery(saveName || 'Query sem nome', activeTab.sql, activeTab.connectionId); setSaveDialogOpen(false); setSaveName('') }} className="flex-1 px-2 py-1.5 text-xs text-white bg-blue-600 rounded-lg">Salvar</button>
            </div>
          </div>
        )}

        {/* Editor + Results with resizable split */}
        <div className="flex-1 flex flex-col min-h-0" ref={splitRef}>
          {/* Editor */}
          <div style={{ height: `${splitPos}%` }} className="min-h-[100px] relative">
            <SqlEditor value={activeTab.sql} onChange={(v) => updateTab({ sql: v })} onExecute={execute} onExecuteSelected={executeSelected} onViewReady={setEditorCmds} placeholder="SELECT * FROM tabela LIMIT 100;" completions={completions} dbType={connObj?.dbType} />
          </div>

          {/* Drag handle */}
          <div onMouseDown={startDrag} className="h-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-row-resize flex items-center justify-center transition-colors group border-y border-border/50">
            <div className="flex gap-0.5">
              <div className="w-6 h-0.5 rounded bg-gray-400 dark:bg-gray-600 group-hover:bg-white" />
            </div>
          </div>

          {/* Results */}
          <div style={{ height: `${100 - splitPos}%` }} className="min-h-[100px] flex flex-col overflow-hidden bg-white dark:bg-background">
            {/* Results toolbar */}
            {(activeTab.result || activeTab.error) && !activeTab.error && activeTab.result?.rows?.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center bg-gray-200/50 dark:bg-gray-800 rounded-md p-0.5">
                  <button onClick={() => setResultView('grid')} className={`px-2 py-0.5 text-[10px] rounded transition ${resultView === 'grid' ? 'bg-white dark:bg-surface shadow text-text-primary font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}>Grid</button>
                  <button onClick={() => setResultView('json')} className={`px-2 py-0.5 text-[10px] rounded transition ${resultView === 'json' ? 'bg-white dark:bg-surface shadow text-text-primary font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}>JSON</button>
                  <button onClick={() => setResultView('chart')} className={`px-2 py-0.5 text-[10px] rounded transition ${resultView === 'chart' ? 'bg-white dark:bg-surface shadow text-text-primary font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}>Chart</button>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-surface-elevated">
                      <ChevronLeft className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <span className="text-[10px] text-text-secondary">{page + 1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-surface-elevated">
                      <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <span className="text-[10px] text-text-tertiary ml-1">({allRows.length} total)</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {/* Error */}
              {activeTab.error && (
                <div className={`m-4 p-4 rounded-xl flex items-start gap-3 ${
                  activeTab.error.includes('WHERE') || activeTab.error.includes('bloqueada')
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${activeTab.error.includes('WHERE') ? 'text-amber-500' : 'text-red-500'}`} />
                  <div>
                    <p className={`text-sm font-medium ${activeTab.error.includes('WHERE') ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                      {activeTab.error.includes('WHERE') ? t('query.securityProtection') : t('query.executionError')}
                    </p>
                    <pre className="text-xs whitespace-pre-wrap mt-1 text-red-600 dark:text-red-300/80">{activeTab.error}</pre>
                  </div>
                </div>
              )}

              {/* Grid view */}
              {activeTab.result?.rows?.length > 0 && resultView === 'grid' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                      <tr>
                        <th className="py-2 px-2 text-text-tertiary font-medium border-b border-r border-border/50 w-10 text-[10px]">#</th>
                        {headers.map(col => (
                          <th key={col} style={{ width: colWidths[col] ? colWidths[col] + 'px' : 'auto', minWidth: '60px' }}
                            className="text-left py-2 px-3 text-text-secondary font-semibold border-b border-border whitespace-nowrap text-[11px] relative group">
                            {col}
                            <div onMouseDown={(e) => startColResize(col, e)}
                              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                          <td className="py-1.5 px-2 text-text-tertiary text-[10px] font-mono text-right border-r border-border/30 w-10">{page * ROWS_PER_PAGE + i + 1}</td>
                          {Object.entries(row).map(([key, val]: [string, any], j: number) => (
                            <td key={j} style={{ width: colWidths[key] ? colWidths[key] + 'px' : 'auto' }}
                              className="py-1.5 px-3 text-text-primary font-mono whitespace-nowrap max-w-xs truncate cursor-default"
                              onDoubleClick={() => navigator.clipboard.writeText(String(val ?? ''))}>
                              {val === null ? <span className="text-text-tertiary italic">NULL</span> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* JSON view */}
              {activeTab.result?.rows?.length > 0 && resultView === 'json' && (
                <pre className="p-4 text-xs font-mono text-text-secondary overflow-auto whitespace-pre">{JSON.stringify(pagedRows, null, 2)}</pre>
              )}

              {/* Chart view */}
              {activeTab.result?.rows?.length > 0 && resultView === 'chart' && (
                <div className="p-4">
                  <div className="bg-gray-50 dark:bg-surface-elevated rounded-xl p-6 border border-border">
                    <p className="text-xs text-text-secondary mb-3">Visualização básica dos dados numéricos:</p>
                    <div className="flex items-end gap-1 h-40">
                      {allRows.slice(0, 50).map((row: any, i: number) => {
                        const numCols = headers.filter(h => typeof row[h] === 'number')
                        const val = numCols.length > 0 ? Number(row[numCols[0]]) : 0
                        const max = Math.max(...allRows.slice(0, 50).map((r: any) => numCols.length > 0 ? Number(r[numCols[0]]) || 0 : 0), 1)
                        return <div key={i} className="flex-1 bg-blue-500 dark:bg-blue-600 rounded-t min-w-[3px] transition-all hover:bg-blue-400" style={{ height: `${(val / max) * 100}%` }} title={`${val}`} />
                      })}
                    </div>
                    {headers.filter(h => typeof allRows[0]?.[h] === 'number').length === 0 && (
                      <p className="text-center text-text-tertiary text-xs mt-4">Nenhuma coluna numérica encontrada para gráfico</p>
                    )}
                  </div>
                </div>
              )}

              {/* Empty results */}
              {activeTab.result && activeTab.result.rows?.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-sm text-text-secondary">✓ Query executada com sucesso</p>
                  <p className="text-xs text-text-tertiary mt-1">{activeTab.result.rowsAffected ?? 0} linhas afetadas • {activeTab.result.durationMs}ms</p>
                </div>
              )}

              {/* Empty state */}
              {!activeTab.result && !activeTab.error && !activeTab.loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Database className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-text-secondary">{t('query.executeToSeeResults')}</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-surface-elevated rounded border border-border text-[10px] font-mono">F5</kbd> ou
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-surface-elevated rounded border border-border text-[10px] font-mono ml-1">Ctrl+Enter</kbd> para executar
                    </p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {activeTab.loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-xs text-text-secondary">Executando... {activeTab.elapsed > 0 && `${activeTab.elapsed}s`}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
