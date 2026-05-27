import { useState, useEffect } from 'react'
import { Cloud, Server, Box, Rocket, Globe, Cpu, MemoryStick, Loader2, AlertCircle } from 'lucide-react'
import api from '../lib/api'

interface Overview {
  nodes: { total: number; ready: number; notReady: number }
  pods: { total: number; running: number; pending: number; failed: number; succeeded: number }
  deployments: { total: number; healthy: number; progressing: number; degraded: number }
  services: { total: number; loadBalancers: number }
  ingresses: number
  cpu?: { used: number; allocatable: number; percent: number }
  memory?: { used: number; allocatable: number; percent: number }
}

export default function K8sDashboardPage() {
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [overview, setOverview] = useState<Overview | null>(null)
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
    api.get(`/api/k8s/overview/${selectedCluster}`)
      .then(({ data }) => { setOverview(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }, [selectedCluster])

  if (loading && clusters.length === 0) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>

  if (clusters.length === 0) return (
    <div className="text-center py-20">
      <Cloud className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <h2 className="text-lg font-bold text-text-primary mb-2">Nenhum cluster configurado</h2>
      <p className="text-sm text-text-secondary mb-4">Adicione um cluster AKS para começar a monitorar</p>
      <a href="/k8s/clusters" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition">Adicionar Cluster</a>
    </div>
  )

  const StatCard = ({ icon: Icon, label, value, sub, color = 'text-blue-400' }: any) => (
    <div className="bg-surface border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-secondary">{label}</p>
        </div>
      </div>
      {sub && <p className="text-[10px] text-text-tertiary mt-2 ml-[52px]">{sub}</p>}
    </div>
  )

  const GaugeBar = ({ percent, label, color = 'bg-blue-500' }: { percent: number; label: string; color?: string }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <span className="text-sm font-bold text-text-primary">{percent}%</span>
      </div>
      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color} ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : ''}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Kubernetes Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Visão geral do cluster AKS</p>
        </div>
        {clusters.length > 1 && (
          <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
            className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
            {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : overview && (
        <>
          {/* Main stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Server} label="Nodes" value={overview.nodes.total}
              sub={`${overview.nodes.ready} ready / ${overview.nodes.notReady} not-ready`} color="text-green-400" />
            <StatCard icon={Box} label="Pods" value={overview.pods.total}
              sub={`${overview.pods.running} running / ${overview.pods.pending} pending / ${overview.pods.failed} failed`} color="text-blue-400" />
            <StatCard icon={Rocket} label="Deployments" value={overview.deployments.total}
              sub={`${overview.deployments.healthy} healthy / ${overview.deployments.degraded} degraded`} color="text-purple-400" />
            <StatCard icon={Globe} label="Services" value={overview.services.total}
              sub={`${overview.services.loadBalancers} load balancers / ${overview.ingresses} ingress`} color="text-amber-400" />
          </div>

          {/* Resource utilization */}
          {(overview.cpu || overview.memory) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {overview.cpu && <GaugeBar percent={overview.cpu.percent} label="CPU Cluster" color="bg-blue-500" />}
              {overview.memory && <GaugeBar percent={overview.memory.percent} label="Memória Cluster" color="bg-purple-500" />}
            </div>
          )}

          {/* Pods by status */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Status dos Pods</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-text-secondary">Running: {overview.pods.running}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs text-text-secondary">Pending: {overview.pods.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-text-secondary">Failed: {overview.pods.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-xs text-text-secondary">Succeeded: {overview.pods.succeeded}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
