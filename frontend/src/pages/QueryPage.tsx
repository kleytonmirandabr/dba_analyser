import { useState, useEffect, useRef } from 'react'
import { Play, Download, Clock, AlertCircle, Database, Loader2, FileText, MessageSquareCode, Search, CaseUpper, CaseLower, Undo2, Redo2, FoldVertical, UnfoldVertical, Copy, Table2, FileSpreadsheet, FileJson, FileType, ChevronDown, RotateCcw, Columns3, Hash, WrapText, Maximize2, Minimize2 } from 'lucide-react'
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
        className="p-1.5 rounded-md transition-all duration-150 text-gray-400 hover:text-white hover:bg-gray-700 active:scale-90 active:bg-blue-900/40 disabled:opacity-30 disabled:pointer-events-none"
      >
        <Icon className="w-4 h-4" />
      </button>
      {show && (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
            <span className="text-[11px] text-gray-200 font-medium">{name}</span>
            {shortcut && <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-900 border border-gray-600 rounded text-gray-400 font-mono">{shortcut}</kbd>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-b border-r border-gray-700 rotate-45 -mt-1"></div>
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
    { icon: Table2, label: 'CSV (.csv)', desc: 'Separado por vírgula', fn: exportCSV },
    { icon: FileType, label: 'Texto (.txt)', desc: 'Separado por tab (TSV)', fn: exportTSV },
    { icon: FileJson, label: 'JSON (.json)', desc: 'Array de objetos', fn: exportJSON },
    { icon: Database, label: 'SQL INSERTs (.sql)', desc: 'Gera INSERT para cada linha', fn: exportSQL },
    { icon: FileType, label: 'Markdown (.md)', desc: 'Tabela formatada em MD', fn: exportMarkdown },
    { icon: Copy, label: 'Copiar (Clipboard)', desc: 'Cola direto no Excel/Sheets', fn: copyToClipboard },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition">
        <Download className="w-3.5 h-3.5" />
        Exportar
        <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">Exportar {rows.length} linhas como</p>
          {items.map((item, i) => (
            <button key={i} onClick={item.fn}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 transition text-left">
              <item.icon className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-200 font-medium">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
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
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [sql, setSql] = useState('SELECT 1;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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

  const execute = async () => {
    if (!selectedConn || !sql.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.post(`/api/query/${selectedConn}/execute`, { sql, limit: 500 })
      if (data.data.success) {
        setResult(data.data)
        setHistory(h => [{ sql: sql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...h.slice(0, 19)])
      } else {
        setError(data.data.error || 'Erro desconhecido')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }

  const executeSelected = async (selectedSql: string) => {
    if (!selectedConn || !selectedSql.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.post(`/api/query/${selectedConn}/execute`, { sql: selectedSql, limit: 500 })
      if (data.data.success) {
        setResult(data.data)
        setHistory(h => [{ sql: selectedSql.trim(), time: new Date().toLocaleTimeString(), duration: data.data.durationMs }, ...h.slice(0, 19)])
      } else {
        setError(data.data.error || 'Erro desconhecido')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }

  const connObj = connections.find(c => c.id === selectedConn)
  const connMode = connObj?.mode



  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        {/* Connection selector */}
        <select className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white min-w-[200px]"
          value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
          <option value="">Selecionar conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
        </select>
        {connMode && <span className={`text-[10px] px-2 py-0.5 rounded border ${connMode === 'readonly' ? 'bg-amber-900/20 text-amber-400 border-amber-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>{connMode}</span>}
        
        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Execute button */}
        <button onClick={execute} disabled={loading || !selectedConn}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition active:scale-95">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Executar
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Editor action buttons */}
        <div className="flex items-center gap-0.5 px-1 py-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
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
          {result && <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{result.durationMs}ms • {result.rows?.length || 0} rows</span>}
        </div>
      </div>

      {/* Editor + Results */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-1/3 min-h-[150px] border-b border-gray-800">
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
        <div className="flex-1 overflow-auto bg-gray-950">
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
                }`}>{(error as string).includes('WHERE') ? '🛡️ Proteção de Segurança' : 'Erro na execução'}</p>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap mt-1">{error}</pre>
                {(error as string).includes('WHERE') && (
                  <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
                    💡 <strong>Dica:</strong> Adicione uma cláusula WHERE para limitar as linhas afetadas. 
                    Exemplo: <code className="px-1 py-0.5 bg-gray-800 rounded text-amber-300">WHERE id = 123</code>
                  </p>
                )}
              </div>
            </div>
          )}
          {result?.rows && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr>
                    <th className="py-2 px-2 text-gray-600 font-medium border-b border-gray-800 border-r border-gray-800/50 w-10 text-[10px]">#</th>
                    {Object.keys(result.rows[0]).map(col => (
                    <th key={col} className="text-left py-2 px-3 text-gray-400 font-medium border-b border-gray-800 whitespace-nowrap">{col}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {result.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-900/50 hover:bg-gray-800/40 group">
                      <td className="py-1.5 px-2 text-gray-600 text-[10px] font-mono text-right border-r border-gray-800/50 select-none w-10">{i + 1}</td>
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="py-1.5 px-3 text-gray-300 font-mono whitespace-nowrap max-w-xs truncate cursor-default"
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
            <div className="p-4 text-sm text-gray-500">Query executada com sucesso. {result.rowsAffected ?? 0} rows afetadas.</div>
          )}
          {!result && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Database className="w-12 h-12 text-gray-800 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">Execute uma query para ver resultados</p>
                <p className="text-xs text-gray-700">Selecione uma conexão e pressione <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 text-[10px]">Ctrl+Enter</kbd></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History panel */}
      {history.length > 0 && (
        <div className="h-24 border-t border-gray-800 overflow-y-auto bg-gray-900/80 p-2">
          <p className="text-[10px] text-gray-600 mb-1 font-medium uppercase tracking-wide">Histórico da sessão</p>
          {history.map((h, i) => (
            <div key={i} onClick={() => setSql(h.sql)} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-xs group">
              <FileText className="w-3 h-3 text-gray-600 group-hover:text-blue-400" />
              <span className="text-gray-400 font-mono truncate flex-1 group-hover:text-gray-200">{h.sql.slice(0, 80)}</span>
              <span className="text-gray-600">{h.duration}ms</span>
              <span className="text-gray-700">{h.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}