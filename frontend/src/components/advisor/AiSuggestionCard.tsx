import { Copy, Check, Zap, Database, Settings, FileCode, Lightbulb } from 'lucide-react'
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

const impactLabels = { high: 'Alto', medium: 'Médio', low: 'Baixo' }

export default function AiSuggestionCard({ suggestion }: { suggestion: Suggestion }) {
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
    <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${impactColors[suggestion.impact]}`}>
              <Zap className="w-2.5 h-2.5 inline mr-0.5" />
              {impactLabels[suggestion.impact]}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{suggestion.description}</p>
          {suggestion.sql && (
            <div className="mt-2 relative">
              <pre className="text-[11px] font-mono bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
                {suggestion.sql}
              </pre>
              <button onClick={copySQL}
                className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
