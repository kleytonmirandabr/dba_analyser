import { useState, useMemo } from 'react'
import { Filter } from 'lucide-react'
import { computeAlignedDiff, computeWordHighlights } from './DiffAlgorithm'

export default function UnifiedDiffView({ source, target }: { source: string; target: string }) {
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
            const sign = type === 'add' || type === 'changed-tgt' ? '+' : type === 'remove' || type === 'changed-src' ? '−' : ' '
            const signClass = type === 'add' || type === 'changed-tgt' ? 'text-green-400' : type === 'remove' || type === 'changed-src' ? 'text-red-400' : 'text-gray-700'
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
