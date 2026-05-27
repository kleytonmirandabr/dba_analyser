import { useState, useEffect } from 'react'
import { Rocket, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import api from '../lib/api'

interface Deployment {
  name: string; namespace: string; status: 'healthy' | 'progressing' | 'degraded';
  replicas: { desired: number; ready: number; available: number; updated: number };
  image: string; strategy: string; age: string; restartCount: number;
}

export default function K8sDeploymentsPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/k8s/clusters').then(({ data }) => {
      setClusters(data.data)
      if (data.data.length > 0) setSelectedCluster(data.data[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedCluster) return
    setLoading(true); setError('')
    api.get(`/api/k8s/deployments/${selectedCluster}`)
      .then(({ data }) => { setDeployments(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }, [selectedCluster])

  const refresh = () => {
    if (!selectedCluster) return
    setLoading(true)
    api.get(`/api/k8s/deployments/${selectedCluster}`)
      .then(({ data }) => { setDeployments(data.data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'progressing': return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
      case 'degraded': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-900/20 text-green-400 border-green-800'
      case 'progressing': return 'bg-amber-900/20 text-amber-400 border-amber-800'
      case 'degraded': return 'bg-red-900/20 text-red-400 border-red-800'
      default: return 'bg-gray-900/20 text-gray-400 border-gray-700'
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deployments</h1>
          <p className="text-sm text-text-secondary mt-1">Aplicações e seus status no cluster</p>
        </div>
        <div className="flex items-center gap-3">
          {clusters.length > 1 && (
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
              {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={refresh} className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-active text-text-secondary transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : deployments.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <Rocket className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">Nenhum deployment encontrado nos namespaces monitorados</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Deployment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Namespace</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Replicas</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Imagem (Versão)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Restarts</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Age</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(dep => (
                <tr key={`${dep.namespace}/${dep.name}`} className="border-b border-border hover:bg-surface-elevated/50 transition">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${statusColor(dep.status)}`}>
                      {statusIcon(dep.status)}
                      {dep.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{dep.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-[10px]">{dep.namespace}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${dep.replicas.ready === dep.replicas.desired ? 'text-green-400' : 'text-amber-400'}`}>
                      {dep.replicas.ready}/{dep.replicas.desired}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary text-xs max-w-[250px] truncate" title={dep.image}>
                    {dep.image.split('/').pop()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${dep.restartCount > 5 ? 'text-red-400 font-bold' : dep.restartCount > 0 ? 'text-amber-400' : 'text-text-tertiary'}`}>
                      {dep.restartCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{dep.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
