import { useState, useEffect } from 'react'
import { GitCompareArrows, Plus, Minus, AlertTriangle, Loader2, Table2, Code2, Eye, Zap, Database, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; environment: string; databaseName: string; dbType: string; }

interface ColumnDiff { column: string; field: string; sourceValue: string; targetValue: string; }
interface TableDiff { name: string; status: string; columnsOnlyInSource: string[]; columnsOnlyInTarget: string[]; columnDifferences: ColumnDiff[]; indexesOnlyInSource: string[]; indexesOnlyInTarget: string[]; }
interface ObjectDiff { name: string; status: string; sourceDefinition?: string; targetDefinition?: string; }
interface FullDiff {
  summary: { tables: number; columns: number; triggers: number; procedures: number; functions: number; views: number; indexes: number; total: number };
  tables: TableDiff[]; triggers: ObjectDiff[]; procedures: ObjectDiff[]; functions: ObjectDiff[]; views: ObjectDiff[];
}

export default function ComparePage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [schema, setSchema] = useState('')
  const [diff, setDiff] = useState<FullDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'tables' | 'triggers' | 'procedures' | 'functions' | 'views'>('tables')

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data.filter((c: any) => c.databaseName))).catch(() => {})
  }, [])

  const compare = async () => {
    if (!sourceId || !targetId) return
    setLoading(true); setError(''); setDiff(null)
    try {
      const payload: any = { sourceId, targetId }
      if (schema) payload.schema = schema
      const { data } = await api.post('/api/compare', payload)
      setDiff(data.data)
    } catch (err: any) { setError(err.response?.data?.error || err.message) }
    setLoading(false)
  }

  const tabs = [
    { id: 'tables' as const, label: 'Tabelas', icon: Table2, count: diff?.summary.tables || 0 },
    { id: 'triggers' as const, label: 'Triggers', icon: Zap, count: diff?.summary.triggers || 0 },
    { id: 'procedures' as const, label: 'Procedures', icon: Code2, count: diff?.summary.procedures || 0 },
    { id: 'functions' as const, label: 'Functions', icon: Code2, count: diff?.summary.functions || 0 },
    { id: 'views' as const, label: 'Views', icon: Eye, count: diff?.summary.views || 0 },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <GitCompareArrows className="w-6 h-6 text-purple-400" /> Comparador de Schemas
      </h1>

      {/* Selectors */}
      <div className="flex items-end gap-4 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase">Source</label>
          <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            value={sourceId} onChange={e => setSourceId(e.target.value)}>
            <option value="">Selecione...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.databaseName})</option>)}
          </select>
        </div>
        <GitCompareArrows className="w-6 h-6 text-gray-600 mb-2" />
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase">Target</label>
          <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Selecione...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.databaseName})</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase">Schema</label>
          <input className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" 
            value={schema} onChange={e => setSchema(e.target.value)} placeholder="auto" />
        </div>
        <button onClick={compare} disabled={loading || !sourceId || !targetId}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
          Comparar
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

      {diff && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Total', value: diff.summary.total, color: diff.summary.total > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Tabelas', value: diff.summary.tables, color: 'text-blue-400' },
              { label: 'Colunas', value: diff.summary.columns, color: 'text-purple-400' },
              { label: 'Triggers', value: diff.summary.triggers, color: 'text-yellow-400' },
              { label: 'Procedures', value: diff.summary.procedures, color: 'text-orange-400' },
              { label: 'Views', value: diff.summary.views, color: 'text-cyan-400' },
            ].map(s => (
              <div key={s.label} className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {diff.summary.total === 0 ? (
            <div className="p-8 bg-green-900/10 border border-green-800/30 rounded-xl text-center">
              <p className="text-green-400 text-lg font-semibold">✅ Schemas idênticos</p>
              <p className="text-sm text-gray-500 mt-1">Nenhuma diferença encontrada</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-lg border border-gray-800">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                    {tab.count > 0 && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
                  </button>
                ))}
              </div>

              {/* Content */}
              {activeTab === 'tables' && <TablesSection tables={diff.tables} />}
              {activeTab === 'triggers' && <ObjectsSection objects={diff.triggers} type="Trigger" />}
              {activeTab === 'procedures' && <ObjectsSection objects={diff.procedures} type="Procedure" />}
              {activeTab === 'functions' && <ObjectsSection objects={diff.functions} type="Function" />}
              {activeTab === 'views' && <ObjectsSection objects={diff.views} type="View" />}
            </>
          )}
        </>
      )}
    </div>
  )
}

function TablesSection({ tables }: { tables: TableDiff[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'only_source': return { text: 'Só no Source', cls: 'bg-green-900/30 text-green-400 border-green-800' }
      case 'only_target': return { text: 'Só no Target', cls: 'bg-red-900/30 text-red-400 border-red-800' }
      case 'different': return { text: 'Diferente', cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' }
      default: return { text: s, cls: 'bg-gray-800 text-gray-400 border-gray-700' }
    }
  }

  return (
    <div className="space-y-2">
      {tables.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Nenhuma diferença de tabelas</p>}
      {tables.map(table => {
        const st = statusLabel(table.status)
        const isExpanded = expanded.has(table.name)
        const hasDiffs = table.status === 'different'
        return (
          <div key={table.name} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <button onClick={() => hasDiffs && toggle(table.name)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/50 transition">
              {hasDiffs ? (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />) : <div className="w-4" />}
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-mono text-white flex-1">{table.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${st.cls}`}>{st.text}</span>
            </button>
            {isExpanded && hasDiffs && (
              <div className="px-4 pb-3 border-t border-gray-800 pt-3 space-y-2">
                {table.columnsOnlyInSource.map(c => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <Plus className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Coluna <code className="font-mono">{c}</code> só no source</span>
                  </div>
                ))}
                {table.columnsOnlyInTarget.map(c => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <Minus className="w-3 h-3 text-red-400" />
                    <span className="text-red-400">Coluna <code className="font-mono">{c}</code> só no target</span>
                  </div>
                ))}
                {table.columnDifferences.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-400">
                      <code className="font-mono">{d.column}</code>.{d.field}: <span className="text-green-300">{d.sourceValue}</span> → <span className="text-red-300">{d.targetValue}</span>
                    </span>
                  </div>
                ))}
                {table.indexesOnlyInSource.map(idx => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Plus className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Índice <code className="font-mono">{idx}</code> só no source</span>
                  </div>
                ))}
                {table.indexesOnlyInTarget.map(idx => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Minus className="w-3 h-3 text-red-400" />
                    <span className="text-red-400">Índice <code className="font-mono">{idx}</code> só no target</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DiffView({ source, target }: { source?: string; target?: string }) {
  const srcLines = (source || '').split('\n')
  const tgtLines = (target || '').split('\n')

  // Simple LCS-based line diff
  const diff = computeLineDiff(srcLines, tgtLines)

  return (
    <div className="font-mono text-[11px] max-h-80 overflow-auto rounded border border-gray-800 bg-gray-950">
      {diff.map((line, i) => (
        <div key={i} className={`flex ${line.type === 'add' ? 'bg-green-900/20' : line.type === 'remove' ? 'bg-red-900/20' : line.type === 'changed' ? 'bg-yellow-900/15' : ''}`}>
          <span className={`w-5 text-center select-none shrink-0 border-r border-gray-800 ${line.type === 'add' ? 'text-green-500 bg-green-900/30' : line.type === 'remove' ? 'text-red-500 bg-red-900/30' : line.type === 'changed' ? 'text-yellow-500 bg-yellow-900/20' : 'text-gray-600'}`}>
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'changed' ? '~' : ' '}
          </span>
          <pre className={`px-2 py-0.5 whitespace-pre-wrap flex-1 ${line.type === 'add' ? 'text-green-300' : line.type === 'remove' ? 'text-red-300' : line.type === 'changed' ? 'text-yellow-300' : 'text-gray-400'}`}>{line.text}</pre>
        </div>
      ))}
    </div>
  )
}

interface DiffLine { type: 'same' | 'add' | 'remove' | 'changed'; text: string; }

function computeLineDiff(src: string[], tgt: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const maxLen = Math.max(src.length, tgt.length)
  
  // Use simple sequential comparison with context
  // For each line: if same -> same, if different -> show both
  const srcSet = new Set(src.map(s => s.trim().toLowerCase()))
  const tgtSet = new Set(tgt.map(s => s.trim().toLowerCase()))
  
  // Mark lines unique to source (removed) and target (added)
  for (const line of src) {
    const norm = line.trim().toLowerCase()
    if (!norm) continue
    if (!tgtSet.has(norm)) {
      result.push({ type: 'remove', text: line })
    }
  }
  for (const line of tgt) {
    const norm = line.trim().toLowerCase()
    if (!norm) continue
    if (!srcSet.has(norm)) {
      result.push({ type: 'add', text: line })
    }
  }

  if (result.length === 0) {
    result.push({ type: 'same', text: '(nenhuma diferença significativa)' })
  }
  
  return result
}

function ObjectsSection({ objects, type }: { objects: ObjectDiff[]; type: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (name: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'only_source': return { text: 'Só no Source', cls: 'bg-green-900/30 text-green-400 border-green-800' }
      case 'only_target': return { text: 'Só no Target', cls: 'bg-red-900/30 text-red-400 border-red-800' }
      case 'different': return { text: 'Código diferente', cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' }
      default: return { text: s, cls: '' }
    }
  }

  return (
    <div className="space-y-2">
      {objects.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Nenhuma diferença de {type.toLowerCase()}s</p>}
      {objects.map(obj => {
        const st = statusLabel(obj.status)
        const isExpanded = expanded.has(obj.name)
        return (
          <div key={obj.name} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <button onClick={() => toggle(obj.name)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/50 transition">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-mono text-white flex-1">{obj.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${st.cls}`}>{st.text}</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3 border-t border-gray-800 pt-3">
                {obj.status === 'different' ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-gray-500 uppercase font-medium">Linhas diferentes (- source / + target)</p>
                    <DiffView source={obj.sourceDefinition} target={obj.targetDefinition} />
                    <details className="mt-2">
                      <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300">Ver código completo lado a lado</summary>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <p className="text-[10px] text-green-400 font-medium mb-1 uppercase">Source</p>
                          <pre className="text-[11px] text-gray-300 font-mono bg-green-900/10 border border-green-900/20 rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap">{obj.sourceDefinition || '(vazio)'}</pre>
                        </div>
                        <div>
                          <p className="text-[10px] text-red-400 font-medium mb-1 uppercase">Target</p>
                          <pre className="text-[11px] text-gray-300 font-mono bg-red-900/10 border border-red-900/20 rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap">{obj.targetDefinition || '(vazio)'}</pre>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  <pre className="text-[11px] text-gray-400 font-mono bg-gray-800 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                    {obj.sourceDefinition || obj.targetDefinition || '(sem definição)'}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

