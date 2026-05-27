import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { GitCompareArrows, Loader2, Table2, Code2, Eye, Zap } from 'lucide-react'
import api from '../lib/api'
import { TablesSection, ObjectsSection } from '../components/compare'
import type { FullDiff, Connection } from '../components/compare'

export default function ComparePage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [schema, setSchema] = useState('')
  const [diff, setDiff] = useState<FullDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'tables' | 'triggers' | 'procedures' | 'functions' | 'views'>('tables')

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data.filter((c: any) => c.databaseName))).catch(() => {})
  }, [])

  const compare = async () => {
    if (!sourceId || !targetId) return
    setLoading(true); setError(''); setDiff(null)
    try {
      const payload: any = { sourceId, targetId }
      if (schema) payload.schema = schema
      const { data } = await api.post('/api/compare', payload)
      setDiff(data.data)
    } catch (err: any) { setError(err.response?.data?.error || err.message) }
    setLoading(false)
  }

  const tabs = [
    { id: 'tables' as const, label: 'Tabelas', icon: Table2, count: diff?.summary.tables || 0 },
    { id: 'triggers' as const, label: 'Triggers', icon: Zap, count: diff?.summary.triggers || 0 },
    { id: 'procedures' as const, label: 'Procedures', icon: Code2, count: diff?.summary.procedures || 0 },
    { id: 'functions' as const, label: 'Functions', icon: Code2, count: diff?.summary.functions || 0 },
    { id: 'views' as const, label: 'Views', icon: Eye, count: diff?.summary.views || 0 },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
        <GitCompareArrows className="w-6 h-6 text-purple-400" /> Comparador de Schemas
      </h1>

      {/* Selectors */}
      <div className="flex items-end gap-4 mb-6 p-4 bg-surface border border-border rounded-xl">
        <div className="flex-1">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Source</label>
          <SearchableSelect
            value={sourceId}
            onChange={setSourceId}
            placeholder={t('common.select') + '...'}
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.databaseName})` }))}
          />
        </div>
        <GitCompareArrows className="w-6 h-6 text-gray-600 mb-2" />
        <div className="flex-1">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Target</label>
          <SearchableSelect
            value={targetId}
            onChange={setTargetId}
            placeholder={t('common.select') + '...'}
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.databaseName})` }))}
          />
        </div>
        <div className="w-32">
          <label className="block text-[10px] text-text-tertiary mb-1 font-medium uppercase">Schema</label>
          <input className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" 
            value={schema} onChange={e => setSchema(e.target.value)} placeholder="auto" />
        </div>
        <button onClick={compare} disabled={loading || !sourceId || !targetId}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
          Comparar
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

      {diff && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Total', value: diff.summary.total, color: diff.summary.total > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Tabelas', value: diff.summary.tables, color: 'text-blue-400' },
              { label: 'Colunas', value: diff.summary.columns, color: 'text-purple-400' },
              { label: 'Triggers', value: diff.summary.triggers, color: 'text-yellow-400' },
              { label: 'Procedures', value: diff.summary.procedures, color: 'text-orange-400' },
              { label: 'Views', value: diff.summary.views, color: 'text-cyan-400' },
            ].map(s => (
              <div key={s.label} className="p-3 bg-surface border border-border rounded-lg text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-text-tertiary">{s.label}</p>
              </div>
            ))}
          </div>

          {diff.summary.total === 0 ? (
            <div className="p-8 bg-green-900/10 border border-green-800/30 rounded-xl text-center">
              <p className="text-green-400 text-lg font-semibold">✅ Schemas idênticos</p>
              <p className="text-sm text-text-tertiary mt-1">{t('compare.noDifferences')}</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-surface p-1 rounded-lg border border-border">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-white hover:bg-surface-elevated'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                    {tab.count > 0 && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
                  </button>
                ))}
              </div>

              {/* Content */}
              {activeTab === 'tables' && <TablesSection tables={diff.tables} />}
              {activeTab === 'triggers' && <ObjectsSection objects={diff.triggers} type="Trigger" />}
              {activeTab === 'procedures' && <ObjectsSection objects={diff.procedures} type="Procedure" />}
              {activeTab === 'functions' && <ObjectsSection objects={diff.functions} type="Function" />}
              {activeTab === 'views' && <ObjectsSection objects={diff.views} type="View" />}
            </>
          )}
        </>
      )}
    </div>
  )
}
