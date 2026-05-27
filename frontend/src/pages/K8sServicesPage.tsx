import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Globe, ExternalLink, Loader2, RefreshCw, Search, Network } from 'lucide-react'
import api from '../lib/api'

interface Service {
  name: string; namespace: string; type: string; clusterIP: string;
  externalIP: string | null; ports: { port: number; targetPort: number | string; protocol: string; name?: string }[];
  selector: Record<string, string>; age: string;
}

export default function K8sServicesPage() {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    api.get('/api/k8s/clusters').then(({ data }) => {
      setClusters(data.data)
      if (data.data.length > 0) setSelectedCluster(data.data[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchServices = () => {
    if (!selectedCluster) return
    setLoading(true); setError('')
    api.get(`/api/k8s/services/${selectedCluster}`)
      .then(({ data }) => { setServices(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }

  useEffect(() => { fetchServices() }, [selectedCluster])

  const filtered = services.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && s.type !== typeFilter) return false
    return true
  })

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      ClusterIP: 'bg-blue-900/20 text-blue-400 border-blue-800',
      LoadBalancer: 'bg-purple-900/20 text-purple-400 border-purple-800',
      NodePort: 'bg-amber-900/20 text-amber-400 border-amber-800',
      ExternalName: 'bg-green-900/20 text-green-400 border-green-800',
    }
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${map[type] || 'bg-gray-900/20 text-gray-400 border-gray-700'}`}>{type}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Services</h1>
          <p className="text-sm text-text-secondary mt-1">Serviços de rede do Kubernetes</p>
        </div>
        <div className="flex items-center gap-3">
          {clusters.length > 1 && (
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
              {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={fetchServices} className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-active text-text-secondary transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('k8s.services.searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
          <option value="all">Todos tipos</option>
          <option value="ClusterIP">ClusterIP</option>
          <option value="LoadBalancer">LoadBalancer</option>
          <option value="NodePort">NodePort</option>
          <option value="ExternalName">ExternalName</option>
        </select>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <Globe className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">{t('k8s.services.noServicesFound')}</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Namespace</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Cluster IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">External IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Portas</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(svc => (
                <tr key={`${svc.namespace}/${svc.name}`} className="border-b border-border hover:bg-surface-elevated/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-text-primary">{svc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-[10px]">{svc.namespace}</span>
                  </td>
                  <td className="px-4 py-3">{typeBadge(svc.type)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-tertiary">{svc.clusterIP}</td>
                  <td className="px-4 py-3">
                    {svc.externalIP ? (
                      <span className="font-mono text-xs text-green-400 flex items-center gap-1">
                        {svc.externalIP} <ExternalLink className="w-3 h-3" />
                      </span>
                    ) : <span className="text-text-tertiary text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {svc.ports.map((p, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-surface-elevated text-[10px] text-text-secondary font-mono">
                          {p.port}:{p.targetPort}/{p.protocol}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{svc.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
