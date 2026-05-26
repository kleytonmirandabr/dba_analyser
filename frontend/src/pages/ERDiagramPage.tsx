import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { Key, Link2, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { useThemeStore } from '../stores/theme.store'

interface Column { name: string; type: string; isPk: boolean; isFk: boolean }
interface TableData { name: string; schema: string; columns: Column[] }
interface Relationship { name: string; from: { table: string; column: string }; to: { table: string; column: string } }
interface Connection { id: string; name: string; environment: string }

const NODE_WIDTH = 260
const NODE_HEIGHT_BASE = 44
const ROW_HEIGHT = 28

function TableNode({ data }: { data: { label: string; columns: Column[]; theme: string } }) {
  const isDark = data.theme === 'dark'
  return (
    <div className={`rounded-lg border shadow-lg overflow-hidden min-w-[240px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 font-semibold text-sm border-b ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
        {data.label}
      </div>
      <div className="divide-y divide-gray-700/30">
        {data.columns.map(col => (
          <div key={col.name} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {col.isPk && <Key className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            {col.isFk && !col.isPk && <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0" />}
            {!col.isPk && !col.isFk && <span className="w-3 h-3 flex-shrink-0" />}
            <span className="font-medium">{col.name}</span>
            <span className={`ml-auto ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const nodeTypes = { tableNode: TableNode }

function getLayoutedElements(tables: TableData[], relationships: Relationship[], theme: string) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 })

  const nodes: Node[] = tables.map(table => {
    const height = NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT
    g.setNode(table.name, { width: NODE_WIDTH, height })
    return {
      id: table.name,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: { label: table.name, columns: table.columns, theme },
    }
  })

  const edges: Edge[] = relationships.map((rel, i) => {
    g.setEdge(rel.from.table, rel.to.table)
    return {
      id: `e-${i}`,
      source: rel.from.table,
      target: rel.to.table,
      label: rel.from.column,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: theme === 'dark' ? '#6366f1' : '#4f46e5' },
      labelStyle: { fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 10 },
    }
  })

  dagre.layout(g)

  nodes.forEach(node => {
    const pos = g.node(node.id)
    node.position = { x: pos.x - NODE_WIDTH / 2, y: pos.y - pos.height / 2 }
    node.sourcePosition = Position.Right
    node.targetPosition = Position.Left
  })

  return { nodes, edges }
}

export default function ERDiagramPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState('')
  const [schemas, setSchemas] = useState<string[]>([])
  const [selectedSchema, setSelectedSchema] = useState('public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const theme = useThemeStore(s => s.theme)

  useEffect(() => {
    api.get('/api/connections').then(r => setConnections(r.data.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedConn) return
    api.get(`/api/explorer/${selectedConn}/schemas`).then(r => {
      setSchemas(r.data.data)
      if (r.data.data.length && !r.data.data.includes(selectedSchema)) {
        setSelectedSchema(r.data.data[0])
      }
    }).catch(() => {})
  }, [selectedConn])

  const loadDiagram = useCallback(async () => {
    if (!selectedConn || !selectedSchema) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/api/explorer/${selectedConn}/relationships?schema=${selectedSchema}`)
      const { tables, relationships } = data.data
      if (!tables.length) {
        setError('No tables found in this schema')
        setNodes([])
        setEdges([])
      } else {
        const { nodes: n, edges: e } = getLayoutedElements(tables, relationships, theme)
        setNodes(n)
        setEdges(e)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }, [selectedConn, selectedSchema, theme])

  useEffect(() => { loadDiagram() }, [selectedConn, selectedSchema, theme])

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <select className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
          <option value="">Conexão...</option>
          {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.environment})</option>)}
        </select>
        <select className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          value={selectedSchema} onChange={e => setSelectedSchema(e.target.value)}>
          {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          {!schemas.length && <option value="public">public</option>}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          colorMode={theme}
        >
          <Controls />
          <MiniMap
            nodeColor={theme === 'dark' ? '#374151' : '#e5e7eb'}
            maskColor={theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
          />
          <Background gap={16} size={1} color={theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
        </ReactFlow>
      </div>
    </div>
  )
}
