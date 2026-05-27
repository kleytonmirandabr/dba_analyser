import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Database, LayoutDashboard, Plug, Activity, HeartPulse, Bell, TrendingUp, Terminal, GitCompareArrows, Play, Wifi, Stethoscope, Brain, FileText, GitBranch, HardDrive, History } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store'

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation()
  const { t } = useTranslation()
  const { hasFeature } = useAuthStore()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), feature: 'dashboard.view' },
    { to: '/connections', icon: Plug, label: t('nav.connections'), feature: 'connections.view' },
    { to: '/vpn', icon: Wifi, label: t('nav.vpn'), feature: 'vpn.view' },
    { to: '/er-diagram', icon: GitBranch, label: t('nav.erDiagram'), feature: 'erdiagram.view' },
    { to: '/query', icon: Terminal, label: t('nav.query'), feature: 'query.execute' },
    { to: '/monitor', icon: Activity, label: t('nav.monitor'), feature: 'monitor.view' },
    { to: '/diagnostics', icon: Stethoscope, label: t('nav.diagnostics'), feature: 'diagnostics.view' },
    { to: '/health', icon: HeartPulse, label: t('nav.health'), feature: 'health.view' },
    { to: '/alerts', icon: Bell, label: t('nav.alerts'), feature: 'alerts.view' },
    { to: '/availability', icon: HeartPulse, label: 'Disponibilidade', feature: 'availability.view' },
    { to: '/heartbeat', icon: Activity, label: 'Heartbeat', feature: 'monitor.view' },
    { to: '/growth', icon: TrendingUp, label: t('nav.growth'), feature: 'growth.view' },
    { to: '/backup', icon: HardDrive, label: t('nav.backup'), feature: 'backup.view' },
    { to: '/advisor', icon: Brain, label: t('nav.advisor'), feature: 'dashboard.view' },
    { to: '/reports', icon: FileText, label: t('nav.reports'), feature: 'reports.view' },
    { to: '/executions', icon: Play, label: t('nav.executions'), feature: 'query.execute' },
    { to: '/compare', icon: GitCompareArrows, label: t('nav.compare'), feature: 'comparator.view' },
    { to: '/schema-versions', icon: History, label: t('nav.versioning'), feature: 'comparator.view' },
  ]

  const visibleItems = navItems.filter(item => !item.feature || hasFeature(item.feature))

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-surface border-r border-border flex flex-col transition-all duration-200 flex-shrink-0`}>
      <div className={`h-14 flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} border-b border-border`}>
        <Database className="w-5 h-5 text-blue-500 flex-shrink-0" />
        {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">DBA Analyser</span>}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleItems.map(item => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link key={item.to} to={item.to} title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-4 py-2 mx-1 rounded-lg text-sm transition-colors ${active ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Version at bottom */}
      <div className="border-t border-border px-4 py-2">
        {!collapsed ? (
          <p className="text-[10px] text-muted-foreground text-center">v2.4.0</p>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center">2.3</p>
        )}
      </div>
    </aside>
  )
}
