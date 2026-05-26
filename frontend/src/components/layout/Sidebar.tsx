import { NavLink } from 'react-router-dom'
import { Database, LayoutDashboard, Plug, FolderTree, Activity, HeartPulse, Bell, TrendingUp, Terminal, GitCompareArrows, Play, Shield, Settings, Wifi, Stethoscope, Brain, FileText, GitBranch, HardDrive, History } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/connections', icon: Plug, label: 'Conexões' },
  { to: '/vpn', icon: Wifi, label: 'VPN' },
  { to: '/explorer', icon: FolderTree, label: 'Explorer' },
  { to: '/er-diagram', icon: GitBranch, label: 'ER Diagram' },
  { to: '/query', icon: Terminal, label: 'Query' },
  { to: '/monitor', icon: Activity, label: 'Monitor' },
  { to: '/diagnostics', icon: Stethoscope, label: 'Diagnóstico' },
  { to: '/health', icon: HeartPulse, label: 'Health' },
  { to: '/alerts', icon: Bell, label: 'Alertas' },
  { to: '/growth', icon: TrendingUp, label: 'Crescimento' },
  { to: '/backup', icon: HardDrive, label: 'Backup' },
  { to: '/advisor', icon: Brain, label: 'AI Advisor' },
  { to: '/reports', icon: FileText, label: 'Relatórios' },
  { to: '/executions', icon: Play, label: 'Execuções' },
  { to: '/compare', icon: GitCompareArrows, label: 'Comparador' },
  { to: '/schema-versions', icon: History, label: 'Versioning' },
  { to: '/audit', icon: Shield, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-200 dark:border-gray-800">
        <Database className="w-6 h-6 text-blue-500" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">DBA Analyser</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-blue-600/10 text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-200'}`}>
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <p className="text-[10px] text-gray-600 text-center">DBA Analyser v1.6.0</p>
      </div>
    </aside>
  )
}
