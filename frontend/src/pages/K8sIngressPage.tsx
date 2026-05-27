import { useState, useEffect } from 'react'
import { ExternalLink, Shield, ShieldOff, Loader2, RefreshCw, Search, Globe } from 'lucide-react'
import api from '../lib/api'

interface Ingress {
  name: string; namespace: string; hosts: string[]; tls: boolean; tlsHosts: string[];
  rules: { host: string; paths: { path: string; service: string; port: number }[] }[];
  loadBalancerIP: string | null; age: string;
}

export default function K8sIngressPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  const [ingresses, setIngresses] = useState<Ingress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/api/k8s/clusters').then(({ data }) => {
      setClusters(data.data)
      if (data.data.length > 0) setSelectedCluster(data.data[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchIngress = () => {
    if (!selectedCluster) return
    setLoading(true); setError('')
    api.get(`/api/k8s/ingress/${selectedCluster}`)
      .then(({ data }) => { setIngresses(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }

  useEffect(() => { fetchIngress() }, [selectedCluster])

  const filtered = ingresses.filter(i => {
    if (!search) return true
    return i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.hosts.some(h => h.toLowerCase().includes(search.toLowerCase()))
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Ingress</h1>
          <p className="text-sm text-text-secondary mt-1">Regras de entrada HTTP/S do cluster</p>
        </div>
        <div className="flex items-center gap-3">
          {clusters.length > 1 && (
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
              {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={fetchIngress} className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-active text-text-secondary transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ingress ou host..."
          className="w-full pl-10 pr-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <ExternalLink className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">Nenhum ingress encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(ing => (
            <div key={`${ing.namespace}/${ing.name}`} className="bg-surface border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-900/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{ing.name}</h3>
                    <p className="text-[10px] text-text-tertiary">{ing.namespace} · {ing.age}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ing.tls ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/20 text-green-400 border border-green-800">
                      <Shield className="w-3 h-3" /> TLS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-900/20 text-red-400 border border-red-800">
                      <ShieldOff className="w-3 h-3" /> HTTP
                    </span>
                  )}
                  {ing.loadBalancerIP && (
                    <span className="text-[10px] text-text-tertiary font-mono">{ing.loadBalancerIP}</span>
                  )}
                </div>
              </div>

              {/* Rules */}
              <div className="space-y-2">
                {ing.rules.map((rule, ri) => (
                  <div key={ri} className="bg-surface-elevated rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                      <span className="text-xs font-semibold text-text-primary">{rule.host}</span>
                      {ing.tls && ing.tlsHosts.includes(rule.host) && <Shield className="w-3 h-3 text-green-400" />}
                    </div>
                    <div className="space-y-1 ml-5">
                      {rule.paths.map((path, pi) => (
                        <div key={pi} className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-text-secondary bg-surface px-1.5 py-0.5 rounded">{path.path}</span>
                          <span className="text-text-tertiary">→</span>
                          <span className="text-blue-400 font-medium">{path.service}</span>
                          <span className="text-text-tertiary">:{path.port}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
