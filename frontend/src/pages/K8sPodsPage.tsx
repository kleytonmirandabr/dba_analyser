import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Box, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw, Search, Filter } from 'lucide-react'
import api from '../lib/api'

interface Pod {
  name: string; namespace: string; phase: string; statusDetail: string;
  restarts: number; node: string; ip: string; age: string; createdAt: string;
  containers: { name: string; ready: boolean; image: string; restarts: number }[];
}

export default function K8sPodsPage() {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/k8s/clusters').then(({ data }) => {
      setClusters(data.data)
      if (data.data.length > 0) setSelectedCluster(data.data[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchPods = () => {
    if (!selectedCluster) return
    setLoading(true); setError('')
    api.get(`/api/k8s/pods/${selectedCluster}`)
      .then(({ data }) => { setPods(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }

  useEffect(() => { fetchPods() }, [selectedCluster])

  const filtered = pods.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.namespace.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && p.phase.toLowerCase() !== statusFilter) return false
    return true
  })

  const statusBadge = (phase: string, detail: string) => {
    const map: Record<string, string> = {
      Running: 'bg-green-900/20 text-green-400 border-green-800',
      Pending: 'bg-amber-900/20 text-amber-400 border-amber-800',
      Failed: 'bg-red-900/20 text-red-400 border-red-800',
      Succeeded: 'bg-blue-900/20 text-blue-400 border-blue-800',
      Unknown: 'bg-gray-900/20 text-gray-400 border-gray-700',
    }
    const cls = map[phase] || map.Unknown
    const icon = phase === 'Running' ? <CheckCircle2 className="w-3 h-3" /> :
                 phase === 'Failed' ? <XCircle className="w-3 h-3" /> :
                 phase === 'Pending' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                 <AlertTriangle className="w-3 h-3" />
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
        {icon} {detail !== phase ? detail : phase}
      </span>
    )
  }

  const stats = {
    total: pods.length,
    running: pods.filter(p => p.phase === 'Running').length,
    pending: pods.filter(p => p.phase === 'Pending').length,
    failed: pods.filter(p => p.phase === 'Failed').length,
    highRestarts: pods.filter(p => p.restarts > 5).length
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('k8s.pods.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('k8s.pods.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {clusters.length > 1 && (
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
              {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={fetchPods} className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-active text-text-secondary transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className="bg-surface border border-border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-text-primary">{stats.total}</p>
          <p className="text-[10px] text-text-tertiary">{t('k8s.pods.total')}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-400">{stats.running}</p>
          <p className="text-[10px] text-text-tertiary">{t('k8s.pods.running')}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{stats.pending}</p>
          <p className="text-[10px] text-text-tertiary">{t('k8s.pods.pending')}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-red-400">{stats.failed}</p>
          <p className="text-[10px] text-text-tertiary">{t('k8s.pods.failed')}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-orange-400">{stats.highRestarts}</p>
          <p className="text-[10px] text-text-tertiary">Alto Restart</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('k8s.pods.searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
          <option value="all">{t('k8s.pods.allStatus')}</option>
          <option value="running">{t('k8s.pods.running')}</option>
          <option value="pending">{t('k8s.pods.pending')}</option>
          <option value="failed">{t('k8s.pods.failed')}</option>
          <option value="succeeded">{t('k8s.pods.succeeded')}</option>
        </select>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">{t('k8s.pods.noPodsFound')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pod => (
            <div key={`${pod.namespace}/${pod.name}`}
              className="bg-surface border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpanded(expanded === pod.name ? null : pod.name)}>
                <div className="w-8 h-8 rounded-lg bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <Box className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">{pod.name}</p>
                    {statusBadge(pod.phase, pod.statusDetail)}
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{pod.namespace} · Node: {pod.node || '—'} · IP: {pod.ip || '—'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-mono ${pod.restarts > 5 ? 'text-red-400 font-bold' : pod.restarts > 0 ? 'text-amber-400' : 'text-text-tertiary'}`}>
                    {pod.restarts} restart{pod.restarts !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-text-tertiary">{pod.age}</p>
                </div>
              </div>

              {expanded === pod.name && pod.containers.length > 0 && (
                <div className="border-t border-border bg-surface-elevated/50 px-4 py-3">
                  <p className="text-[10px] font-semibold text-text-secondary uppercase mb-2">Containers ({pod.containers.length})</p>
                  <div className="space-y-1.5">
                    {pod.containers.map(c => (
                      <div key={c.name} className="flex items-center gap-3 text-xs">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.ready ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-text-primary">{c.name}</span>
                        <span className="text-text-tertiary truncate flex-1">{c.image.split('/').pop()}</span>
                        <span className={`${c.restarts > 0 ? 'text-amber-400' : 'text-text-tertiary'}`}>{c.restarts}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
