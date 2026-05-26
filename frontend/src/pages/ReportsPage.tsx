import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { FileText, Download, Send, Plus, Calendar, Loader2, Clock, Trash2, Mail } from 'lucide-react'
import api from '../lib/api'

interface ReportFile { filename: string; sizeBytes: number; createdAt: string }
interface Schedule { id: string; name: string; frequency: string; dayOfWeek: number; hour: number; recipients: string[]; periodDays: number; enabled: boolean; lastSentAt?: string; lastError?: string }

export default function ReportsPage() {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ReportFile[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [generating, setGenerating] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [periodDays, setPeriodDays] = useState(7)

  useEffect(() => { loadReports(); loadSchedules() }, [])

  const loadReports = () => api.get('/api/reports/list').then(r => setReports(r.data.data)).catch(() => {})
  const loadSchedules = () => api.get('/api/reports/schedules').then(r => setSchedules(r.data.data)).catch(() => {})

  const generateReport = async () => {
    setGenerating(true)
    try {
      await api.post('/api/reports/generate', { periodDays })
      await loadReports()
    } catch {}
    setGenerating(false)
  }

  const downloadReport = (filename: string) => {
    window.open(`/api/reports/download/${filename}`, '_blank')
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Excluir agendamento?')) return
    await api.delete(`/api/reports/schedules/${id}`)
    loadSchedules()
  }

  const formatSize = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`
  const freqLabel: Record<string, string> = { daily: t('reports.daily'), weekly: t('reports.weekly'), monthly: t('reports.monthly') }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-text-primary">{t('reports.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SearchableSelect
            value={String(periodDays)}
            onChange={v => setPeriodDays(+v)}
            searchable={false}
            options={[
              { value: '7', label: 'Últimos 7 dias' },
              { value: '14', label: 'Últimos 14 dias' },
              { value: '30', label: 'Últimos 30 dias' },
            ]}
          />
          <button onClick={generateReport} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Gerar Agora
          </button>
          <button onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-elevated hover:bg-surface-active border border-border text-text-secondary rounded-lg text-sm font-medium transition">
            <Calendar className="w-4 h-4" /> Agendar
          </button>
        </div>
      </div>

      {/* Schedules */}
      {schedules.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide mb-3">Agendamentos Ativos</p>
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-surface-elevated/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-sm text-text-primary font-medium">{s.name}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {freqLabel[s.frequency]} às {s.hour}:00 UTC • {s.recipients.length} destinatário(s)
                      {s.lastSentAt && ` • Último envio: ${new Date(s.lastSentAt).toLocaleDateString('pt-BR')}`}
                    </p>
                    {s.lastError && <p className="text-[10px] text-red-400">Erro: {s.lastError}</p>}
                  </div>
                </div>
                <button onClick={() => deleteSchedule(s.id)} className="p-1.5 text-text-secondary hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">{t('reports.title')}</p>
        </div>
        {reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-tertiary">{t('reports.noReports')}</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {reports.map(r => (
              <div key={r.filename} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-100/50 dark:bg-gray-800/50 transition">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm text-text-primary font-medium">{r.filename}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {new Date(r.createdAt).toLocaleString('pt-BR')} • {formatSize(r.sizeBytes)}
                    </p>
                  </div>
                </div>
                <button onClick={() => downloadReport(r.filename)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-active border border-border rounded-lg text-xs text-text-secondary transition">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && <ScheduleModal onClose={() => { setShowScheduleModal(false); loadSchedules() }} />}
    </div>
  )
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(t('reports.weeklyReport'))
  const [frequency, setFrequency] = useState('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [hour, setHour] = useState(8)
  const [recipients, setRecipients] = useState('')
  const [periodDays, setPeriodDays] = useState(7)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const emails = recipients.split(',').map(e => e.trim()).filter(Boolean)
    if (!name || !emails.length) return
    setSaving(true)
    try {
      await api.post('/api/reports/schedules', { name, frequency, dayOfWeek, hour, recipients: emails, periodDays })
      onClose()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">{t('reports.createSchedule')}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-tertiary block mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary block mb-1">Frequência</label>
              <SearchableSelect
                value={frequency}
                onChange={setFrequency}
                searchable={false}
                options={[
                  { value: 'daily', label: 'Diário' },
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'monthly', label: 'Mensal' },
                ]}
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary block mb-1">Hora (UTC)</label>
              <input type="number" min={0} max={23} value={hour} onChange={e => setHour(+e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
            </div>
          </div>
          {frequency === 'weekly' && (
            <div>
              <label className="text-xs text-text-tertiary block mb-1">Dia da Semana</label>
              <SearchableSelect
                value={String(dayOfWeek)}
                onChange={v => setDayOfWeek(+v)}
                searchable={false}
                options={[t('reports.days.sun'),t('reports.days.mon'),t('reports.days.tue'),t('reports.days.wed'),t('reports.days.thu'),t('reports.days.fri'),t('reports.days.sat')].map((d,i) => ({ value: String(i), label: d }))}
              />
            </div>
          )}
          <div>
            <label className="text-xs text-text-tertiary block mb-1">Período do relatório</label>
            <SearchableSelect
              value={String(periodDays)}
              onChange={v => setPeriodDays(+v)}
              searchable={false}
              options={[
                { value: '7', label: '7 dias' },
                { value: '14', label: '14 dias' },
                { value: '30', label: '30 dias' },
              ]}
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary block mb-1">Destinatários (emails separados por vírgula)</label>
            <input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="dba@empresa.com, gestor@empresa.com"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-tertiary hover:text-gray-700 dark:hover:text-text-secondary">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
