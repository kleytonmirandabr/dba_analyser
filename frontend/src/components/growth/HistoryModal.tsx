import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import api from '../../lib/api'
import { formatBytes } from './Sparkline'

interface GrowthTable { tableName: string; currentSizeMB: number; rowCount: number; growthPercent: number; history?: any[] }

export default function HistoryModal({ table, onClose }: { table: GrowthTable; onClose: () => void }) {
  const history = table.history || []
  const maxRows = Math.max(...history.map(h => h.rows), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-[620px] max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-text-primary font-semibold text-lg">📊 Histórico de Snapshots</h3>
            <p className="text-xs text-text-secondary font-mono mt-0.5">{table.schema}.{table.table}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Rows Atual</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{table.currentRows.toLocaleString()}</p>
            </div>
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Delta Hoje</p>
              <p className={`text-2xl font-bold mt-1 ${table.dailyDelta > 0 ? 'text-green-400' : table.dailyDelta < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                {table.dailyDelta > 0 ? '+' : ''}{table.dailyDelta.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Média 7d</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{table.avgDailyGrowth > 0 ? '+' : ''}{table.avgDailyGrowth.toLocaleString()}/dia</p>
            </div>
          </div>
          {history.length > 1 ? (
            <div>
              <p className="text-xs text-text-tertiary mb-3 font-medium">Evolução diária:</p>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map((h, i) => {
                  const prev = i > 0 ? history[i-1].rows : h.rows
                  const delta = h.rows - prev
                  const pct = (h.rows / maxRows) * 100
                  return (
                    <div key={h.date} className="flex items-center gap-3 text-xs group hover:bg-gray-100/30 dark:hover:bg-gray-800/30 rounded-lg px-2 py-1 transition">
                      <span className="text-text-tertiary font-mono w-16 flex-shrink-0">{h.date.slice(5)}</span>
                      <div className="flex-1 h-6 bg-gray-100/60 dark:bg-gray-800/60 rounded-lg overflow-hidden relative">
                        <div className={`h-full rounded-lg transition-all ${delta >= 0 ? 'bg-blue-600/40' : 'bg-red-600/30'}`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center px-2.5 text-[11px] text-text-primary font-mono">
                          {h.rows.toLocaleString()}
                        </span>
                      </div>
                      <span className={`w-20 text-right flex-shrink-0 font-mono font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                        {i === 0 ? '—' : (delta > 0 ? '+' : '') + delta.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-800/20 rounded-xl border border-border/50">
              <Database className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Ainda não há histórico suficiente.</p>
              <p className="text-gray-600 text-xs mt-1">Volte amanhã para ver a comparação entre snapshots.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
