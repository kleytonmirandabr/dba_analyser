import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Shield, Download, Loader2, Filter } from 'lucide-react'
import api from '../lib/api'

interface AuditEntry {
  id: string; userId: string; action: string; connectionId?: string; targetObject?: string;
  sqlText?: string; result?: string; durationMs?: number; ipAddress?: string; createdAt: string;
  metadata?: any;
}

export default function AuditPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    const params = actionFilter ? `?action=${actionFilter}` : ''
    api.get(`/api/audit${params}`).then(r => setLogs(r.data.data)).catch(() => {}).finally(() => setLoading(false))
  }, [actionFilter])

  const exportCSV = () => {
    const headers = [t('audit.date'), t('audit.action'), t('audit.result'), t('audit.duration'), t('audit.ip'), t('audit.sql')]
    const csv = [headers.join(','), ...logs.map(l => [
      new Date(l.createdAt).toLocaleString('pt-BR'), l.action, l.result || '', l.durationMs || '', l.ipAddress || '', `"${(l.sqlText || '').replace(/"/g, '""').slice(0, 200)}"`
    ].join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit_log.csv'; a.click()
  }

  const actionColors: Record<string, string> = {
    QUERY: 'text-blue-400', EXECUTE: 'text-green-400', LOGIN: 'text-purple-400',
    APPROVE: 'text-emerald-400', REJECT: 'text-red-400', KILL: 'text-red-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Shield className="w-6 h-6 text-blue-500" />Audit Log</h1>
        <div className="flex items-center gap-3">
          <SearchableSelect
            value={actionFilter}
            onChange={setActionFilter}
            placeholder="Todas ações"
            searchable={false}
            options={[{ value: '', label: 'Todas ações' }, ...['QUERY', 'EXECUTE', 'LOGIN', 'APPROVE', 'REJECT', 'KILL'].map(a => ({ value: a, label: a }))]}
          />
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-active text-text-secondary text-xs rounded-lg"><Download className="w-3.5 h-3.5" />CSV</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">Data</th>
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">Ação</th>
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">Resultado</th>
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">Duração</th>
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">IP</th>
              <th className="text-left py-2.5 px-3 text-text-tertiary font-medium">SQL</th>
            </tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-200 dark:border-gray-900/50 hover:bg-gray-100/30 dark:bg-gray-900/30">
                  <td className="py-2 px-3 text-text-secondary whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                  <td className={`py-2 px-3 font-medium ${actionColors[log.action] || 'text-text-secondary'}`}>{log.action}</td>
                  <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${log.result === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : log.result === 'ERROR' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-surface-elevated text-text-secondary'}`}>{log.result || '-'}</span></td>
                  <td className="py-2 px-3 text-text-tertiary font-mono">{log.durationMs ? `${log.durationMs}ms` : '-'}</td>
                  <td className="py-2 px-3 text-gray-600 font-mono">{log.ipAddress || '-'}</td>
                  <td className="py-2 px-3 text-text-tertiary font-mono max-w-xs truncate">{log.sqlText?.slice(0, 60) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="p-6 text-center text-gray-600">{t('audit.noLogs')}</p>}
        </div>
      )}
    </div>
  )
}
