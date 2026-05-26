import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { Key, Link2, Loader2, Download, Image, Filter, CheckSquare, Square } from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'
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
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [allTables, setAllTables] = useState<string[]>([])
  const [visibleTables, setVisibleTables] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const theme = useThemeStore(s => s.theme)
  const flowRef = useRef<HTMLDivElement>(null)

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    if (!flowRef.current) return
    const fn = format === 'png' ? toPng : toSvg
    const dataUrl = await fn(flowRef.current, {
      backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
      quality: 1,
    })
    const a = document.createElement('a')
    a.href = dataUrl
    const connName = connections.find(c => c.id === selectedConn)?.name || 'diagram'
    a.download = `er-diagram-${connName}-${selectedSchema}.${format}`
    a.click()
  }, [theme, selectedConn, selectedSchema, connections])

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
        setAllTables([])
      } else {
        const tableNames = tables.map((t: TableData) => t.name)
        setAllTables(tableNames)
        setVisibleTables(new Set(tableNames))
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

  // Filter nodes/edges reactively when visibleTables changes (but not on initial load)
  const filteredNodes = useMemo(() => nodes.filter(n => visibleTables.has(n.id)), [nodes, visibleTables])
  const filteredEdges = useMemo(() => edges.filter(e => visibleTables.has(e.source) && visibleTables.has(e.target)), [edges, visibleTables])

  const toggleTable = (name: string) => {
    setVisibleTables(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

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
        {allTables.length > 0 && (
          <div className="relative">
            <button onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${showFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <Filter className="w-3.5 h-3.5" /> Tabelas ({visibleTables.size}/{allTables.length})
            </button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <button onClick={() => setVisibleTables(new Set(allTables))}
                    className="text-xs text-blue-500 hover:text-blue-600 font-medium">Selecionar Todos</button>
                  <button onClick={() => setVisibleTables(new Set())}
                    className="text-xs text-red-500 hover:text-red-600 font-medium">Limpar</button>
                </div>
                {allTables.map(t => (
                  <label key={t} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" checked={visibleTables.has(t)} onChange={() => toggleTable(t)} className="rounded text-blue-600" />
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{t}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => exportImage('png')} disabled={!nodes.length}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition">
            <Image className="w-3.5 h-3.5" /> PNG
          </button>
          <button onClick={() => exportImage('svg')} disabled={!nodes.length}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition">
            <Download className="w-3.5 h-3.5" /> SVG
          </button>
        </div>
      </div>
      <div className="flex-1" ref={flowRef}>
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
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
