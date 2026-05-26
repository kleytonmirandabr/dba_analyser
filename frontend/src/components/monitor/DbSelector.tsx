import { useState } from 'react'
import { Database, ChevronDown, ChevronRight } from 'lucide-react'

interface Connection { id: string; name: string; environment: string; databaseName?: string }

interface Props {
  connections: Connection[]
  selectedConns: string[]
  setSelectedConns: (v: string[]) => void
}

export default function DbSelector({ connections, selectedConns, setSelectedConns }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const selectAll = () => setSelectedConns(connections.map(c => c.id))
  const clearAll = () => setSelectedConns([])
  const toggleConn = (id: string) => setSelectedConns(selectedConns.includes(id) ? selectedConns.filter(c => c !== id) : [...selectedConns, id])

  const filtered = connections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 hover:opacity-80">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">{selectedConns.length} de {connections.length} bancos</span>
          {selectedConns.length > 0 && !expanded && (
            <span className="text-[10px] text-gray-500 ml-2 max-w-md truncate">
              {selectedConns.slice(0, 5).map(id => connections.find(c => c.id === id)?.name?.replace('SQL / ', '')).join(', ')}
              {selectedConns.length > 5 ? ` +${selectedConns.length - 5}` : ''}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-[10px] text-blue-400 hover:text-blue-300">Todos</button>
          <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-300">Limpar</button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-800 pt-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar banco..." className="w-full px-3 py-1.5 mb-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-blue-500 outline-none" />
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto">
            {filtered.map(c => {
              const sel = selectedConns.includes(c.id)
              return (
                <button key={c.id} onClick={() => toggleConn(c.id)}
                  className={`px-2 py-1 rounded text-[10px] truncate border transition ${sel ? 'bg-blue-100 dark:bg-blue-600/20 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-600'}`}>
                  {c.name.replace('SQL / ', '')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
