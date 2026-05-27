import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, AlertTriangle, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { TableDiff } from './types'

export default function TablesSection({ tables }: { tables: TableDiff[] }) {
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
