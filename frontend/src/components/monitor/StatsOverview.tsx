import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ConnStats { connId: string; connName: string; databaseSize: number; activeConnections: number; totalConnections: number; cacheHitRatio: number }

interface Props {
  allStats: ConnStats[]
  formatBytes: (b: number) => string
}

export default function StatsOverview({ allStats, formatBytes }: Props) {
  const { t } = useTranslation()
  const [showTable, setShowTable] = useState(false)
  const totalSize = allStats.reduce((a, s) => a + (s.databaseSize || 0), 0)
  const totalActive = allStats.reduce((a, s) => a + (s.activeConnections || 0), 0)
  const totalConns = allStats.reduce((a, s) => a + (s.totalConnections || 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tamanho Total', value: formatBytes(totalSize), color: 'text-blue-400' },
          { label: t('monitor.activeConnections'), value: totalActive, color: 'text-green-400' },
          { label: t('monitor.totalConnections'), value: totalConns, color: 'text-amber-400' },
          { label: 'Bancos', value: allStats.length, color: 'text-purple-400' },
        ].map((s, i) => (
          <div key={i} className="p-3 bg-surface border border-border rounded-xl">
            <p className="text-[10px] text-text-tertiary">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {allStats.length > 1 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <button onClick={() => setShowTable(!showTable)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-100/50 dark:bg-gray-800/50 transition">
            {showTable ? <ChevronDown className="w-3 h-3 text-text-tertiary" /> : <ChevronRight className="w-3 h-3 text-text-tertiary" />}
            <span className="text-[10px] text-text-tertiary">Detalhes por banco</span>
          </button>
          {showTable && (
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-border text-text-tertiary">
                  <th className="text-left py-1.5 px-3">Banco</th>
                  <th className="text-right py-1.5 px-3">Tamanho</th>
                  <th className="text-right py-1.5 px-3">Ativas</th>
                  <th className="text-right py-1.5 px-3">Total</th>
                </tr></thead>
                <tbody>
                  {allStats.sort((a, b) => b.databaseSize - a.databaseSize).map(s => (
                    <tr key={s.connId} className="border-b border-gray-100 dark:border-gray-900">
                      <td className="py-1 px-3 text-text-secondary">{s.connName.replace('SQL / ', '')}</td>
                      <td className="py-1 px-3 text-right text-blue-400 font-mono">{formatBytes(s.databaseSize)}</td>
                      <td className="py-1 px-3 text-right text-green-400 font-mono">{s.activeConnections}</td>
                      <td className="py-1 px-3 text-right text-text-tertiary font-mono">{s.totalConnections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
