import { Link, useLocation } from 'react-router-dom'
import { Database, LayoutDashboard, Plug, GitCompare, Activity, Play, FileText } from 'lucide-react'

const nav = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Conexões', path: '/connections', icon: Plug },
  { label: 'Explorer', path: '/explorer', icon: Database },
  { label: 'Comparar', path: '/compare', icon: GitCompare },
  { label: 'Monitor', path: '/monitor', icon: Activity },
  { label: 'Executar', path: '/execute', icon: Play },
  { label: 'Audit Log', path: '/audit', icon: FileText },
]

export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          DBA Analyser
        </h1>
        <p className="text-[10px] text-gray-500 mt-0.5">v1.0.0</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ label, path, icon: Icon }) => {
          const active = pathname === path
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active 
                  ? 'bg-blue-600/20 text-blue-400' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
