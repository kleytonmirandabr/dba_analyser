import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Code2, ChevronDown, ChevronRight } from 'lucide-react'
import { ObjectDiff } from './types'
import SmartSideBySide from './SmartSideBySide'
import UnifiedDiffView from './UnifiedDiffView'

export default function ObjectsSection({ objects, type }: { objects: ObjectDiff[]; type: string }) {
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
