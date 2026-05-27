import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import api from '../../lib/api'

interface Alert { id: string; name: string; connectionId: string; metricType: string; condition: string; threshold: number; severity: string; enabled: boolean; customQuery?: string; notificationChannels?: string[]; checkIntervalMinutes?: number; }

export default function AlertFormModal({ alert, onClose, onSaved }: { alert: Alert | null; onClose: () => void; onSaved: () => void }) {
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
    if (!form.name.trim()) { setError('Nome do alerta é obrigatório'); return }
    if (!form.query.trim()) { setError('Query SQL é obrigatória'); return }
    if (!form.connectionId) { setError('Selecione uma conexão'); return }
    setSaving(true); setError('')
    try {
      if (alert) {
        await api.put(`/api/alerts/${alert.id}`, form)
      } else {
        await api.post('/api/alerts', { ...form, intervalSeconds: Number(form.intervalSeconds), threshold: form.threshold || null, operator: form.operator || null, connectionIds: form.connectionIds.length > 1 ? form.connectionIds : null })
      }
      onSaved()
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message
      const details = err.response?.data?.details
      const isSyntax = err.response?.data?.syntaxError
      const detailStr = details ? '\n' + details.map((d: any) => `• ${d.path?.join('.')}: ${d.message}`).join('\n') : ''
      setError(isSyntax ? `🛡️ Erro de sintaxe SQL:\n${msg}` : msg + detailStr)
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
  const labelCls = "block text-xs font-medium text-text-secondary mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-6xl mx-4 p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setForm(f => ({ ...f, connectionIds: connections.filter(c => c.databaseName).map(c => c.id), connectionId: f.connectionId || connections[0]?.id }))} className="text-[10px] text-blue-600 hover:underline">Selecionar todos</button>
                <span className="text-text-tertiary text-[10px]">|</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, connectionIds: [] }))} className="text-[10px] text-red-600 hover:underline">Limpar</button>
              </div>
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
            <button onClick={() => { if (!form.name.trim()) { setError('Preencha o nome do alerta'); return } if (!form.connectionId) { setError('Selecione ao menos uma conexão'); return } setError(''); setStep(2) }} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">Próximo →</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Query SQL (apenas SELECT)</label>
              <div className="border border-border rounded-lg overflow-hidden" style={{ height: '200px' }}>
                <SqlEditor value={form.query} onChange={v => setForm(f => ({...f, query: v}))} placeholder="SELECT COUNT(*) FROM tabela WHERE condição..." dbType="mssql" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={testQuery} disabled={testing || !form.query}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-text-primary text-xs rounded-lg transition">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Validar Query
              </button>
            </div>
            {testResult && (
              <div className={`p-3 rounded-lg text-xs ${testResult.error ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 text-green-600 dark:text-green-400'}`}>
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

