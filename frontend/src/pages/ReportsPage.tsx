import { useState, useEffect } from 'react'
import { FileText, Download, Send, Plus, Calendar, Loader2, Clock, Trash2, Mail } from 'lucide-react'
import api from '../lib/api'

interface ReportFile { filename: string; sizeBytes: number; createdAt: string }
interface Schedule { id: string; name: string; frequency: string; dayOfWeek: number; hour: number; recipients: string[]; periodDays: number; enabled: boolean; lastSentAt?: string; lastError?: string }

export default function ReportsPage() {
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
  const freqLabel: Record<string, string> = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={periodDays} onChange={e => setPeriodDays(+e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button onClick={generateReport} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Gerar Agora
          </button>
          <button onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition">
            <Calendar className="w-4 h-4" /> Agendar
          </button>
        </div>
      </div>

      {/* Schedules */}
      {schedules.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Agendamentos Ativos</p>
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{s.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {freqLabel[s.frequency]} às {s.hour}:00 UTC • {s.recipients.length} destinatário(s)
                      {s.lastSentAt && ` • Último envio: ${new Date(s.lastSentAt).toLocaleDateString('pt-BR')}`}
                    </p>
                    {s.lastError && <p className="text-[10px] text-red-400">Erro: {s.lastError}</p>}
                  </div>
                </div>
                <button onClick={() => deleteSchedule(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Relatórios Gerados</p>
        </div>
        {reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">Nenhum relatório gerado ainda. Clique em "Gerar Agora".</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {reports.map(r => (
              <div key={r.filename} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{r.filename}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(r.createdAt).toLocaleString('pt-BR')} • {formatSize(r.sizeBytes)}
                    </p>
                  </div>
                </div>
                <button onClick={() => downloadReport(r.filename)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition">
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
  const [name, setName] = useState('Relatório Semanal')
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
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agendar Relatório</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Frequência</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hora (UTC)</label>
              <input type="number" min={0} max={23} value={hour} onChange={e => setHour(+e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
            </div>
          </div>
          {frequency === 'weekly' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Dia da Semana</label>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(+e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Período do relatório</label>
            <select value={periodDays} onChange={e => setPeriodDays(+e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white">
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Destinatários (emails separados por vírgula)</label>
            <input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="dba@empresa.com, gestor@empresa.com"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancelar</button>
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
