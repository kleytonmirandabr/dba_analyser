import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Clock, Play, AlertTriangle, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth.store'

interface ExecRequest {
  id: string; status: string; sqlText: string; description?: string; rollbackSql?: string;
  requestedAt: string; approvedAt?: string; executedAt?: string; executionDurationMs?: number; errorMessage?: string;
  connection?: { id: string; name: string; environment: string };
  requestedBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string };
}

export default function ExecutionPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<ExecRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const { user } = useAuthStore()

  const load = async () => {
    try {
      const params = filter ? `?status=${filter}` : ''
      const { data } = await api.get(`/api/execution${params}`)
      setRequests(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const approve = async (id: string) => { await api.post(`/api/execution/${id}/approve`); load() }
  const reject = async (id: string) => { if (confirm(t('executions.confirmReject'))) { await api.post(`/api/execution/${id}/reject`); load() } }
  const execute = async (id: string) => { if (confirm('Executar este SQL no banco?')) { await api.post(`/api/execution/${id}/execute`); load() } }

  const statusBadge = (s: string) => {
    const map: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800', icon: Clock },
      approved: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800', icon: CheckCircle2 },
      rejected: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', icon: XCircle },
      executed: { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', icon: CheckCircle2 },
      failed: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', icon: AlertTriangle },
    }
    const { color, icon: Icon } = map[s] || map.pending
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${color}`}><Icon className="w-3 h-3" />{s.toUpperCase()}</span>
  }

  const canApprove = user?.role === 'admin' || user?.role === 'dba'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{t('executions.title')}</h1>
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'executed', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-active'}`}>
              {f || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : (
        <div className="space-y-3">
          {requests.length === 0 && <p className="text-text-tertiary text-center py-12">{t('executions.noRequests')}</p>}
          {requests.map(req => (
            <div key={req.id} className="p-4 bg-surface border border-border rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusBadge(req.status)}
                  <span className="text-xs text-text-tertiary">{req.connection?.name} ({req.connection?.environment})</span>
                </div>
                <span className="text-[10px] text-gray-600">{new Date(req.requestedAt).toLocaleString('pt-BR')}</span>
              </div>
              {req.description && <p className="text-xs text-text-secondary mb-2">{req.description}</p>}
              <pre className="text-xs font-mono text-green-300 bg-background p-3 rounded-lg overflow-x-auto mb-2">{req.sqlText}</pre>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">Por: {req.requestedBy?.name} {req.approvedBy ? `| Aprovado: ${req.approvedBy.name}` : ''} {req.executionDurationMs ? `| ${req.executionDurationMs}ms` : ''}</span>
                {canApprove && (
                  <div className="flex gap-2">
                    {req.status === 'pending' && <>
                      <button onClick={() => approve(req.id)} className="px-2.5 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg">Aprovar</button>
                      <button onClick={() => reject(req.id)} className="px-2.5 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg">Rejeitar</button>
                    </>}
                    {req.status === 'approved' && <button onClick={() => execute(req.id)} className="px-2.5 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg flex items-center gap-1"><Play className="w-3 h-3" />Executar</button>}
                  </div>
                )}
              </div>
              {req.errorMessage && <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-400">{req.errorMessage}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
