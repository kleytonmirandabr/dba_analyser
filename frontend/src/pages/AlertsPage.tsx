import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Bell, Plus, CheckCircle, AlertTriangle, XCircle, Clock, Loader2, X, Play, Pause, Trash2, Edit, ChevronRight, BarChart3, List, TrendingUp, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts'
import api from '../lib/api'
import AlertsDashboardGrid from '../components/alerts/AlertsDashboardGrid'

type View = 'dashboard' | 'list'

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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-white'}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'list' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-white'}`}>
              <List className="w-3.5 h-3.5" /> Lista
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
        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalAlerts}</p>
        </div>
        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">OK</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{okCount}</p>
        </div>
        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Disparados</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{triggeredCount}</p>
        </div>
        <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-border/50 rounded-xl p-4">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Erro</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{errorCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : view === 'dashboard' ? (
        /* ─── DASHBOARD VIEW ─── */
        <div>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4">
            <select value={dashFilter.severity || ''} onChange={e => setDashFilter(f => ({ ...f, severity: e.target.value || undefined }))}
              className="text-xs bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-text-secondary">
              <option value="">Todas Severidades</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select value={dashFilter.status || ''} onChange={e => setDashFilter(f => ({ ...f, status: e.target.value || undefined }))}
              className="text-xs bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-text-secondary">
              <option value="">Todos Status</option>
              <option value="ok">OK</option>
              <option value="triggered">Disparados</option>
              <option value="error">Erro</option>
            </select>
          </div>
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
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="bg-gray-900/40 border border-border/60 rounded-xl overflow-hidden">
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
function HistoryPanel({ history, loading }: { history: any[]; loading: boolean }) {
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
function AlertMessage({ message, lastChecked }: { message: string | null | undefined; lastChecked?: string | null }) {
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

      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-text-secondary">
            <span className="text-red-400 font-semibold">{problems.length} de {total} bancos com problema</span>
            {lastChecked && <span className="text-gray-600 ml-2">• {new Date(lastChecked).toLocaleString()}</span>}
          </p>
          <div className="flex flex-wrap gap-1">
            {problems.map((d: any) => (
              <span key={d.database} className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                d.status === 'triggered'
                  ? 'bg-amber-900/30 border border-amber-800/40 text-amber-300'
                  : 'bg-red-900/30 border border-red-800/40 text-red-300'
              }`}>
                {d.status === 'triggered' ? '⚠️' : '❌'} {d.database}
              </span>
            ))}
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

function AlertFormModal({ alert, onClose, onSaved }: { alert: Alert | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<any[]>([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: alert?.name || '',
    connectionId: alert?.connectionId || '',
    connectionIds: (alert as any)?.connectionIds || [] as string[],
    query: alert?.query || '',
    evaluationType: alert?.evaluationType || 'has_rows',
    operator: alert?.operator || '>',
    threshold: alert?.threshold || '0',
    intervalSeconds: alert?.intervalSeconds || 300,
    severity: alert?.severity || 'warning',
    notifyChannels: alert?.notifyChannels || ['ui'],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data.data)
      if (!form.connectionId && r.data.data.length > 0) setForm(f => ({ ...f, connectionId: r.data.data[0].id }))
    })
  }, [])

  const testQuery = async () => {
    setTesting(true); setTestResult(null)
    try {
      const { data } = await api.post('/api/alerts/validate-query', { query: form.query, connectionId: form.connectionId })
      if (!data.data.valid) { setTestResult({ error: data.data.error }); setTesting(false); return }
      if (alert?.id) {
        const { data: testData } = await api.post(`/api/alerts/${alert.id}/test`)
        setTestResult(testData.data)
      } else {
        setTestResult({ valid: true, message: data.data.message || t('alerts.validQuery') })
      }
    } catch (err: any) { setTestResult({ error: err.response?.data?.error || err.message }) }
    setTesting(false)
  }

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      if (alert) {
        await api.put(`/api/alerts/${alert.id}`, form)
      } else {
        await api.post('/api/alerts', { ...form, intervalSeconds: Number(form.intervalSeconds), connectionIds: form.connectionIds.length > 1 ? form.connectionIds : null })
      }
      onSaved()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message
      const isSyntax = err.response?.data?.syntaxError
      setError(isSyntax ? `🛡️ Erro de sintaxe SQL:\n${msg}` : msg)
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-text-secondary mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{alert ? t('alerts.editAlert') : 'Novo Alerta'}</h2>
            <p className="text-xs text-text-tertiary">Passo {step} de 3</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-900/40 rounded-lg">
            <pre className="text-xs text-red-400 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><label className={labelCls}>Nome do Alerta</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Não recebe VIAGEM" /></div>
            <div>
              <label className={labelCls}>Databases para monitorar</label>
              <div className="max-h-[180px] overflow-y-auto bg-surface-elevated border border-border rounded-lg p-2 space-y-1">
                {connections.filter(c => c.databaseName).map(c => {
                  const checked = form.connectionIds.includes(c.id) || form.connectionId === c.id
                  return (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-active/50 cursor-pointer transition">
                      <input type="checkbox" checked={checked}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...form.connectionIds.filter(id => id !== c.id), c.id]
                            : form.connectionIds.filter(id => id !== c.id)
                          setForm(f => ({ ...f, connectionIds: ids, connectionId: ids[0] || f.connectionId }))
                        }}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-surface text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-xs text-text-secondary">{c.name}</span>
                      <span className="text-[10px] text-text-tertiary ml-auto">{c.databaseName}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">{form.connectionIds.length || 1} database(s) selecionada(s)</p>
            </div>
            <div><label className={labelCls}>Severidade</label>
              <SearchableSelect
                value={form.severity}
                onChange={v => setForm(f => ({...f, severity: v}))}
                searchable={false}
                options={[
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </div>
            <div><label className={labelCls}>Intervalo de verificação</label>
              <SearchableSelect
                value={String(form.intervalSeconds)}
                onChange={v => setForm(f => ({...f, intervalSeconds: Number(v)}))}
                searchable={false}
                options={[
                  { value: '30', label: '30 segundos' },
                  { value: '60', label: '1 minuto' },
                  { value: '300', label: '5 minutos' },
                  { value: '600', label: '10 minutos' },
                  { value: '1800', label: '30 minutos' },
                  { value: '3600', label: '1 hora' },
                ]}
              />
            </div>
            <button onClick={() => setStep(2)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">Próximo →</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Query SQL (apenas SELECT)</label>
              <textarea className={`${inputCls} h-32 font-mono text-xs`} value={form.query}
                onChange={e => setForm(f => ({...f, query: e.target.value}))}
                placeholder="SELECT COUNT(*) FROM tabela WHERE condição..." />
            </div>
            <div className="flex gap-2">
              <button onClick={testQuery} disabled={testing || !form.query}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-text-primary text-xs rounded-lg transition">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Validar Query
              </button>
            </div>
            {testResult && (
              <div className={`p-3 rounded-lg text-xs ${testResult.error ? 'bg-red-950/30 border border-red-900/40 text-red-400' : 'bg-green-950/30 border border-green-900/40 text-green-400'}`}>
                {testResult.error || testResult.message}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-2 bg-surface-elevated hover:bg-surface-active text-text-secondary text-sm rounded-lg transition">← Voltar</button>
              <button onClick={() => setStep(3)} disabled={!form.query} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">Próximo →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><label className={labelCls}>Tipo de avaliação</label>
              <SearchableSelect
                value={form.evaluationType}
                onChange={v => setForm(f => ({...f, evaluationType: v}))}
                searchable={false}
                options={[
                  { value: 'has_rows', label: 'Deve retornar linhas (alerta se 0)' },
                  { value: 'no_rows', label: 'Não deve retornar linhas (alerta se > 0)' },
                  { value: 'row_count', label: 'Quantidade de linhas' },
                  { value: 'scalar_value', label: 'Valor escalar (primeira coluna)' },
                ]}
              />
            </div>
            {(form.evaluationType === 'row_count' || form.evaluationType === 'scalar_value') && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Operador</label>
                  <SearchableSelect
                    value={form.operator}
                    onChange={v => setForm(f => ({...f, operator: v}))}
                    searchable={false}
                    options={[
                      { value: '>', label: '> Maior que' },
                      { value: '<', label: '< Menor que' },
                      { value: '>=', label: '>= Maior ou igual' },
                      { value: '<=', label: '<= Menor ou igual' },
                      { value: '=', label: '= Igual' },
                      { value: '!=', label: '!= Diferente' },
                    ]}
                  />
                </div>
                <div><label className={labelCls}>Threshold</label><input className={inputCls} value={form.threshold} onChange={e => setForm(f => ({...f, threshold: e.target.value}))} placeholder="0" /></div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-2 bg-surface-elevated hover:bg-surface-active text-text-secondary text-sm rounded-lg transition">← Voltar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {saving ? t('alerts.saving') : alert ? t('alerts.saveChanges') : t('alerts.createAlert')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
