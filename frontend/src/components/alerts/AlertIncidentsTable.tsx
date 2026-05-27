import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Play, Edit, Trash2, Pause, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import api from '../../lib/api'

interface Props {
  alerts: any[]
  dashboard: any[]
  onEdit: (a: any) => void
  onTest: (id: string) => void
  onToggle: (a: any) => void
  onDelete: (id: string) => void
}

export default function AlertIncidentsTable({ alerts, dashboard, onEdit, onTest, onToggle, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [histories, setHistories] = useState<Record<string, any[]>>({})

  // Load history for each alert
  useEffect(() => {
    alerts.forEach(async (a) => {
      try {
        const { data } = await api.get(`/api/alerts/${a.id}`)
        if (data.data?.history) {
          setHistories(prev => ({ ...prev, [a.id]: data.data.history }))
        }
      } catch (e) {}
    })
  }, [alerts])

  // Separate: alerts with active problems vs resolved
  const activeAlerts = alerts.filter(a => a.currentStatus === 'triggered' || a.currentStatus === 'error')
  const resolvedAlerts = alerts.filter(a => a.currentStatus === 'ok' || a.currentStatus === 'unknown')

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    if (status === 'triggered') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
    return <XCircle className="w-3.5 h-3.5 text-red-500" />
  }

  const renderAlertGroup = (alert: any) => {
    const isExpanded = expanded[alert.id] !== false // default expanded for active
    const hist = (histories[alert.id] || [])
      .filter((h: any) => h.status === 'triggered' || h.status === 'error')
      .slice(0, 10)

    return (
      <div key={alert.id} className="bg-surface dark:bg-surface-elevated border border-border rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition" onClick={() => toggle(alert.id)}>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-text-tertiary" /> : <ChevronRight className="w-4 h-4 text-text-tertiary" />}
          <span className={`w-2.5 h-2.5 rounded-full ${
            alert.currentStatus === 'ok' ? 'bg-green-500' :
            alert.currentStatus === 'triggered' ? 'bg-amber-500 animate-pulse' :
            alert.currentStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-semibold text-text-primary flex-1">{alert.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
            alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
            alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
            'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
          }`}>{alert.severity}</span>
          <span className="text-[10px] text-text-tertiary ml-2">{alert.connection?.name || '—'} / {alert.connection?.databaseName || '—'}</span>
          <div className="flex items-center gap-1 ml-3" onClick={e => e.stopPropagation()}>
            <button onClick={() => onTest(alert.id)} className="p-1 text-text-tertiary hover:text-green-500 rounded" title="Testar"><Play className="w-3.5 h-3.5" /></button>
            <button onClick={() => onEdit(alert)} className="p-1 text-text-tertiary hover:text-blue-500 rounded" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => onToggle(alert)} className={`p-1 rounded ${alert.enabled ? 'text-amber-500' : 'text-gray-400'}`} title={alert.enabled ? 'Pausar' : 'Ativar'}><Pause className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(alert.id)} className="p-1 text-text-tertiary hover:text-red-500 rounded" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Incident rows */}
        {isExpanded && (
          <div className="border-t border-border/50">
            {hist.length === 0 ? (
              <div className="px-4 py-3 text-xs text-text-tertiary flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Nenhum incidente recente — tudo OK
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-border/50">
                    <th className="px-4 py-1.5 text-left font-medium text-text-tertiary w-10">#</th>
                    <th className="px-4 py-1.5 text-left font-medium text-text-tertiary">Horário</th>
                    <th className="px-4 py-1.5 text-left font-medium text-text-tertiary">Banco</th>
                    <th className="px-4 py-1.5 text-left font-medium text-text-tertiary">Status</th>
                    <th className="px-4 py-1.5 text-left font-medium text-text-tertiary">Valor</th>
                    <th className="px-4 py-1.5 text-right font-medium text-text-tertiary">Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {hist.map((h: any, i: number) => (
                    <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                      <td className="px-4 py-2 text-text-tertiary">{i + 1}</td>
                      <td className="px-4 py-2 text-text-primary font-mono">
                        <Clock className="w-3 h-3 inline mr-1 text-text-tertiary" />
                        {new Date(h.checkedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{
                            (() => {
                              // Extract [ConnName/DB] from message if present
                              const match = h.message?.match(/^\[([^\]]+)\]/)
                              if (match) return match[1]
                              return alert.connection?.databaseName || alert.connection?.name || '—'
                            })()
                          }</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <StatusIcon status={h.status} />
                          <span className={`font-medium ${h.status === 'triggered' ? 'text-amber-600' : 'text-red-600'}`}>
                            {h.status === 'triggered' ? 'Disparado' : 'Erro'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary font-mono text-[10px]">{h.value || h.message || '—'}</td>
                      <td className="px-4 py-2 text-right text-text-tertiary">{h.executionMs ? h.executionMs + 'ms' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Active incidents */}
      {activeAlerts.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Incidentes Ativos ({activeAlerts.length})
          </h3>
          <div className="space-y-2">
            {activeAlerts.map(renderAlertGroup)}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedAlerts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Resolvidos / OK ({resolvedAlerts.length})
          </h3>
          <div className="space-y-2 opacity-70">
            {resolvedAlerts.map(renderAlertGroup)}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-12 text-text-secondary text-sm">Nenhum alerta configurado.</div>
      )}
    </div>
  )
}
