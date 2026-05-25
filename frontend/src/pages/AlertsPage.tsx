import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, Pencil, Play, Pause, CheckCircle2, AlertTriangle, XCircle, Loader2, Clock, ChevronDown, ChevronRight, TestTube2 } from 'lucide-react'
import api from '../lib/api'

interface AlertItem {
  id: string; name: string; connectionId: string; query: string;
  evaluationType: string; operator: string | null; threshold: string | null;
  intervalSeconds: number; severity: string; enabled: boolean;
  currentStatus: string; lastMessage: string | null;
  lastCheckedAt: string | null; lastTriggeredAt: string | null;
  notifyChannels: string[];
  connection: { id: string; name: string; dbType: string; databaseName: string; environment: string } | null;
}

interface Connection { id: string; name: string; dbType: string; databaseName: string; environment: string; }

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const load = async () => {
    try { const { data } = await api.get('/api/alerts'); setAlerts(data.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const toggleEnabled = async (alert: AlertItem) => {
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
    alert(JSON.stringify(data.data, null, 2))
  }

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    ok: { icon: CheckCircle2, color: 'text-green-400', label: 'OK' },
    triggered: { icon: AlertTriangle, color: 'text-red-400', label: 'ALERTA' },
    error: { icon: XCircle, color: 'text-yellow-400', label: 'ERRO' },
    unknown: { icon: Clock, color: 'text-gray-500', label: 'Aguardando' },
  }

  const severityColors: Record<string, string> = {
    info: 'bg-blue-900/30 text-blue-400 border-blue-800',
    warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    critical: 'bg-red-900/30 text-red-400 border-red-800',
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-yellow-400" /> Alertas
        </h1>
        <button onClick={() => { setEditingAlert(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" /> Novo Alerta
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: alerts.filter(a => a.enabled).length, color: 'text-white' },
          { label: 'OK', value: alerts.filter(a => a.currentStatus === 'ok').length, color: 'text-green-400' },
          { label: 'Disparados', value: alerts.filter(a => a.currentStatus === 'triggered').length, color: 'text-red-400' },
          { label: 'Erro', value: alerts.filter(a => a.currentStatus === 'error').length, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
          <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum alerta configurado.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">+ Criar primeiro alerta</button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => {
            const st = statusConfig[a.currentStatus] || statusConfig.unknown
            const StIcon = st.icon
            return (
              <div key={a.id} className={`p-4 bg-gray-900 border rounded-xl transition ${a.currentStatus === 'triggered' ? 'border-red-800/50' : 'border-gray-800'}`}>
                <div className="flex items-center gap-4">
                  <StIcon className={`w-5 h-5 ${st.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold ${a.enabled ? 'text-white' : 'text-gray-500 line-through'}`}>{a.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColors[a.severity]}`}>{a.severity.toUpperCase()}</span>
                      {a.connection && <span className="text-[10px] text-gray-500">{a.connection.name}{a.connection.databaseName ? `/${a.connection.databaseName}` : ''}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{a.lastMessage || 'Aguardando primeira verificação...'}</p>
                    {a.lastCheckedAt && <p className="text-[10px] text-gray-600 mt-0.5">Último check: {new Date(a.lastCheckedAt).toLocaleString()}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => testAlert(a.id)} title="Testar agora" className="p-1.5 text-gray-500 hover:text-green-400 transition"><TestTube2 className="w-4 h-4" /></button>
                    <button onClick={() => toggleEnabled(a)} title={a.enabled ? 'Pausar' : 'Ativar'} className="p-1.5 text-gray-500 hover:text-yellow-400 transition">
                      {a.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditingAlert(a); setShowForm(true) }} className="p-1.5 text-gray-500 hover:text-blue-400 transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteAlert(a.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => setExpandedAlert(expandedAlert === a.id ? null : a.id)} className="p-1.5 text-gray-500 hover:text-white transition">
                      {expandedAlert === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedAlert === a.id && <AlertDetail alertId={a.id} />}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <AlertForm alert={editingAlert} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function AlertDetail({ alertId }: { alertId: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/alerts/${alertId}`).then(r => setHistory(r.data.data.history || [])).finally(() => setLoading(false))
  }, [alertId])

  if (loading) return <div className="mt-3 pt-3 border-t border-gray-800"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>

  const statusIcon: Record<string, string> = { ok: '🟢', triggered: '🔴', error: '🟡' }

  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <p className="text-xs font-medium text-gray-400 mb-2">Histórico recente</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {history.slice(0, 20).map((h: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span>{statusIcon[h.status] || '⚪'}</span>
            <span className="text-gray-500 w-32 shrink-0">{new Date(h.checkedAt).toLocaleString()}</span>
            <span className="text-gray-400 truncate">{h.message}</span>
            {h.executionMs && <span className="text-gray-600 shrink-0">{h.executionMs}ms</span>}
          </div>
        ))}
        {history.length === 0 && <p className="text-xs text-gray-600">Sem histórico ainda</p>}
      </div>
    </div>
  )
}

function AlertForm({ alert, onClose, onSaved }: { alert: AlertItem | null; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1)
  const [connections, setConnections] = useState<Connection[]>([])
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
      const { data } = await api.post('/api/alerts/validate-query', { query: form.query })
      if (!data.data.valid) { setTestResult({ error: data.data.error }); setTesting(false); return }
      // If we have connectionId and it's an edit, test against the connection
      if (alert?.id) {
        const { data: testData } = await api.post(`/api/alerts/${alert.id}/test`)
        setTestResult(testData.data)
      } else {
        setTestResult({ valid: true, message: 'SQL validado ✅' })
      }
    } catch (err: any) { setTestResult({ error: err.message }) }
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
      setError(err.response?.data?.error || err.message)
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-gray-400 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-1">{alert ? 'Editar Alerta' : 'Novo Alerta'}</h2>
        <p className="text-xs text-gray-500 mb-4">Passo {step} de 3</p>

        {/* Progress bar */}
        <div className="flex gap-1 mb-5">
          {[1,2,3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-blue-500' : 'bg-gray-800'}`} />
          ))}
        </div>

        {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">{error}</div>}

        {/* Step 1: Connection + Name */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nome do alerta</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Pedidos parados há 30min" />
            </div>
            <div>
              <label className={labelCls}>Conexão / Banco</label>
              <select className={inputCls} value={form.connectionId} onChange={e => setForm(f => ({ ...f, connectionId: e.target.value }))}>
                {connections.map(c => <option key={c.id} value={c.id}>{c.name} {c.databaseName ? `(${c.databaseName})` : ''} — {c.dbType}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Severidade</label>
              <div className="flex gap-2">
                {['info', 'warning', 'critical'].map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, severity: s }))}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${form.severity === s ? (s === 'critical' ? 'bg-red-900/30 border-red-700 text-red-400' : s === 'warning' ? 'bg-yellow-900/30 border-yellow-700 text-yellow-400' : 'bg-blue-900/30 border-blue-700 text-blue-400') : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                    {s === 'critical' ? '🔴 Crítico' : s === 'warning' ? '🟡 Alerta' : '🔵 Info'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Query */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Query SQL de verificação</label>
              <textarea className={`${inputCls} font-mono h-32 resize-y`} value={form.query}
                onChange={e => setForm(f => ({ ...f, query: e.target.value }))}
                placeholder="SELECT count(*) FROM pedidos WHERE created_at > now() - interval '30 minutes'" />
              <p className="text-[10px] text-gray-600 mt-1">Apenas SELECT permitido. Timeout: 10 segundos.</p>
            </div>
            <button onClick={testQuery} disabled={testing || !form.query}
              className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition">
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube2 className="w-3 h-3" />}
              Testar Query
            </button>
            {testResult && (
              <div className={`p-3 rounded-lg text-xs ${testResult.error ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-green-900/20 border border-green-800 text-green-400'}`}>
                {testResult.error || testResult.message || `Retornou ${testResult.rowCount} linhas`}
                {testResult.rows && <pre className="mt-2 text-[10px] text-gray-400 overflow-x-auto">{JSON.stringify(testResult.rows.slice(0,3), null, 2)}</pre>}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Condition + Frequency */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Quando alertar?</label>
              <div className="space-y-2">
                {[
                  { value: 'has_rows', label: 'Espero que retorne linhas', desc: 'Se 0 linhas = ALERTA' },
                  { value: 'no_rows', label: 'Espero que NÃO retorne linhas', desc: 'Se ≥1 linha = ALERTA' },
                  { value: 'threshold', label: 'Valor deve respeitar condição', desc: 'Compara o primeiro valor retornado' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${form.evaluationType === opt.value ? 'bg-blue-900/20 border-blue-700' : 'bg-gray-800/50 border-gray-800'}`}>
                    <input type="radio" name="evalType" checked={form.evaluationType === opt.value}
                      onChange={() => setForm(f => ({ ...f, evaluationType: opt.value }))} className="mt-0.5" />
                    <div>
                      <span className="text-sm text-white">{opt.label}</span>
                      <p className="text-[10px] text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {form.evaluationType === 'threshold' && (
              <div className="flex gap-2">
                <select className={`${inputCls} w-20`} value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}>
                  {['>', '<', '=', '!=', '>=', '<='].map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <input className={inputCls} value={form.threshold || ''} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder="Valor limite" />
              </div>
            )}

            <div>
              <label className={labelCls}>Frequência de verificação</label>
              <select className={inputCls} value={form.intervalSeconds} onChange={e => setForm(f => ({ ...f, intervalSeconds: +e.target.value }))}>
                <option value={30}>A cada 30 segundos</option>
                <option value={60}>A cada 1 minuto</option>
                <option value={300}>A cada 5 minutos</option>
                <option value={600}>A cada 10 minutos</option>
                <option value={1800}>A cada 30 minutos</option>
                <option value={3600}>A cada 1 hora</option>
              </select>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-5 mt-5 border-t border-gray-800">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition">Voltar</button>
          ) : (
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 rounded-lg transition">Cancelar</button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && (!form.name || !form.connectionId)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition">
              Próximo
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {alert ? 'Salvar' : 'Criar Alerta'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
