import { AlertTriangle, CheckCircle } from 'lucide-react'

export default function AlertMessage({ message, lastChecked }: { message: string | null | undefined; lastChecked?: string | null }) {
  if (!message) return <p className="text-[11px] text-text-tertiary">Aguardando primeira verificação...</p>

  // Try parsing as JSON (multi-db result)
  try {
    const parsed = JSON.parse(message)
    if (parsed.details && Array.isArray(parsed.details)) {
      const problems = parsed.details.filter((d: any) => d.status !== 'ok')
      const total = parsed.details.length

      if (problems.length === 0) {
        return (
          <p className="text-[11px] text-green-400/70">
            ✅ Todos os {total} bancos OK
            {lastChecked && <span className="text-gray-600 ml-2">• {new Date(lastChecked).toLocaleString()}</span>}
          </p>
        )
      }

      const MAX_VISIBLE = 15
      const showAll = problems.length <= MAX_VISIBLE
      const visible = showAll ? problems : problems.slice(0, MAX_VISIBLE)

      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-text-secondary">
            <span className="text-red-600 dark:text-red-400 font-semibold">{problems.length} de {total} bancos com problema</span>
            {lastChecked && <span className="text-text-tertiary ml-2">• {new Date(lastChecked).toLocaleString()}</span>}
          </p>
          <div className="flex flex-wrap gap-1">
            {visible.map((d: any) => (
              <span key={d.database} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                d.status === 'triggered'
                  ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
                  : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/40 text-red-700 dark:text-red-300'
              }`}>
                {d.status === 'triggered' ? '⚠' : '✕'} {d.database}
              </span>
            ))}
            {!showAll && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-text-secondary font-medium">
                +{problems.length - MAX_VISIBLE} mais
              </span>
            )}
          </div>
        </div>
      )
    }
  } catch {}

  // Plain text message (single connection)
  return (
    <p className="text-[11px] text-text-tertiary">
      {message}
      {lastChecked && <span className="text-gray-600 ml-2">• Último check: {new Date(lastChecked).toLocaleString()}</span>}
    </p>
  )
}


