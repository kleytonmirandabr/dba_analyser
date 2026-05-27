import { useState, useEffect } from 'react'
import SqlEditor from '../components/editor/SqlEditor'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Bell, Plus, CheckCircle, AlertTriangle, XCircle, Clock, Loader2, X, Play, Pause, Trash2, Edit, ChevronRight, BarChart3, List, TrendingUp, Activity, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts'
import api from '../lib/api'
import AlertsDashboardGrid from '../components/alerts/AlertsDashboardGrid'
import AlertsAnalytics from '../components/alerts/AlertsAnalytics'
import AlertIncidentsTable from '../components/alerts/AlertIncidentsTable'

type View = 'dashboard' | 'table' | 'list' | 'analytics'

interface AlertDashboard {
  id: string; name: string; severity: string; currentStatus: string;
  connectionName: string; databaseName: string; evaluationType: string;
  lastCheckedAt: string; lastMessage: string;
  stats: { totalChecks: number; triggeredCount: number; errorCount: number; okCount: number; avgExecutionMs: number };
  timeline: { time: string; ok: number; triggered: number; error: number }[];
  lastValues: { time: string; value: number | null; status: string }[];
}

interface Alert {
  id: string; name: string; query: string; evaluationType: string; operator?: string;
  threshold?: string; intervalSeconds: number; severity: string; enabled: boolean;
  currentStatus: string; lastMessage?: string; lastCheckedAt?: string;
  connectionId: string; connection?: { name: string; databaseName: string };
  notifyChannels: string[];
}

export default function AlertsPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('dashboard')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dashboard, setDashboard] = useState<AlertDashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editAlert, setEditAlert] = useState<Alert | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dashFilter, setDashFilter] = useState<{ severity?: string; status?: string; connection?: string }>({})
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [countdown, setCountdown] = useState(30)
  const [sortCol, setSortCol] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [history, setHistory] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [alertsRes, dashRes] = await Promise.all([
        api.get('/api/alerts'),
        api.get('/api/alerts/dashboard?days=7')
      ])
      setAlerts(alertsRes.data.data || [])
      setDashboard(dashRes.data.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const toggleEnabled = async (alert: Alert) => {
    await api.put(`/api/alerts/${alert.id}`, { enabled: !alert.enabled })
    load()
  }

  const deleteAlert = async (id: string) => {
    if (!confirm('Excluir este alerta?')) return
    await api.delete(`/api/alerts/${id}`)
    load()
  }

  const [testToast, setTestToast] = useState<{ name: string; status: string; message: string } | null>(null)

  const testAlert = async (id: string) => {
    try {
      const { data } = await api.post(`/api/alerts/${id}/test`)
      const a = alerts.find(x => x.id === id)
      setTestToast({ name: a?.name || '', status: data.data?.status || 'ok', message: data.data?.message || t('alerts.testCompleted') })
      setTimeout(() => setTestToast(null), 5000)
      load()
    } catch (err: any) {
      setTestToast({ name: '', status: 'error', message: err.response?.data?.error || err.message })
      setTimeout(() => setTestToast(null), 5000)
    }
  }

  const expand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setHistLoading(true)
    api.get(`/api/alerts/${id}`).then(r => setHistory(r.data.data.history || [])).finally(() => setHistLoading(false))
  }

  const statusIcon = (s: string) => {
    if (s === 'ok') return <CheckCircle className="w-4 h-4 text-green-400" />
    if (s === 'triggered') return <AlertTriangle className="w-4 h-4 text-amber-400" />
    if (s === 'error') return <XCircle className="w-4 h-4 text-red-400" />
    return <Clock className="w-4 h-4 text-text-tertiary" />
  }

  const statusColor = (s: string) => s === 'ok' ? 'text-green-400' : s === 'triggered' ? 'text-amber-400' : s === 'error' ? 'text-red-400' : 'text-text-tertiary'

  // Summary stats
  const totalAlerts = alerts.length
  const okCount = alerts.filter(a => a.currentStatus === 'ok').length
  const triggeredCount = alerts.filter(a => a.currentStatus === 'triggered').length
  const errorCount = alerts.filter(a => a.currentStatus === 'error').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-400" /> Alertas
        </h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-surface-elevated rounded-lg p-0.5 border border-border">
            <button onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button onClick={() => setView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'table' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              <List className="w-3.5 h-3.5" /> Tabela
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'list' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              <Activity className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setView('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'analytics' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              <TrendingUp className="w-3.5 h-3.5" /> Analytics
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load()} title="Atualizar" className="p-1.5 text-text-tertiary hover:text-blue-500 rounded-lg border border-border hover:border-blue-300 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg border transition ${
                autoRefresh ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-border text-text-tertiary'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {autoRefresh ? countdown + 's' : 'Auto'}
            </button>
          </div>
          <button onClick={() => { setEditAlert(null); setFormOpen(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Novo Alerta
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900/50 border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalAlerts}</p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">OK</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{okCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Disparados</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{triggeredCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900/50 border border-border rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Erro</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{errorCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : view === 'dashboard' ? (
        /* ─── DASHBOARD VIEW ─── */
        <div>
          {/* Filters handled by grid */}
          {dashboard.length === 0 ? (
            <div className="text-center py-16 bg-gray-100/30 dark:bg-gray-900/30 border border-border rounded-xl">
              <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-text-secondary">{t('alerts.noAlerts')}</p>
              <p className="text-xs text-gray-600 mt-1">Crie um alerta para monitorar seus bancos.</p>
            </div>
          ) : (
            <AlertsDashboardGrid data={dashboard} filter={dashFilter} />
          )}
        </div>
      ) : view === 'table' ? (
        /* ─── INCIDENTS TABLE (grouped by rule) ─── */
        <AlertIncidentsTable key={alerts.map(a => a.lastCheckedAt).join()} alerts={alerts} dashboard={dashboard} onEdit={a => { setEditAlert(a); setFormOpen(true) }} onTest={testAlert} onToggle={toggleEnabled} onDelete={deleteAlert} />
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="bg-surface-elevated border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {statusIcon(a.currentStatus)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium text-sm">{a.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        a.severity === 'critical' ? 'bg-red-900/40 text-red-400' :
                        a.severity === 'warning' ? 'bg-amber-900/40 text-amber-400' :
                        'bg-blue-900/40 text-blue-400'
                      }`}>{a.severity}</span>
                      <span className="text-[10px] text-gray-600">{a.connection?.name}</span>
                    </div>
                    <div className="mt-1">
                      <AlertMessage message={a.lastMessage} lastChecked={a.lastCheckedAt} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditAlert(a); setFormOpen(true) }} className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => testAlert(a.id)} className="p-2 text-text-tertiary hover:text-green-400 hover:bg-green-900/20 rounded-lg transition" title="Testar agora">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleEnabled(a)} className={`p-2 rounded-lg transition ${a.enabled ? 'text-amber-400 hover:bg-amber-900/20' : 'text-gray-600 hover:bg-surface-elevated'}`} title={a.enabled ? 'Pausar' : 'Ativar'}>
                    <Pause className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteAlert(a.id)} className="p-2 text-text-tertiary hover:text-red-400 hover:bg-red-900/20 rounded-lg transition" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => expand(a.id)} className={`p-2 text-text-tertiary hover:text-text-primary rounded-lg transition ${expandedId === a.id ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Expanded history */}
              {expandedId === a.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                  <HistoryPanel history={history} loading={histLoading} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── ANALYTICS VIEW ─── */}
      {view === 'analytics' && <AlertsAnalytics />}

      {/* Test result toast */}
      {testToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-sm max-w-md ${
          testToast.status === 'ok' ? 'bg-green-950/90 border-green-800 text-green-200' :
          testToast.status === 'triggered' ? 'bg-amber-950/90 border-amber-800 text-amber-200' :
          'bg-red-950/90 border-red-800 text-red-200'
        }`}>
          <p className="text-xs font-medium opacity-70">{testToast.name || 'Teste'}</p>
          <p className="text-sm font-semibold mt-0.5">
            {testToast.status === 'ok' ? '✅' : testToast.status === 'triggered' ? '⚠️' : '❌'} {testToast.message}
          </p>
        </div>
      )}

      {/* Form modal */}
      {formOpen && <AlertFormModal alert={editAlert} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} />}
    </div>
  )
}

// ─── Alert Form Modal ─────────────────────────────────────────────────────────
// ─── History Panel with filter ───────────────────────────────────────────────

// Components extracted to separate files
import AlertFormModal from '../components/alerts/AlertFormModal'
import HistoryPanel from '../components/alerts/HistoryPanel'
import AlertMessage from '../components/alerts/AlertMessage'
