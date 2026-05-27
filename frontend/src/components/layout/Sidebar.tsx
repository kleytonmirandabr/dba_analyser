import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Database, LayoutDashboard, Plug, FolderTree, Activity, HeartPulse, Bell, TrendingUp, Terminal, GitCompareArrows, Play, Shield, Settings, Wifi, Stethoscope, Brain, FileText, GitBranch, HardDrive, History } from 'lucide-react'

export default function Sidebar() {
  const { t } = useTranslation()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/connections', icon: Plug, label: t('nav.connections') },
    { to: '/vpn', icon: Wifi, label: t('nav.vpn') },
    { to: '/explorer', icon: FolderTree, label: t('nav.explorer') },
    { to: '/er-diagram', icon: GitBranch, label: t('nav.erDiagram') },
    { to: '/query', icon: Terminal, label: t('nav.query') },
    { to: '/monitor', icon: Activity, label: t('nav.monitor') },
    { to: '/diagnostics', icon: Stethoscope, label: t('nav.diagnostics') },
    { to: '/health', icon: HeartPulse, label: t('nav.health') },
    { to: '/alerts', icon: Bell, label: t('nav.alerts') },
    { to: '/growth', icon: TrendingUp, label: t('nav.growth') },
    { to: '/backup', icon: HardDrive, label: t('nav.backup') },
    { to: '/advisor', icon: Brain, label: t('nav.advisor') },
    { to: '/reports', icon: FileText, label: t('nav.reports') },
    { to: '/executions', icon: Play, label: t('nav.executions') },
    { to: '/compare', icon: GitCompareArrows, label: t('nav.compare') },
    { to: '/schema-versions', icon: History, label: t('nav.versioning') },
    { to: '/audit', icon: Shield, label: t('nav.audit') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
        <Database className="w-6 h-6 text-blue-500" />
        <span className="text-sm font-bold text-text-primary">DBA Analyser</span>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              isActive
                ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-text-secondary hover:bg-surface-hover hover:text-gray-900 dark:hover:text-gray-200'
            }`}>
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <p className="text-[10px] text-gray-500 dark:text-gray-600 text-center">DBA Analyser v1.9.0</p>
      </div>
    </aside>
  )
}
