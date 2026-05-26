import { useState, useEffect, useRef } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Play, Square, Download, Clock, AlertCircle, Database, Loader2, FileText, MessageSquareCode, Search, CaseUpper, CaseLower, Undo2, Redo2, FoldVertical, UnfoldVertical, Copy, Table2, FileSpreadsheet, FileJson, FileType, ChevronDown, RotateCcw, Columns3, Hash, WrapText, Maximize2, Minimize2 } from 'lucide-react'
import api from '../lib/api'
import SqlEditor, { EditorCommands } from '../components/editor/SqlEditor'

interface Connection { id: string; name: string; environment: string; mode: string; dbType: string; }

function ToolbarBtn({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => setShow(true), 400)
  }
  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShow(false)
  }

  // Parse label: "Name (Shortcut)"
  const match = label.match(/^(.+?)\s*\((.+)\)$/)
  const name = match ? match[1] : label
  const shortcut = match ? match[2] : null

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="p-1.5 rounded-md transition-all duration-150 text-text-secondary hover:text-text-primary hover:bg-surface-active active:scale-90 active:bg-blue-900/40 disabled:opacity-30 disabled:pointer-events-none"
      >
        <Icon className="w-4 h-4" />
      </button>
      {show && (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
            <span className="text-[11px] text-text-primary font-medium">{name}</span>
            {shortcut && <kbd className="text-[10px] px-1.5 py-0.5 bg-surface border border-gray-600 rounded text-text-secondary font-mono">{shortcut}</kbd>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-surface-elevated border-b border-r border-border rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  )
}

// === Export Menu ===
function ExportMenu({ rows }: { rows: any[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const headers = Object.keys(rows[0] || {})
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const exportCSV = () => {
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = r[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(','))
    ].join('\n')
    download(csv, `query_${timestamp}.csv`, 'text/csv;charset=utf-8')
  }

  const exportTSV = () => {
    const tsv = [headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t'))].join('\n')
    download(tsv, `query_${timestamp}.txt`, 'text/plain;charset=utf-8')
  }

  const exportJSON = () => {
    download(JSON.stringify(rows, null, 2), `query_${timestamp}.json`, 'application/json')
  }

  const exportSQL = () => {
    const tableName = 'query_result'
    const inserts = rows.map(r => {
      const vals = headers.map(h => {
        const v = r[h]
        if (v === null) return 'NULL'
        if (typeof v === 'number') return String(v)
        return `'${String(v).replace(/'/g, "''")}'`
      })
      return `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${vals.join(', ')});`
    })
    download(inserts.join('\n'), `query_${timestamp}.sql`, 'text/plain;charset=utf-8')
  }

  const exportMarkdown = () => {
    const md = [
      '| ' + headers.join(' | ') + ' |',
      '| ' + headers.map(() => '---').join(' | ') + ' |',
      ...rows.map(r => '| ' + headers.map(h => String(r[h] ?? '')).join(' | ') + ' |')
    ].join('\n')
    download(md, `query_${timestamp}.md`, 'text/markdown;charset=utf-8')
  }

  const exportExcel = () => {
    // Generate XML Spreadsheet (opens in Excel without libraries)
    const xmlRows = rows.map(r =>
      '<Row>' + headers.map(h => {
        const v = r[h]
        if (v === null || v === undefined) return '<Cell><Data ss:Type="String"></Data></Cell>'
        if (typeof v === 'number') return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
        return `<Cell><Data ss:Type="String">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`
      }).join('') + '</Row>'
    )
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Query Result">
<Table>
<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${xmlRows.join('\n')}
</Table>
</Worksheet>
</Workbook>`
    download(xml, `query_${timestamp}.xls`, 'application/vnd.ms-excel')
  }

  const copyToClipboard = () => {
    const tsv = [headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t'))].join('\n')
    navigator.clipboard.writeText(tsv)
    setOpen(false)
  }

  const items = [
    { icon: FileSpreadsheet, label: 'Excel (.xls)', desc: 'Abre direto no Excel/LibreOffice', fn: exportExcel },
    { icon: Table2, label: 'CSV (.csv)', desc: t('query.csvDesc'), fn: exportCSV },
    { icon: FileType, label: 'Texto (.txt)', desc: 'Separado por tab (TSV)', fn: exportTSV },
    { icon: FileJson, label: 'JSON (.json)', desc: 'Array de objetos', fn: exportJSON },
    { icon: Database, label: 'SQL INSERTs (.sql)', desc: 'Gera INSERT para cada linha', fn: exportSQL },
    { icon: FileType, label: 'Markdown (.md)', desc: 'Tabela formatada em MD', fn: exportMarkdown },
    { icon: Copy, label: 'Copiar (Clipboard)', desc: 'Cola direto no Excel/Sheets', fn: copyToClipboard },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-elevated hover:bg-surface-active text-text-secondary text-xs rounded-lg border border-border transition">
        <Download className="w-3.5 h-3.5" />
        Exportar
        <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-72 bg-surface border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden max-h-[400px] overflow-y-auto">
          <p className="px-3 py-1.5 text-[10px] text-text-tertiary font-medium uppercase tracking-wide">Exportar {rows.length} linhas como</p>
          {items.map((item, i) => (
            <button key={i} onClick={item.fn}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-elevated transition text-left">
              <item.icon className="w-4 h-4 text-text-tertiary" />
              <div>
                <p className="text-xs text-text-primary font-medium">{item.label}</p>
                <p className="text-[10px] text-text-tertiary">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5" />
}

export default function QueryPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [sql, setSql] = useState('SELECT 1;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [history, setHistory] = useState<{ sql: string; time: string; duration: number }[]>([])
  const [completions, setCompletions] = useState<{ tables: { name: string; columns: string[] }[] } | undefined>(undefined)
  const [editorCmds, setEditorCmds] = useState<EditorCommands | null>(null)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data)
      const prefillConn = sessionStorage.getItem('dba_prefill_connId')
      if (prefillConn) {
        setSelectedConn(prefillConn)
        sessionStorage.removeItem('dba_prefill_connId')
      }
    }).catch(() => {})
    const prefillConn2 = sessionStorage.getItem('dba_prefill_connId') || ''
    if (prefillConn2) {
      api.get(`/api/explorer/${prefillConn2}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
    }
    const prefillQuery = sessionStorage.getItem('dba_prefill_query')
    if (prefillQuery) {
      setSql(prefillQuery)
      sessionStorage.removeItem('dba_prefill_query')
    }
  }, [])

  useEffect(() => {
    if (!selectedConn) { setCompletions(undefined); return }
    api.get(`/api/explorer/${selectedConn}/completions?schema=public`).then(r => setCompletions(r.data.data)).catch(() => {})
  }, [selectedConn])

  const runQuery = async (querySql: string) => {
    if (!selectedConn || !querySql.trim()) return
    const controller = new AbortController()
    setAbortController(controller)
    setLoading(true); setError(''); setResult(null); setElapsed(0)

    // Timer to show elapsed time
    const startTime = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)

    try {
      const { data } = await api.post(`/api/query/${selectedConn}/execute`, { sql: querySql, limit: 500 }, { signal: controller.signal })
      if (data.data.success) {
        setResult(data.data)
        setHistory(h => [{ sql: querySql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...h.slice(0, 19)])
      } else {
        setError(data.data.error || 'Erro desconhecido')
      }
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
        setError(t('query.cancelledByUser'))
      } else {
        setError(err.response?.data?.error || err.message)
      }
    }
    clearInterval(timer)
    setLoading(false)
    setAbortController(null)
  }

  const execute = () => runQuery(sql)
  const executeSelected = (selectedSql: string) => runQuery(selectedSql)

  const stopExecution = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  const connObj = connections.find(c => c.id === selectedConn)
  const connMode = connObj?.mode



  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-toolbar-bg backdrop-blur">
        {/* Connection selector */}
        <SearchableSelect
          value={selectedConn}
          onChange={setSelectedConn}
          placeholder={t('common.select') + '...'}
          options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.environment})` }))}
          className="min-w-[200px]"
        />
        {connMode && <span className={`text-[10px] px-2 py-0.5 rounded border ${connMode === 'readonly' ? 'bg-amber-900/20 text-amber-400 border-amber-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>{connMode}</span>}
        
        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Execute / Stop button */}
        {loading ? (
          <button onClick={stopExecution}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-text-primary text-sm font-medium rounded-lg transition active:scale-95">
            <Square className="w-3.5 h-3.5 fill-current" />
            Parar{elapsed > 0 ? ` (${elapsed}s)` : ''}
          </button>
        ) : (
          <button onClick={execute} disabled={!selectedConn}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-text-primary text-sm font-medium rounded-lg transition active:scale-95">
            <Play className="w-3.5 h-3.5" />
            Executar
          </button>
        )}

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Editor action buttons */}
        <div className="flex items-center gap-0.5 px-1 py-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg border border-border/50">
          <ToolbarBtn icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={() => editorCmds?.undo()} disabled={!editorCmds} />
          <ToolbarBtn icon={Redo2} label="Refazer (Ctrl+Y)" onClick={() => editorCmds?.redo()} disabled={!editorCmds} />
          <ToolbarSep />
          <ToolbarBtn icon={MessageSquareCode} label="Comentar/Descomentar (Ctrl+/)" onClick={() => editorCmds?.comment()} disabled={!editorCmds} />
          <ToolbarBtn icon={Search} label="Buscar e Substituir (Ctrl+F)" onClick={() => editorCmds?.search()} disabled={!editorCmds} />
          <ToolbarSep />
          <ToolbarBtn icon={CaseUpper} label="UPPERCASE seleção (Ctrl+Shift+U)" onClick={() => editorCmds?.uppercase()} disabled={!editorCmds} />
          <ToolbarBtn icon={CaseLower} label="lowercase seleção (Ctrl+Shift+L)" onClick={() => editorCmds?.lowercase()} disabled={!editorCmds} />
          <ToolbarSep />
          <ToolbarBtn icon={FoldVertical} label="Colapsar blocos" onClick={() => editorCmds?.foldAll()} disabled={!editorCmds} />
          <ToolbarBtn icon={UnfoldVertical} label="Expandir blocos" onClick={() => editorCmds?.unfoldAll()} disabled={!editorCmds} />
        </div>

        {/* Right side: results info + export */}
        <div className="ml-auto flex items-center gap-2">
          {result?.rows?.length > 0 && <ExportMenu rows={result.rows} />}
          {result && <span className="text-xs text-text-tertiary flex items-center gap-1"><Clock className="w-3 h-3" />{result.durationMs}ms • {result.rows?.length || 0} rows</span>}
        </div>
      </div>

      {/* Editor + Results */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-1/3 min-h-[150px] border-b border-border">
          <SqlEditor 
            value={sql} 
            onChange={setSql} 
            onExecute={execute} 
            onExecuteSelected={executeSelected} 
            onViewReady={setEditorCmds}
            placeholder="SELECT * FROM tabela LIMIT 100;" 
            completions={completions} 
            dbType={connObj?.dbType} 
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto bg-background">
          {error && (
            <div className={`m-4 p-4 rounded-lg flex items-start gap-3 ${
              (error as string).includes('WHERE') || (error as string).includes('bloqueada')
                ? 'bg-amber-900/20 border border-amber-700'
                : 'bg-red-900/20 border border-red-800'
            }`}>
              <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                (error as string).includes('WHERE') || (error as string).includes('bloqueada')
                  ? 'text-amber-400' : 'text-red-400'
              }`} />
              <div>
                <p className={`text-sm font-medium ${
                  (error as string).includes('WHERE') || (error as string).includes('bloqueada')
                    ? 'text-amber-300' : 'text-red-400'
                }`}>{(error as string).includes('WHERE') ? t('query.securityProtection') : t('query.executionError')}</p>
                <pre className="text-xs text-text-secondary whitespace-pre-wrap mt-1">{error}</pre>
                {(error as string).includes('WHERE') && (
                  <p className="text-xs text-text-secondary mt-2 border-t border-border pt-2">
                    💡 <strong>Dica:</strong> Adicione uma cláusula WHERE para limitar as linhas afetadas. 
                    Exemplo: <code className="px-1 py-0.5 bg-surface-elevated rounded text-amber-300">WHERE id = 123</code>
                  </p>
                )}
              </div>
            </div>
          )}
          {result?.rows && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr>
                    <th className="py-2 px-2 text-gray-600 font-medium border-b border-border border-r border-border/50 w-10 text-[10px]">#</th>
                    {Object.keys(result.rows[0]).map(col => (
                    <th key={col} className="text-left py-2 px-3 text-text-secondary font-medium border-b border-border whitespace-nowrap">{col}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {result.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-900/50 hover:bg-gray-800/40 group">
                      <td className="py-1.5 px-2 text-gray-600 text-[10px] font-mono text-right border-r border-border/50 select-none w-10">{i + 1}</td>
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="py-1.5 px-3 text-text-secondary font-mono whitespace-nowrap max-w-xs truncate cursor-default"
                          onDoubleClick={() => navigator.clipboard.writeText(String(val ?? ''))}>
                          {val === null ? <span className="text-gray-600 italic">NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result && result.rows?.length === 0 && (
            <div className="p-4 text-sm text-text-tertiary">Query executada com sucesso. {result.rowsAffected ?? 0} rows afetadas.</div>
          )}
          {!result && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Database className="w-12 h-12 text-gray-800 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">{t('query.executeToSeeResults')}</p>
                <p className="text-xs text-gray-700">{t('query.placeholder')} <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded border border-border text-text-secondary text-[10px]">Ctrl+Enter</kbd></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History panel */}
      {history.length > 0 && (
        <div className="h-24 border-t border-border overflow-y-auto bg-gray-900/80 p-2">
          <p className="text-[10px] text-gray-600 mb-1 font-medium uppercase tracking-wide">Histórico da sessão</p>
          {history.map((h, i) => (
            <div key={i} onClick={() => setSql(h.sql)} className="flex items-center gap-2 px-2 py-1 hover:bg-surface-elevated rounded cursor-pointer text-xs group">
              <FileText className="w-3 h-3 text-gray-600 group-hover:text-blue-400" />
              <span className="text-text-secondary font-mono truncate flex-1 group-hover:text-text-primary">{h.sql.slice(0, 80)}</span>
              <span className="text-gray-600">{h.duration}ms</span>
              <span className="text-gray-700">{h.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}