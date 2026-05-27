import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { GitCompareArrows, Plus, Minus, AlertTriangle, Loader2, Table2, Code2, Eye, Zap, Database, ChevronDown, ChevronRight, ArrowDown, ArrowUp, Filter, Maximize2, Minimize2 } from 'lucide-react'
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
  const { t } = useTranslation()
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
      <h1 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
        <GitCompareArrows className="w-6 h-6 text-purple-400" /> Comparador de Schemas
      </h1>

      {/* Selectors */}
      <div className="flex items-end gap-4 mb-6 p-4 bg-surface border border-border rounded-xl">
        <div className="flex-1">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Source</label>
          <SearchableSelect
            value={sourceId}
            onChange={setSourceId}
            placeholder={t('common.select') + '...'}
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.databaseName})` }))}
          />
        </div>
        <GitCompareArrows className="w-6 h-6 text-gray-600 mb-2" />
        <div className="flex-1">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Target</label>
          <SearchableSelect
            value={targetId}
            onChange={setTargetId}
            placeholder={t('common.select') + '...'}
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.databaseName})` }))}
          />
        </div>
        <div className="w-32">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Schema</label>
          <input className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" 
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
              <div key={s.label} className="p-3 bg-surface border border-border rounded-lg text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-text-tertiary">{s.label}</p>
              </div>
            ))}
          </div>

          {diff.summary.total === 0 ? (
            <div className="p-8 bg-green-900/10 border border-green-800/30 rounded-xl text-center">
              <p className="text-green-400 text-lg font-semibold">✅ Schemas idênticos</p>
              <p className="text-sm text-text-tertiary mt-1">{t('compare.noDifferences')}</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-surface p-1 rounded-lg border border-border">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-white hover:bg-surface-elevated'}`}>
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
  const { t } = useTranslation()
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
      case 'only_source': return { text: t('compare.onlySource'), cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' }
      case 'only_target': return { text: t('compare.onlyTarget'), cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' }
      case 'different': return { text: 'Diferente', cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' }
      default: return { text: s, cls: 'bg-surface-elevated text-text-secondary border-border' }
    }
  }

  return (
    <div className="space-y-2">
      {tables.length === 0 && <p className="text-text-tertiary text-sm text-center py-8">{t('compare.noTableDiff')}</p>}
      {tables.map(table => {
        const st = statusLabel(table.status)
        const isExpanded = expanded.has(table.name)
        const hasDiffs = table.status === 'different'
        return (
          <div key={table.name} className="bg-surface border border-border rounded-lg overflow-hidden">
            <button onClick={() => hasDiffs && toggle(table.name)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100/50 dark:bg-gray-800/50 transition">
              {hasDiffs ? (isExpanded ? <ChevronDown className="w-4 h-4 text-text-tertiary" /> : <ChevronRight className="w-4 h-4 text-text-tertiary" />) : <div className="w-4" />}
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-mono text-text-primary flex-1">{table.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${st.cls}`}>{st.text}</span>
            </button>
            {isExpanded && hasDiffs && (
              <div className="px-4 pb-3 border-t border-border pt-3 space-y-2">
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

// ============================================================
// DIFF ALGORITHM - LCS-based with word-level highlighting
// ============================================================

interface DiffLine {
  type: 'same' | 'add' | 'remove' | 'changed-src' | 'changed-tgt'
  srcNum?: number
  tgtNum?: number
  text: string
  highlights?: { start: number; end: number }[]
}

interface AlignedPair {
  type: 'same' | 'add' | 'remove' | 'changed'
  srcIdx?: number
  tgtIdx?: number
}

// Simple but effective diff: find matching lines and align them
function computeAlignedDiff(srcLines: string[], tgtLines: string[]): AlignedPair[] {
  const n = srcLines.length, m = tgtLines.length
  
  // For very large files, use a simpler O(n+m) approach with hashing
  if (n > 2000 || m > 2000) {
    return simpleDiff(srcLines, tgtLines)
  }

  // LCS via Hunt-Szymanski for medium files
  // Build a map of tgt line -> indices
  const tgtMap = new Map<string, number[]>()
  for (let j = 0; j < m; j++) {
    const key = tgtLines[j].trim()
    if (!tgtMap.has(key)) tgtMap.set(key, [])
    tgtMap.get(key)!.push(j)
  }

  // Simple O(nm) LCS for files up to 2000 lines
  // We'll use a space-optimized version
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (srcLines[i-1].trim() === tgtLines[j-1].trim()) {
        dp[i][j] = dp[i-1][j-1] + 1
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
      }
    }
  }

  // Backtrack to find aligned pairs
  const pairs: AlignedPair[] = []
  let i = n, j = m
  const lcsReverse: AlignedPair[] = []
  
  while (i > 0 && j > 0) {
    if (srcLines[i-1].trim() === tgtLines[j-1].trim()) {
      lcsReverse.push({ type: 'same', srcIdx: i-1, tgtIdx: j-1 })
      i--; j--
    } else if (dp[i-1][j] >= dp[i][j-1]) {
      lcsReverse.push({ type: 'remove', srcIdx: i-1 })
      i--
    } else {
      lcsReverse.push({ type: 'add', tgtIdx: j-1 })
      j--
    }
  }
  while (i > 0) { lcsReverse.push({ type: 'remove', srcIdx: i-1 }); i-- }
  while (j > 0) { lcsReverse.push({ type: 'add', tgtIdx: j-1 }); j-- }

  const aligned = lcsReverse.reverse()

  // Post-process: convert adjacent remove+add pairs into 'changed' pairs
  const result: AlignedPair[] = []
  let idx = 0
  while (idx < aligned.length) {
    if (aligned[idx].type === 'remove' && idx + 1 < aligned.length && aligned[idx+1].type === 'add') {
      result.push({ type: 'changed', srcIdx: aligned[idx].srcIdx, tgtIdx: aligned[idx+1].tgtIdx })
      idx += 2
    } else if (aligned[idx].type === 'add' && idx + 1 < aligned.length && aligned[idx+1].type === 'remove') {
      result.push({ type: 'changed', srcIdx: aligned[idx+1].srcIdx, tgtIdx: aligned[idx].tgtIdx })
      idx += 2
    } else {
      result.push(aligned[idx])
      idx++
    }
  }

  return result
}

function simpleDiff(srcLines: string[], tgtLines: string[]): AlignedPair[] {
  // For very large files, just compare line by line
  const result: AlignedPair[] = []
  const maxLen = Math.max(srcLines.length, tgtLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < srcLines.length && i < tgtLines.length) {
      if (srcLines[i].trim() === tgtLines[i].trim()) {
        result.push({ type: 'same', srcIdx: i, tgtIdx: i })
      } else {
        result.push({ type: 'changed', srcIdx: i, tgtIdx: i })
      }
    } else if (i < srcLines.length) {
      result.push({ type: 'remove', srcIdx: i })
    } else {
      result.push({ type: 'add', tgtIdx: i })
    }
  }
  return result
}

// Word-level diff for highlighting exact changes within a line
function computeWordHighlights(srcLine: string, tgtLine: string): { srcHighlights: {start:number;end:number}[]; tgtHighlights: {start:number;end:number}[] } {
  // Tokenize by word boundaries but keep spacing
  const tokenize = (s: string) => {
    const tokens: { text: string; start: number }[] = []
    let i = 0
    while (i < s.length) {
      const start = i
      if (/\s/.test(s[i])) {
        while (i < s.length && /\s/.test(s[i])) i++
      } else if (/[\w@]/.test(s[i])) {
        while (i < s.length && /[\w@]/.test(s[i])) i++
      } else {
        while (i < s.length && !/[\s\w@]/.test(s[i])) i++
      }
      tokens.push({ text: s.substring(start, i), start })
    }
    return tokens
  }

  const srcTokens = tokenize(srcLine)
  const tgtTokens = tokenize(tgtLine)
  
  // LCS on tokens
  const n = srcTokens.length, m = tgtTokens.length
  if (n === 0 && m === 0) return { srcHighlights: [], tgtHighlights: [] }
  if (n > 200 || m > 200) {
    // Too many tokens, highlight entire lines
    return { 
      srcHighlights: [{ start: 0, end: srcLine.length }], 
      tgtHighlights: [{ start: 0, end: tgtLine.length }] 
    }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (srcTokens[i-1].text === tgtTokens[j-1].text) {
        dp[i][j] = dp[i-1][j-1] + 1
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
      }
    }
  }

  // Find which tokens are NOT in LCS
  const srcInLcs = new Set<number>()
  const tgtInLcs = new Set<number>()
  let si = n, ti = m
  while (si > 0 && ti > 0) {
    if (srcTokens[si-1].text === tgtTokens[ti-1].text) {
      srcInLcs.add(si-1); tgtInLcs.add(ti-1)
      si--; ti--
    } else if (dp[si-1][ti] >= dp[si][ti-1]) {
      si--
    } else {
      ti--
    }
  }

  const srcHighlights: {start:number;end:number}[] = []
  const tgtHighlights: {start:number;end:number}[] = []

  for (let i = 0; i < srcTokens.length; i++) {
    if (!srcInLcs.has(i) && srcTokens[i].text.trim()) {
      srcHighlights.push({ start: srcTokens[i].start, end: srcTokens[i].start + srcTokens[i].text.length })
    }
  }
  for (let i = 0; i < tgtTokens.length; i++) {
    if (!tgtInLcs.has(i) && tgtTokens[i].text.trim()) {
      tgtHighlights.push({ start: tgtTokens[i].start, end: tgtTokens[i].start + tgtTokens[i].text.length })
    }
  }

  // Merge adjacent highlights
  const merge = (hl: {start:number;end:number}[]) => {
    if (hl.length <= 1) return hl
    const merged: {start:number;end:number}[] = [hl[0]]
    for (let i = 1; i < hl.length; i++) {
      const last = merged[merged.length - 1]
      if (hl[i].start <= last.end + 1) {
        last.end = Math.max(last.end, hl[i].end)
      } else {
        merged.push(hl[i])
      }
    }
    return merged
  }

  return { srcHighlights: merge(srcHighlights), tgtHighlights: merge(tgtHighlights) }
}

// ============================================================
// SMART SIDE-BY-SIDE VIEW
// ============================================================

function SmartSideBySide({ source, target }: { source: string; target: string }) {
  const srcLines = source.split('\n')
  const tgtLines = target.split('\n')
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false)
  const [currentDiffIdx, setCurrentDiffIdx] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const diffRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const aligned = useMemo(() => computeAlignedDiff(srcLines, tgtLines), [source, target])
  
  // Compute word-level highlights for changed lines
  const highlights = useMemo(() => {
    const map = new Map<number, { srcHighlights: {start:number;end:number}[]; tgtHighlights: {start:number;end:number}[] }>()
    aligned.forEach((pair, idx) => {
      if (pair.type === 'changed' && pair.srcIdx !== undefined && pair.tgtIdx !== undefined) {
        map.set(idx, computeWordHighlights(srcLines[pair.srcIdx], tgtLines[pair.tgtIdx]))
      }
    })
    return map
  }, [aligned, srcLines, tgtLines])

  const diffIndices = useMemo(() => aligned.map((p, i) => p.type !== 'same' ? i : -1).filter(i => i >= 0), [aligned])
  const totalDiffs = diffIndices.length

  const jumpToDiff = useCallback((direction: 'next' | 'prev') => {
    if (totalDiffs === 0) return
    let next = direction === 'next' ? currentDiffIdx + 1 : currentDiffIdx - 1
    if (next >= totalDiffs) next = 0
    if (next < 0) next = totalDiffs - 1
    setCurrentDiffIdx(next)
    const el = diffRefs.current[diffIndices[next]]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentDiffIdx, totalDiffs, diffIndices])

  // Context lines when filtering
  const CONTEXT_LINES = 3

  const visibleIndices = useMemo(() => {
    if (!showOnlyDiffs) return aligned.map((_, i) => i)
    const visible = new Set<number>()
    diffIndices.forEach(idx => {
      for (let c = Math.max(0, idx - CONTEXT_LINES); c <= Math.min(aligned.length - 1, idx + CONTEXT_LINES); c++) {
        visible.add(c)
      }
    })
    return Array.from(visible).sort((a, b) => a - b)
  }, [showOnlyDiffs, aligned, diffIndices])

  const renderHighlightedText = (text: string, highlights: {start:number;end:number}[], baseClass: string, highlightClass: string) => {
    if (!highlights || highlights.length === 0) return <span className={baseClass}>{text}</span>
    
    const parts: JSX.Element[] = []
    let lastEnd = 0
    highlights.forEach((h, i) => {
      if (h.start > lastEnd) {
        parts.push(<span key={`pre-${i}`} className={baseClass}>{text.substring(lastEnd, h.start)}</span>)
      }
      parts.push(<span key={`hl-${i}`} className={highlightClass}>{text.substring(h.start, h.end)}</span>)
      lastEnd = h.end
    })
    if (lastEnd < text.length) {
      parts.push(<span key="end" className={baseClass}>{text.substring(lastEnd)}</span>)
    }
    return <>{parts}</>
  }

  const wrapperClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-background flex flex-col' 
    : 'relative'

  return (
    <div className={wrapperClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-elevated border-b border-border rounded-t-lg sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-tertiary font-medium">
            {totalDiffs} {totalDiffs === 1 ? 'diferença' : 'diferenças'} encontrada{totalDiffs !== 1 ? 's' : ''}
          </span>
          {totalDiffs > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => jumpToDiff('prev')} className="p-1 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition" title="Diferença anterior">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-text-tertiary min-w-[3rem] text-center">{currentDiffIdx + 1}/{totalDiffs}</span>
              <button onClick={() => jumpToDiff('next')} className="p-1 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition" title="Próxima diferença">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border transition ${showOnlyDiffs ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'border-border text-text-tertiary hover:text-text-secondary hover:border-gray-600'}`}>
            <Filter className="w-3 h-3" /> Só diferenças
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition border border-border" title={isFullscreen ? "Sair fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-2 border-b border-border sticky top-[41px] z-10 bg-surface">
        <div className="px-3 py-1.5 border-r border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-semibold text-green-400 uppercase">Source</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{srcLines.length} linhas</span>
          </div>
        </div>
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase">Target</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{tgtLines.length} linhas</span>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div ref={containerRef} className={`overflow-auto font-mono text-[11px] leading-[18px] ${isFullscreen ? 'flex-1' : 'max-h-[600px]'}`}>
        {visibleIndices.map((idx, vi) => {
          const pair = aligned[idx]
          const isDiff = pair.type !== 'same'
          const isCurrentDiff = diffIndices[currentDiffIdx] === idx
          const prevVisible = vi > 0 ? visibleIndices[vi - 1] : idx - 1
          const hasGap = showOnlyDiffs && idx - prevVisible > 1

          return (
            <div key={idx}>
              {hasGap && (
                <div className="grid grid-cols-2 border-b border-border/30">
                  <div className="px-2 py-0.5 text-center text-[10px] text-text-tertiary bg-surface-elevated/50 border-r border-border/30">⋯</div>
                  <div className="px-2 py-0.5 text-center text-[10px] text-text-tertiary bg-surface-elevated/50">⋯</div>
                </div>
              )}
              <div 
                ref={el => { if (isDiff) diffRefs.current[idx] = el }}
                className={`grid grid-cols-2 border-b border-border/20 ${isCurrentDiff ? 'ring-1 ring-purple-500/50' : ''}`}
              >
                {/* Source side */}
                <div className={`flex border-r border-border/30 ${
                  pair.type === 'remove' ? 'bg-red-950/30' : 
                  pair.type === 'changed' ? 'bg-yellow-950/20' : 
                  pair.type === 'add' ? 'bg-gray-900/20' : ''
                }`}>
                  <span className={`w-10 text-right pr-2 select-none shrink-0 text-[10px] leading-[18px] ${
                    pair.type === 'remove' ? 'text-red-500/70 bg-red-950/40' : 
                    pair.type === 'changed' ? 'text-yellow-500/70 bg-yellow-950/30' : 
                    'text-gray-600 bg-gray-900/30'
                  } border-r border-border/20`}>
                    {pair.srcIdx !== undefined ? pair.srcIdx + 1 : ''}
                  </span>
                  <span className={`w-5 text-center select-none shrink-0 text-[10px] leading-[18px] ${
                    pair.type === 'remove' ? 'text-red-400 bg-red-950/50' : 
                    pair.type === 'changed' ? 'text-yellow-400 bg-yellow-950/40' : 
                    'text-gray-700'
                  }`}>
                    {pair.type === 'remove' ? '−' : pair.type === 'changed' ? '~' : ' '}
                  </span>
                  <pre className="px-2 whitespace-pre-wrap break-all flex-1 min-w-0">
                    {pair.srcIdx !== undefined ? (
                      pair.type === 'changed' && highlights.has(idx) ? (
                        renderHighlightedText(
                          srcLines[pair.srcIdx], 
                          highlights.get(idx)!.srcHighlights,
                          'text-text-secondary',
                          'bg-yellow-500/30 text-yellow-200 rounded-sm px-[1px] border-b border-yellow-500/50'
                        )
                      ) : (
                        <span className={`${pair.type === 'remove' ? 'text-red-300' : pair.type === 'changed' ? 'text-yellow-200' : 'text-text-secondary'}`}>
                          {srcLines[pair.srcIdx]}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-700 italic">⎯</span>
                    )}
                  </pre>
                </div>

                {/* Target side */}
                <div className={`flex ${
                  pair.type === 'add' ? 'bg-green-950/30' : 
                  pair.type === 'changed' ? 'bg-yellow-950/20' : 
                  pair.type === 'remove' ? 'bg-gray-900/20' : ''
                }`}>
                  <span className={`w-10 text-right pr-2 select-none shrink-0 text-[10px] leading-[18px] ${
                    pair.type === 'add' ? 'text-green-500/70 bg-green-950/40' : 
                    pair.type === 'changed' ? 'text-yellow-500/70 bg-yellow-950/30' : 
                    'text-gray-600 bg-gray-900/30'
                  } border-r border-border/20`}>
                    {pair.tgtIdx !== undefined ? pair.tgtIdx + 1 : ''}
                  </span>
                  <span className={`w-5 text-center select-none shrink-0 text-[10px] leading-[18px] ${
                    pair.type === 'add' ? 'text-green-400 bg-green-950/50' : 
                    pair.type === 'changed' ? 'text-yellow-400 bg-yellow-950/40' : 
                    'text-gray-700'
                  }`}>
                    {pair.type === 'add' ? '+' : pair.type === 'changed' ? '~' : ' '}
                  </span>
                  <pre className="px-2 whitespace-pre-wrap break-all flex-1 min-w-0">
                    {pair.tgtIdx !== undefined ? (
                      pair.type === 'changed' && highlights.has(idx) ? (
                        renderHighlightedText(
                          tgtLines[pair.tgtIdx], 
                          highlights.get(idx)!.tgtHighlights,
                          'text-text-secondary',
                          'bg-yellow-500/30 text-yellow-200 rounded-sm px-[1px] border-b border-yellow-500/50'
                        )
                      ) : (
                        <span className={`${pair.type === 'add' ? 'text-green-300' : pair.type === 'changed' ? 'text-yellow-200' : 'text-text-secondary'}`}>
                          {tgtLines[pair.tgtIdx]}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-700 italic">⎯</span>
                    )}
                  </pre>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// UNIFIED DIFF VIEW (improved)
// ============================================================

function UnifiedDiffView({ source, target }: { source: string; target: string }) {
  const srcLines = source.split('\n')
  const tgtLines = target.split('\n')
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(true)

  const aligned = useMemo(() => computeAlignedDiff(srcLines, tgtLines), [source, target])
  const highlights = useMemo(() => {
    const map = new Map<number, { srcHighlights: {start:number;end:number}[]; tgtHighlights: {start:number;end:number}[] }>()
    aligned.forEach((pair, idx) => {
      if (pair.type === 'changed' && pair.srcIdx !== undefined && pair.tgtIdx !== undefined) {
        map.set(idx, computeWordHighlights(srcLines[pair.srcIdx], tgtLines[pair.tgtIdx]))
      }
    })
    return map
  }, [aligned, srcLines, tgtLines])

  const diffIndices = useMemo(() => aligned.map((p, i) => p.type !== 'same' ? i : -1).filter(i => i >= 0), [aligned])
  const totalDiffs = diffIndices.length
  const CONTEXT = 3

  const visibleIndices = useMemo(() => {
    if (!showOnlyDiffs) return aligned.map((_, i) => i)
    const visible = new Set<number>()
    diffIndices.forEach(idx => {
      for (let c = Math.max(0, idx - CONTEXT); c <= Math.min(aligned.length - 1, idx + CONTEXT); c++) {
        visible.add(c)
      }
    })
    return Array.from(visible).sort((a, b) => a - b)
  }, [showOnlyDiffs, aligned, diffIndices])

  const renderHighlightedText = (text: string, hl: {start:number;end:number}[], baseClass: string, hlClass: string) => {
    if (!hl || hl.length === 0) return <span className={baseClass}>{text}</span>
    const parts: JSX.Element[] = []
    let lastEnd = 0
    hl.forEach((h, i) => {
      if (h.start > lastEnd) parts.push(<span key={`p${i}`} className={baseClass}>{text.substring(lastEnd, h.start)}</span>)
      parts.push(<span key={`h${i}`} className={hlClass}>{text.substring(h.start, h.end)}</span>)
      lastEnd = h.end
    })
    if (lastEnd < text.length) parts.push(<span key="e" className={baseClass}>{text.substring(lastEnd)}</span>)
    return <>{parts}</>
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 bg-surface-elevated border-b border-border rounded-t-lg">
        <span className="text-[11px] text-text-tertiary font-medium">{totalDiffs} diferença{totalDiffs !== 1 ? 's' : ''}</span>
        <button onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border transition ${showOnlyDiffs ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'border-border text-text-tertiary hover:text-text-secondary'}`}>
          <Filter className="w-3 h-3" /> Só diferenças
        </button>
      </div>
      <div className="overflow-auto font-mono text-[11px] leading-[18px] max-h-[500px] rounded-b-lg border border-t-0 border-border">
        {visibleIndices.map((idx, vi) => {
          const pair = aligned[idx]
          const prevVisible = vi > 0 ? visibleIndices[vi - 1] : idx - 1
          const hasGap = showOnlyDiffs && idx - prevVisible > 1

          const renderLine = (type: string, lineNum: number | undefined, text: string, hl?: {start:number;end:number}[]) => {
            const bgClass = type === 'add' ? 'bg-green-950/30' : type === 'remove' ? 'bg-red-950/30' : type === 'changed-src' ? 'bg-red-950/20' : type === 'changed-tgt' ? 'bg-green-950/20' : ''
            const numClass = type === 'add' || type === 'changed-tgt' ? 'text-green-500/70' : type === 'remove' || type === 'changed-src' ? 'text-red-500/70' : 'text-gray-600'
            const signClass = type === 'add' || type === 'changed-tgt' ? 'text-green-400' : type === 'remove' || type === 'changed-src' ? 'text-red-400' : 'text-gray-700'
            const sign = type === 'add' || type === 'changed-tgt' ? '+' : type === 'remove' || type === 'changed-src' ? '−' : ' '
            const textClass = type === 'add' || type === 'changed-tgt' ? 'text-green-300' : type === 'remove' || type === 'changed-src' ? 'text-red-300' : 'text-text-secondary'
            const hlClass = 'bg-yellow-500/40 text-yellow-100 rounded-sm px-[1px]'

            return (
              <div className={`flex ${bgClass} border-b border-border/10`}>
                <span className={`w-10 text-right pr-2 select-none shrink-0 text-[10px] leading-[18px] ${numClass} border-r border-border/20 bg-black/10`}>{lineNum !== undefined ? lineNum + 1 : ''}</span>
                <span className={`w-5 text-center select-none shrink-0 text-[10px] leading-[18px] ${signClass}`}>{sign}</span>
                <pre className="px-2 whitespace-pre-wrap break-all flex-1 min-w-0">
                  {hl && hl.length > 0 ? renderHighlightedText(text, hl, textClass, hlClass) : <span className={textClass}>{text}</span>}
                </pre>
              </div>
            )
          }

          return (
            <div key={idx}>
              {hasGap && <div className="px-2 py-0.5 text-center text-[10px] text-text-tertiary bg-surface-elevated/50 border-b border-border/30">⋯ ⋯ ⋯</div>}
              {pair.type === 'same' && renderLine('same', pair.srcIdx, srcLines[pair.srcIdx!])}
              {pair.type === 'remove' && renderLine('remove', pair.srcIdx, srcLines[pair.srcIdx!])}
              {pair.type === 'add' && renderLine('add', pair.tgtIdx, tgtLines[pair.tgtIdx!])}
              {pair.type === 'changed' && (
                <>
                  {renderLine('changed-src', pair.srcIdx, srcLines[pair.srcIdx!], highlights.get(idx)?.srcHighlights)}
                  {renderLine('changed-tgt', pair.tgtIdx, tgtLines[pair.tgtIdx!], highlights.get(idx)?.tgtHighlights)}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// OBJECTS SECTION (updated)
// ============================================================

function ObjectsSection({ objects, type }: { objects: ObjectDiff[]; type: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<Record<string, 'sidebyside' | 'unified'>>({})

  const toggle = (name: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const getViewMode = (name: string) => viewMode[name] || 'sidebyside'

  const statusLabel = (s: string) => {
    switch (s) {
      case 'only_source': return { text: t('compare.onlySource'), cls: 'bg-green-900/30 text-green-400 border-green-800' }
      case 'only_target': return { text: t('compare.onlyTarget'), cls: 'bg-red-900/30 text-red-400 border-red-800' }
      case 'different': return { text: t('compare.differentCode'), cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800' }
      default: return { text: s, cls: '' }
    }
  }

  return (
    <div className="space-y-2">
      {objects.length === 0 && <p className="text-text-tertiary text-sm text-center py-8">{t('compare.noTypeDiff')} {type.toLowerCase()}s</p>}
      {objects.map(obj => {
        const st = statusLabel(obj.status)
        const isExpanded = expanded.has(obj.name)
        const mode = getViewMode(obj.name)
        return (
          <div key={obj.name} className="bg-surface border border-border rounded-lg overflow-hidden">
            <button onClick={() => toggle(obj.name)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-elevated/50 transition">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-text-tertiary" /> : <ChevronRight className="w-4 h-4 text-text-tertiary" />}
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-mono text-text-primary flex-1">{obj.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${st.cls}`}>{st.text}</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                {obj.status === 'different' ? (
                  <div>
                    {/* View mode toggle */}
                    <div className="flex items-center justify-end mb-3">
                      <div className="flex bg-surface-elevated rounded-lg p-0.5 border border-border">
                        <button onClick={() => setViewMode(prev => ({ ...prev, [obj.name]: 'sidebyside' }))}
                          className={`px-3 py-1 text-[10px] font-medium rounded-md transition ${mode === 'sidebyside' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                          Lado a Lado
                        </button>
                        <button onClick={() => setViewMode(prev => ({ ...prev, [obj.name]: 'unified' }))}
                          className={`px-3 py-1 text-[10px] font-medium rounded-md transition ${mode === 'unified' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}>
                          Unificado
                        </button>
                      </div>
                    </div>

                    {mode === 'sidebyside' ? (
                      <SmartSideBySide source={obj.sourceDefinition || ''} target={obj.targetDefinition || ''} />
                    ) : (
                      <UnifiedDiffView source={obj.sourceDefinition || ''} target={obj.targetDefinition || ''} />
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] text-text-tertiary mb-1.5 uppercase font-medium">
                      {obj.status === 'only_source' ? 'Definição (existe apenas no source)' : 'Definição (existe apenas no target)'}
                    </p>
                    <div className={`font-mono text-[11px] rounded border ${obj.status === 'only_source' ? 'bg-green-900/10 border-green-900/20' : 'bg-red-900/10 border-red-900/20'} max-h-60 overflow-auto`}>
                      {(obj.sourceDefinition || obj.targetDefinition || t('compare.noDefinition')).split('\n').map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-10 text-right pr-2 select-none shrink-0 text-[10px] text-gray-600 border-r border-border/50 bg-black/20 leading-[18px]">{i + 1}</span>
                          <pre className="px-2 py-0 whitespace-pre-wrap text-text-secondary leading-[18px]">{line}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
