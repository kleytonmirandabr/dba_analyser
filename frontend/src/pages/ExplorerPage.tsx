import { useState, useEffect } from 'react'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useTranslation } from 'react-i18next'
import { Database, Table2, Columns3, Key, Eye, Code2, Zap, Search, ChevronRight, ChevronDown, Loader2, FolderOpen } from 'lucide-react'
import api from '../lib/api'

interface Connection { id: string; name: string; dbType: string; environment: string; }
type NodeType = 'schema' | 'table' | 'view' | 'function' | 'trigger'

interface TreeNode {
  id: string; label: string; type: NodeType; children?: TreeNode[]; loaded?: boolean; loading?: boolean;
  schema?: string; table?: string;
}

export default function ExplorerPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState<string>('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<any>(null)
  const [detailType, setDetailType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  const loadSchemas = async (connId: string) => {
    setSelectedConn(connId)
    setLoading(true)
    setDetail(null)
    try {
      const { data } = await api.get(`/api/explorer/${connId}/schemas`)
      const schemas: TreeNode[] = data.data.map((s: string) => ({
        id: `schema:${s}`, label: s, type: 'schema' as NodeType,
        schema: s, loaded: false,
        children: [
          { id: `${s}:tables`, label: t('explorer.tables'), type: 'table' as NodeType, schema: s, children: [], loaded: false },
          { id: `${s}:views`, label: 'Views', type: 'view' as NodeType, schema: s, children: [], loaded: false },
          { id: `${s}:functions`, label: t('explorer.functions'), type: 'function' as NodeType, schema: s, children: [], loaded: false },
          { id: `${s}:triggers`, label: 'Triggers', type: 'trigger' as NodeType, schema: s, children: [], loaded: false },
        ]
      }))
      setTree(schemas)
    } catch {}
    setLoading(false)
  }

  const loadChildren = async (node: TreeNode) => {
    if (node.loaded) return
    const schema = node.schema || 'public'
    try {
      if (node.id.endsWith(':tables')) {
        const { data } = await api.get(`/api/explorer/${selectedConn}/tables?schema=${schema}`)
        node.children = data.data.map((t: any) => ({ id: `${schema}.${t.name}`, label: t.name, type: 'table', schema, table: t.name }))
      } else if (node.id.endsWith(':views')) {
        const { data } = await api.get(`/api/explorer/${selectedConn}/views?schema=${schema}`)
        node.children = data.data.map((v: any) => ({ id: `view:${schema}.${v.name}`, label: v.name, type: 'view', schema }))
      } else if (node.id.endsWith(':functions')) {
        const { data } = await api.get(`/api/explorer/${selectedConn}/functions?schema=${schema}`)
        node.children = data.data.map((f: any) => ({ id: `fn:${schema}.${f.name}`, label: `${f.name}(${f.parameters || ''})`, type: 'function', schema }))
      } else if (node.id.endsWith(':triggers')) {
        const { data } = await api.get(`/api/explorer/${selectedConn}/triggers?schema=${schema}`)
        node.children = data.data.map((t: any) => ({ id: `trg:${t.name}`, label: `${t.name} → ${t.table}`, type: 'trigger', schema }))
      }
      node.loaded = true
      setTree([...tree])
    } catch {}
  }

  const loadDetail = async (node: TreeNode) => {
    if (node.type === 'table' && node.table) {
      const { data } = await api.get(`/api/explorer/${selectedConn}/columns/${node.schema}/${node.table}`)
      setDetail(data.data)
      setDetailType(`Tabela: ${node.schema}.${node.table}`)
    } else if (node.type === 'view') {
      setDetail(null)
      setDetailType(`View: ${node.label}`)
    }
  }

  const toggle = (nodeId: string) => {
    const next = new Set(expanded)
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId)
    setExpanded(next)
  }

  const renderNode = (node: TreeNode, depth = 0): JSX.Element => {
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.children && node.children.length > 0 || !node.loaded
    const icons: Record<string, any> = { schema: FolderOpen, table: Table2, view: Eye, function: Code2, trigger: Zap }
    const Icon = icons[node.type] || Database

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 hover:bg-surface-elevated rounded cursor-pointer text-sm ${detail && detailType.includes(node.label) ? 'bg-surface-elevated text-blue-400' : 'text-text-secondary'}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) { toggle(node.id); loadChildren(node) }
            loadDetail(node)
          }}
        >
          {hasChildren ? (isExpanded ? <ChevronDown className="w-3 h-3 text-text-tertiary" /> : <ChevronRight className="w-3 h-3 text-text-tertiary" />) : <span className="w-3" />}
          <Icon className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="truncate">{node.label}</span>
          {node.type === 'table' && node.children && <span className="text-[10px] text-gray-600 ml-auto">{node.children.length}</span>}
        </div>
        {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  const filteredTree = search
    ? tree.map(s => ({ ...s, children: s.children?.filter(c => c.children?.some(t => t.label.toLowerCase().includes(search.toLowerCase()))) })).filter(s => s.children && s.children.length > 0)
    : tree

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel - Tree */}
      <div className="w-80 bg-surface border-r border-border flex flex-col">
        {/* Connection selector */}
        <div className="p-3 border-b border-border">
          <SearchableSelect
            value={selectedConn}
            onChange={loadSchemas}
            placeholder={t('connections.search')}
            options={connections.map(c => ({ value: c.id, label: `${c.name} (${c.environment})` }))}
          />
        </div>
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-text-tertiary" />
            <input className="w-full pl-8 pr-3 py-1.5 bg-surface-elevated border border-border rounded text-xs text-text-primary"
              placeholder="Buscar objetos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
            : selectedConn ? filteredTree.map(node => renderNode(node))
            : <p className="text-xs text-gray-600 text-center py-8">{t('connections.search')}</p>}
        </div>
      </div>

      {/* Right panel - Detail */}
      <div className="flex-1 bg-background p-6 overflow-auto">
        {detail ? (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">{detailType}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Coluna</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Tipo</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Null</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Default</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">PK</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">FK</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((col: any, i: number) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-900 hover:bg-gray-100/50 dark:bg-gray-900/50">
                      <td className="py-2 px-3 text-text-primary font-mono text-xs">{col.name}</td>
                      <td className="py-2 px-3 text-blue-400 font-mono text-xs">{col.type}</td>
                      <td className="py-2 px-3">{col.nullable ? <span className="text-amber-400 text-xs">YES</span> : <span className="text-gray-600 text-xs">NO</span>}</td>
                      <td className="py-2 px-3 text-text-tertiary font-mono text-xs">{col.defaultValue || '-'}</td>
                      <td className="py-2 px-3">{col.isPrimaryKey ? <Key className="w-3.5 h-3.5 text-amber-400" /> : ''}</td>
                      <td className="py-2 px-3">{col.isForeignKey ? <Key className="w-3.5 h-3.5 text-blue-400" /> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Database className="w-16 h-16 text-gray-800 mx-auto mb-3" />
              <p className="text-gray-600">{t('explorer.selectObject')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
