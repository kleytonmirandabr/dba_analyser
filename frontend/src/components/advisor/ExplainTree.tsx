interface ExplainNode {
  nodeType: string
  relation?: string
  startupCost: number
  totalCost: number
  planRows: number
  actualRows?: number
  actualTime?: number
  filter?: string
  indexName?: string
  indexCond?: string
  sortKey?: string[]
  joinType?: string
  children?: ExplainNode[]
  extra?: Record<string, any>
}

interface Props {
  plan: ExplainNode
  maxCost?: number
}

function getCostColor(cost: number, max: number): string {
  const ratio = max > 0 ? cost / max : 0
  if (ratio > 0.7) return 'text-red-500 dark:text-red-400'
  if (ratio > 0.3) return 'text-amber-500 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function getNodeIcon(nodeType: string): string {
  if (nodeType.includes('Seq Scan') || nodeType.includes('Table Scan')) return '⚠️'
  if (nodeType.includes('Index')) return '⚡'
  if (nodeType.includes('Hash')) return '🔗'
  if (nodeType.includes('Sort')) return '📊'
  if (nodeType.includes('Nested Loop')) return '🔄'
  if (nodeType.includes('Aggregate')) return '📐'
  if (nodeType.includes('Merge')) return '🔀'
  return '📋'
}

function NodeRow({ node, depth, maxCost }: { node: ExplainNode; depth: number; maxCost: number }) {
  const costColor = getCostColor(node.totalCost, maxCost)
  const icon = getNodeIcon(node.nodeType)
  const isProblematic = node.nodeType.includes('Seq Scan') || node.nodeType.includes('Table Scan')

  return (
    <div>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded ${isProblematic ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        <span className="text-sm">{icon}</span>
        <span className={`text-xs font-medium ${isProblematic ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
          {node.nodeType}
        </span>
        {node.relation && <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">{node.relation}</span>}
        {node.indexName && <span className="text-[10px] text-blue-500 font-mono">idx:{node.indexName}</span>}
        <span className={`ml-auto text-[10px] font-mono ${costColor}`}>
          cost:{node.totalCost.toFixed(1)}
        </span>
        <span className="text-[10px] text-text-tertiary font-mono">
          rows:{node.actualRows ?? node.planRows}
        </span>
        {node.actualTime != null && (
          <span className="text-[10px] text-gray-400 font-mono">{node.actualTime.toFixed(1)}ms</span>
        )}
      </div>
      {node.filter && (
        <div className="text-[10px] text-text-tertiary font-mono pl-2" style={{ paddingLeft: `${depth * 20 + 36}px` }}>
          Filter: {node.filter}
        </div>
      )}
      {node.children?.map((child, i) => (
        <NodeRow key={i} node={child} depth={depth + 1} maxCost={maxCost} />
      ))}
    </div>
  )
}

export default function ExplainTree({ plan, maxCost }: Props) {
  const resolvedMax = maxCost || plan.totalCost || 1

  return (
    <div className="bg-surface border border-border rounded-xl p-3 overflow-x-auto">
      <p className="text-[10px] text-text-tertiary uppercase tracking-wide font-medium mb-2">Plano de Execução</p>
      <NodeRow node={plan} depth={0} maxCost={resolvedMax} />
    </div>
  )
}
