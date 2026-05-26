import { Copy, Check, Zap, Database, Settings, FileCode, Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

interface Suggestion {
  type: 'index' | 'rewrite' | 'config' | 'schema' | 'general'
  title: string
  description: string
  sql?: string
  impact: 'high' | 'medium' | 'low'
}

const typeIcons = {
  index: Database,
  rewrite: FileCode,
  config: Settings,
  schema: Database,
  general: Lightbulb,
}

const impactColors = {
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
}

export default function AiSuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const { t } = useTranslation()
  const impactLabels = { high: t('advisor.impactHigh'), medium: t('advisor.impactMedium'), low: t('advisor.impactLow') }
  const [copied, setCopied] = useState(false)
  const Icon = typeIcons[suggestion.type] || Lightbulb

  const copySQL = () => {
    if (suggestion.sql) {
      navigator.clipboard.writeText(suggestion.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-4 bg-surface border border-border rounded-xl">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-surface-elevated rounded-lg">
          <Icon className="w-4 h-4 text-text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-text-primary">{suggestion.title}</h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${impactColors[suggestion.impact]}`}>
              <Zap className="w-2.5 h-2.5 inline mr-0.5" />
              {impactLabels[suggestion.impact]}
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{suggestion.description}</p>
          {suggestion.sql && (
            <div className="mt-2 relative">
              <pre className="text-[11px] font-mono bg-background border border-border rounded-lg p-3 overflow-x-auto text-text-secondary">
                {suggestion.sql}
              </pre>
              <button onClick={copySQL}
                className="absolute top-2 right-2 p-1.5 bg-surface-elevated border border-border rounded-md hover:bg-surface-hover transition">
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-text-secondary" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
