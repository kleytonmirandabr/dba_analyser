import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import api from '../../lib/api'

interface GrowthTable { tableName: string; currentSizeMB: number; rowCount: number; growthPercent: number; }

export default function RuleModal({ table, connectionId, onClose }: { table: GrowthTable; connectionId: string; onClose: () => void }) {
  const [maxGrowthPct, setMaxGrowthPct] = useState(300)
  const [maxShrinkPct, setMaxShrinkPct] = useState(10)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/api/growth/${connectionId}/rules`, {
        schemaName: table.schema, tableName: table.table,
        maxDailyGrowthPct: maxGrowthPct, maxShrinkPct: maxShrinkPct
      })
      onClose()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-text-primary font-semibold">⚙️ Regras de Alerta</h3>
            <p className="text-xs text-text-secondary font-mono mt-0.5">{table.schema}.{table.table}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Crescimento máximo (% da média diária)</label>
            <input type="number" value={maxGrowthPct} onChange={e => setMaxGrowthPct(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-blue-500" />
            <p className="text-[10px] text-gray-600 mt-1">Alerta se crescer mais que {maxGrowthPct}% da média</p>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Redução máxima (%)</label>
            <input type="number" value={maxShrinkPct} onChange={e => setMaxShrinkPct(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-blue-500" />
            <p className="text-[10px] text-gray-600 mt-1">Alerta se encolher mais que {maxShrinkPct}%</p>
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm bg-surface-elevated hover:bg-surface-active text-text-secondary rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
