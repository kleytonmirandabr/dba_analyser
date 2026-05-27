import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function HistoryPanel({ history, loading }: { history: any[]; loading: boolean }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'problems' | 'all'>('problems')

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />

  const filtered = filter === 'problems'
    ? history.filter((h: any) => h.status !== 'ok')
    : history

  const problemCount = history.filter(h => h.status !== 'ok').length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-tertiary font-medium">Histórico recente</p>
        <div className="flex bg-surface-elevated rounded-lg p-0.5 border border-border">
          <button onClick={() => setFilter('problems')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition ${filter === 'problems' ? 'bg-red-600/80 text-white' : 'text-text-secondary hover:text-white'}`}>
            Problemas ({problemCount})
          </button>
          <button onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition ${filter === 'all' ? 'bg-gray-600 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            Todos ({history.length})
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-green-400/70 py-3">{t('alerts.noIssuesHistory')}</p>
      ) : (
        <div className="space-y-1 max-h-[250px] overflow-y-auto">
          {filtered.slice(0, 50).map((h: any, i: number) => (
            <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${h.status !== 'ok' ? 'bg-red-950/20' : ''}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === 'ok' ? 'bg-green-400' : h.status === 'triggered' ? 'bg-amber-400' : 'bg-red-400'}`} />
              <span className="text-text-tertiary font-mono w-28 flex-shrink-0">{new Date(h.checkedAt).toLocaleString()}</span>
              <span className={`font-medium truncate ${h.status === 'ok' ? 'text-green-400/70' : h.status === 'triggered' ? 'text-amber-400' : 'text-red-400'}`}>{h.message}</span>
              <span className="text-gray-600 ml-auto flex-shrink-0">{h.executionMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Alert Message Component (shows ONLY problems) ──────────────────────────

