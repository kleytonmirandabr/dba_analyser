import { useTranslation } from 'react-i18next'
import { useState, useMemo, useRef, useCallback } from 'react'
import { ArrowDown, ArrowUp, Filter, Maximize2, Minimize2 } from 'lucide-react'
import { computeAlignedDiff, computeWordHighlights } from './DiffAlgorithm'

export default function SmartSideBySide({ source, target }: { source: string; target: string }) {
  const { t } = useTranslation()
  const srcLines = source.split('\n')
  const tgtLines = target.split('\n')
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false)
  const [currentDiffIdx, setCurrentDiffIdx] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const diffRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

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

  const jumpToDiff = useCallback((direction: 'next' | 'prev') => {
    if (totalDiffs === 0) return
    let next = direction === 'next' ? currentDiffIdx + 1 : currentDiffIdx - 1
    if (next >= totalDiffs) next = 0
    if (next < 0) next = totalDiffs - 1
    setCurrentDiffIdx(next)
    const el = diffRefs.current[diffIndices[next]]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentDiffIdx, totalDiffs, diffIndices])

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
      if (h.start > lastEnd) parts.push(<span key={`pre-${i}`} className={baseClass}>{text.substring(lastEnd, h.start)}</span>)
      parts.push(<span key={`hl-${i}`} className={highlightClass}>{text.substring(h.start, h.end)}</span>)
      lastEnd = h.end
    })
    if (lastEnd < text.length) parts.push(<span key="end" className={baseClass}>{text.substring(lastEnd)}</span>)
    return <>{parts}</>
  }

  const wrapperClass = isFullscreen ? 'fixed inset-0 z-50 bg-background flex flex-col' : 'relative'

  return (
    <div className={wrapperClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-elevated border-b border-border rounded-t-lg sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-tertiary font-medium">
            {totalDiffs} {totalDiffs === 1 ? t('compare.difference') : t('compare.differences2')} {t('compare.differencesFound')}
          </span>
          {totalDiffs > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => jumpToDiff('prev')} className="p-1 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition" title={t('compare.previousDiff')}>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-text-tertiary min-w-[3rem] text-center">{currentDiffIdx + 1}/{totalDiffs}</span>
              <button onClick={() => jumpToDiff('next')} className="p-1 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition" title={t('compare.nextDiff')}>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border transition ${showOnlyDiffs ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'border-border text-text-tertiary hover:text-text-secondary hover:border-gray-600'}`}>
            <Filter className="w-3 h-3" /> {t('compare.onlyDifferences')}
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-surface rounded text-text-tertiary hover:text-text-primary transition border border-border" title={isFullscreen ? t('compare.exitFullscreen') : t('compare.fullscreen')}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-2 border-b border-border sticky top-[41px] z-10 bg-surface">
        <div className="px-3 py-1.5 border-r border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-semibold text-green-400 uppercase">{t('compare.source')}</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{srcLines.length} {t('compare.lines')}</span>
          </div>
        </div>
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase">{t('compare.target')}</span>
            <span className="text-[10px] text-text-tertiary ml-auto">{tgtLines.length} {t('compare.lines')}</span>
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
