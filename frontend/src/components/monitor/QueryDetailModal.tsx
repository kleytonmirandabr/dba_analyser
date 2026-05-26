import { useState } from 'react'
import { Activity, X, Copy, Check, ExternalLink } from 'lucide-react'

interface ActiveQuery { pid: number; username: string; database: string; state: string; query: string; durationMs: number; waitEvent?: string; connId?: string; connName?: string }

interface Props {
  query: ActiveQuery
  onClose: () => void
  formatMs: (ms: number) => string
}

export default function QueryDetailModal({ query, onClose, formatMs }: Props) {
  const [copied, setCopied] = useState(false)

  const copyQuery = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInQueryEditor = () => {
    sessionStorage.setItem('dba_prefill_query', query.query)
    sessionStorage.setItem('dba_prefill_connId', query.connId || '')
    window.location.href = '/query'
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-green-400" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Query Detalhada</h3>
              <p className="text-[10px] text-text-tertiary">PID {query.pid} • {query.username} • {query.connName} • {formatMs(query.durationMs)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => copyQuery(query.query)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-active border border-border rounded-lg text-xs text-text-secondary transition">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={openInQueryEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white transition">
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir no Editor
            </button>
            <button onClick={onClose} className="p-1.5 text-text-muted hover:text-gray-900 dark:hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[60vh]">
          <div className="flex mb-3 gap-4 text-xs">
            <span className="text-text-tertiary">Estado: <span className={`${query.state === 'running' ? 'text-green-400' : 'text-text-secondary'}`}>{query.state}</span></span>
            {query.waitEvent && <span className="text-text-tertiary">Wait: <span className="text-amber-400">{query.waitEvent}</span></span>}
          </div>
          <pre className="text-sm text-text-primary font-mono bg-background border border-border rounded-lg p-4 whitespace-pre-wrap break-words leading-relaxed">
            {query.query}
          </pre>
        </div>
      </div>
    </div>
  )
}
