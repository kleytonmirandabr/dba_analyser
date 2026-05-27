import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Cpu, MemoryStick, Server, CheckCircle2, XCircle, Loader2, RefreshCw, HardDrive } from 'lucide-react'
import api from '../lib/api'

interface Node {
  name: string; status: string;
  cpu: { allocatable: number; capacity: number };
  memory: { allocatable: number; capacity: number };
  pods: { allocatable: number; count: number };
  kubeletVersion: string; osImage: string; kernelVersion: string;
  containerRuntime: string; instanceType: string; age: string;
}

export default function K8sNodesPage() {
  const { t } = useTranslation()
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/k8s/clusters').then(({ data }) => {
      setClusters(data.data)
      if (data.data.length > 0) setSelectedCluster(data.data[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fetchNodes = () => {
    if (!selectedCluster) return
    setLoading(true); setError('')
    api.get(`/api/k8s/nodes/${selectedCluster}`)
      .then(({ data }) => { setNodes(data.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }

  useEffect(() => { fetchNodes() }, [selectedCluster])

  const formatMemory = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} Gi`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} Mi`
    return `${(bytes / 1024).toFixed(0)} Ki`
  }

  const formatCpu = (cores: number) => cores >= 1 ? `${cores.toFixed(1)} cores` : `${Math.round(cores * 1000)}m`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nodes</h1>
          <p className="text-sm text-text-secondary mt-1">Nós do cluster (worker nodes)</p>
        </div>
        <div className="flex items-center gap-3">
          {clusters.length > 1 && (
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary">
              {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={fetchNodes} className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-active text-text-secondary transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : nodes.length === 0 ? (
        <div className="p-8 bg-surface border border-border rounded-xl text-center">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-text-secondary">{t('k8s.nodes.noNodesFound')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nodes.map(node => (
            <div key={node.name} className="bg-surface border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/20 flex items-center justify-center">
                    <Server className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{node.name}</h3>
                    <p className="text-[10px] text-text-tertiary">{node.instanceType || 'N/A'} · {node.age}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border ${
                  node.status === 'Ready' ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'
                }`}>
                  {node.status === 'Ready' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {node.status}
                </span>
              </div>

              {/* Resource bars */}
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-text-secondary flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                    <span className="text-[10px] text-text-tertiary">{formatCpu(node.cpu.allocatable)} allocatable</span>
                  </div>
                  <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (node.cpu.allocatable / node.cpu.capacity) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-text-secondary flex items-center gap-1"><HardDrive className="w-3 h-3" /> Memória</span>
                    <span className="text-[10px] text-text-tertiary">{formatMemory(node.memory.allocatable)} allocatable</span>
                  </div>
                  <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (node.memory.allocatable / node.memory.capacity) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-surface-elevated rounded-lg px-3 py-2">
                  <p className="text-text-tertiary">Kubelet</p>
                  <p className="text-text-primary font-medium">{node.kubeletVersion}</p>
                </div>
                <div className="bg-surface-elevated rounded-lg px-3 py-2">
                  <p className="text-text-tertiary">Container Runtime</p>
                  <p className="text-text-primary font-medium truncate">{node.containerRuntime}</p>
                </div>
                <div className="bg-surface-elevated rounded-lg px-3 py-2">
                  <p className="text-text-tertiary">OS</p>
                  <p className="text-text-primary font-medium truncate">{node.osImage}</p>
                </div>
                <div className="bg-surface-elevated rounded-lg px-3 py-2">
                  <p className="text-text-tertiary">Pods (max)</p>
                  <p className="text-text-primary font-medium">{node.pods.allocatable}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
