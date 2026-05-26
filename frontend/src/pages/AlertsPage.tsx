import { useState, useEffect } from 'react'
import { Bell, Plus, CheckCircle, AlertTriangle, XCircle, Clock, Loader2, X, Play, Pause, Trash2, Edit, ChevronRight, BarChart3, List, TrendingUp, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts'
import api from '../lib/api'

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
  const [view, setView] = useState<View>('dashboard')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dashboard, setDashboard] = useState<AlertDashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editAlert, setEditAlert] = useState<Alert | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const testAlert = async (id: string) => {
    const { data } = await api.post(`/api/alerts/${id}/test`)
    alert(`Resultado: ${data.data.status} — ${data.data.message}`)
    load()
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
    return <Clock className="w-4 h-4 text-gray-500" />
  }

  const statusColor = (s: string) => s === 'ok' ? 'text-green-400' : s === 'triggered' ? 'text-amber-400' : s === 'error' ? 'text-red-400' : 'text-gray-500'

  // Summary stats
  const totalAlerts = alerts.length
  const okCount = alerts.filter(a => a.currentStatus === 'ok').length
  const triggeredCount = alerts.filter(a => a.currentStatus === 'triggered').length
  const errorCount = alerts.filter(a => a.currentStatus === 'error').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-400" /> Alertas
        </h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
            <button onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
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
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{totalAlerts}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">OK</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{okCount}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Disparados</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{triggeredCount}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Erro</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{errorCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : view === 'dashboard' ? (
        /* ─── DASHBOARD VIEW ─── */
        <div className="space-y-4">
          {dashboard.length === 0 && (
            <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-xl">
              <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum alerta configurado.</p>
              <p className="text-xs text-gray-600 mt-1">Crie um alerta para monitorar seus bancos.</p>
            </div>
          )}
          {dashboard.map(d => (
            <div key={d.id} className="bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden">
              {/* Alert header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  {statusIcon(d.currentStatus)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{d.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        d.severity === 'critical' ? 'bg-red-900/40 text-red-400 border border-red-800/50' :
                        d.severity === 'warning' ? 'bg-amber-900/40 text-amber-400 border border-amber-800/50' :
                        'bg-blue-900/40 text-blue-400 border border-blue-800/50'
                      }`}>{d.severity}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {d.connectionName} • {d.databaseName} • Último check: {d.lastCheckedAt ? new Date(d.lastCheckedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <p className="text-gray-500">Checks</p>
                    <p className="text-white font-bold">{d.stats.totalChecks}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">OK</p>
                    <p className="text-green-400 font-bold">{d.stats.okCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Alertas</p>
                    <p className="text-amber-400 font-bold">{d.stats.triggeredCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Erros</p>
                    <p className="text-red-400 font-bold">{d.stats.errorCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Média</p>
                    <p className="text-gray-300 font-bold">{d.stats.avgExecutionMs}ms</p>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="p-4">
                {d.timeline.length > 1 ? (
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={d.timeline} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={(t) => t.slice(11, 16)} />
                        <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                          labelFormatter={(l) => new Date(l).toLocaleString()}
                        />
                        <Area type="monotone" dataKey="ok" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.3} name="OK" />
                        <Area type="monotone" dataKey="triggered" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} name="Disparados" />
                        <Area type="monotone" dataKey="error" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.3} name="Erros" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[80px] flex items-center justify-center text-gray-600 text-xs">
                    <Activity className="w-4 h-4 mr-2" /> Coletando dados... o gráfico aparecerá com mais verificações.
                  </div>
                )}

                {/* Value timeline for scalar alerts */}
                {d.lastValues.length > 2 && (
                  <div className="mt-3 h-[80px] border-t border-gray-800/50 pt-3">
                    <p className="text-[10px] text-gray-500 mb-1">Valor retornado ao longo do tempo:</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={d.lastValues} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={(t) => new Date(t).toLocaleTimeString().slice(0, 5)} />
                        <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                        <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} name="Valor" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Last message */}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {statusIcon(d.currentStatus)}
                  <span className={`${statusColor(d.currentStatus)}`}>{d.lastMessage || 'Sem mensagem'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="bg-gray-900/40 border border-gray-800/60 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {statusIcon(a.currentStatus)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{a.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        a.severity === 'critical' ? 'bg-red-900/40 text-red-400' :
                        a.severity === 'warning' ? 'bg-amber-900/40 text-amber-400' :
                        'bg-blue-900/40 text-blue-400'
                      }`}>{a.severity}</span>
                      <span className="text-[10px] text-gray-600">{a.connection?.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {a.lastMessage || 'Aguardando primeira verificação...'}
                      {a.lastCheckedAt && <span className="ml-2 text-gray-600">• Último check: {new Date(a.lastCheckedAt).toLocaleString()}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditAlert(a); setFormOpen(true) }} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => testAlert(a.id)} className="p-2 text-gray-500 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition" title="Testar agora">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleEnabled(a)} className={`p-2 rounded-lg transition ${a.enabled ? 'text-amber-400 hover:bg-amber-900/20' : 'text-gray-600 hover:bg-gray-800'}`} title={a.enabled ? 'Pausar' : 'Ativar'}>
                    <Pause className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteAlert(a.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => expand(a.id)} className={`p-2 text-gray-500 hover:text-white rounded-lg transition ${expandedId === a.id ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Expanded history */}
              {expandedId === a.id && (
                <div className="px-4 pb-4 border-t border-gray-800/50 pt-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Histórico recente</p>
                  {histLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {history.slice(0, 20).map((h: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full ${h.status === 'ok' ? 'bg-green-400' : h.status === 'triggered' ? 'bg-amber-400' : 'bg-red-400'}`} />
                          <span className="text-gray-500 font-mono w-32">{new Date(h.checkedAt).toLocaleString()}</span>
                          <span className={`font-medium ${statusColor(h.status)}`}>{h.message}</span>
                          <span className="text-gray-600 ml-auto">{h.executionMs}ms</span>
                        </div>
                      ))}
                      {history.length === 0 && <p className="text-xs text-gray-600">Sem histórico ainda</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {formOpen && <AlertFormModal alert={editAlert} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} />}
    </div>
  )
}

// ─── Alert Form Modal ─────────────────────────────────────────────────────────
function AlertFormModal({ alert, onClose, onSaved }: { alert: Alert | null; onClose: () => void; onSaved: () => void }) {
  const [connections, setConnections] = useState<any[]>([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: alert?.name || '',
    connectionId: alert?.connectionId || '',
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
        setTestResult({ valid: true, message: data.data.message || '✅ Query válida!' })
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
        await api.post('/api/alerts', { ...form, intervalSeconds: Number(form.intervalSeconds) })
      }
      onSaved()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message
      const isSyntax = err.response?.data?.syntaxError
      setError(isSyntax ? `🛡️ Erro de sintaxe SQL:\n${msg}` : msg)
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{alert ? 'Editar Alerta' : 'Novo Alerta'}</h2>
            <p className="text-xs text-gray-500">Passo {step} de 3</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-900/40 rounded-lg">
            <pre className="text-xs text-red-400 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><label className={labelCls}>Nome do Alerta</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Não recebe VIAGEM" /></div>
            <div><label className={labelCls}>Conexão / Database</label>
              <select className={inputCls} value={form.connectionId} onChange={e => setForm(f => ({...f, connectionId: e.target.value}))}>
                {connections.filter(c => c.databaseName).map(c => <option key={c.id} value={c.id}>{c.name} ({c.databaseName})</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Severidade</label>
              <select className={inputCls} value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}>
                <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
              </select>
            </div>
            <div><label className={labelCls}>Intervalo de verificação</label>
              <select className={inputCls} value={form.intervalSeconds} onChange={e => setForm(f => ({...f, intervalSeconds: Number(e.target.value)}))}>
                <option value={30}>30 segundos</option><option value={60}>1 minuto</option><option value={300}>5 minutos</option>
                <option value={600}>10 minutos</option><option value={1800}>30 minutos</option><option value={3600}>1 hora</option>
              </select>
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded-lg transition">
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
              <button onClick={() => setStep(1)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition">← Voltar</button>
              <button onClick={() => setStep(3)} disabled={!form.query} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">Próximo →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><label className={labelCls}>Tipo de avaliação</label>
              <select className={inputCls} value={form.evaluationType} onChange={e => setForm(f => ({...f, evaluationType: e.target.value}))}>
                <option value="has_rows">Deve retornar linhas (alerta se 0)</option>
                <option value="no_rows">Não deve retornar linhas (alerta se &gt; 0)</option>
                <option value="row_count">Quantidade de linhas</option>
                <option value="scalar_value">Valor escalar (primeira coluna)</option>
              </select>
            </div>
            {(form.evaluationType === 'row_count' || form.evaluationType === 'scalar_value') && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Operador</label>
                  <select className={inputCls} value={form.operator} onChange={e => setForm(f => ({...f, operator: e.target.value}))}>
                    <option value=">">&gt; Maior que</option><option value="<">&lt; Menor que</option>
                    <option value=">=">&gt;= Maior ou igual</option><option value="<=">&lt;= Menor ou igual</option>
                    <option value="=">=  Igual</option><option value="!=">!= Diferente</option>
                  </select>
                </div>
                <div><label className={labelCls}>Threshold</label><input className={inputCls} value={form.threshold} onChange={e => setForm(f => ({...f, threshold: e.target.value}))} placeholder="0" /></div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition">← Voltar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {saving ? 'Salvando...' : alert ? 'Salvar Alterações' : 'Criar Alerta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
