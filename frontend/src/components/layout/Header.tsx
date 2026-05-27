import { useEffect, useState, useRef } from 'react'
import { Wifi, WifiOff, LogOut, Bell, Sun, Moon, Settings, Building2, Users, Shield, Key, User, FileText } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store'
import { useThemeStore } from '../../stores/theme.store'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import NotificationBell from './NotificationBell'
import LanguageSelector from './LanguageSelector'

export default function Header() {
  const { user, logout, hasFeature } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [vpnStatus, setVpnStatus] = useState<{ connected: boolean; configUploaded: boolean }>({ connected: false, configUploaded: false })
  const [alertCount, setAlertCount] = useState(0)
  const [showAdmin, setShowAdmin] = useState(false)
  const adminRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = async () => {
      try { const { data } = await api.get('/api/vpn/status'); setVpnStatus(data.data) } catch {}
    }
    const checkAlerts = async () => {
      try { const { data } = await api.get('/api/alerts/summary'); setAlertCount(data.data.triggered || 0) } catch {}
    }
    check(); checkAlerts()
    const interval = setInterval(check, 30000)
    const alertInterval = setInterval(checkAlerts, 15000)
    return () => { clearInterval(interval); clearInterval(alertInterval) }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setShowAdmin(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const adminItems = [
    { to: '/clients', icon: Building2, label: 'Clientes', feature: 'admin.clients' },
    { to: '/users', icon: Users, label: 'Usuários', feature: 'admin.users' },
    { to: '/profiles', icon: Shield, label: 'Perfis', feature: 'admin.profiles' },
    { to: '/features', icon: Key, label: 'Funcionalidades', feature: 'admin.profiles' },
    { to: '/notifications', icon: Bell, label: 'Notificações', feature: 'alerts.manage' },
    { to: '/audit', icon: FileText, label: 'Auditoria', feature: 'admin.audit' },
    { to: '/settings', icon: Settings, label: 'Configurações', feature: 'admin.settings' },
    { to: '/my-account', icon: User, label: 'Minha Conta', feature: null },
  ]

  const visibleAdminItems = adminItems.filter(item => !item.feature || hasFeature(item.feature))

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 transition-colors">
      <div />
      <div className="flex items-center gap-3">
        <NotificationBell />
        <LanguageSelector />

        <button onClick={toggle}
          className="p-2 rounded-lg bg-surface-elevated text-text-secondary hover:bg-surface-active transition"
          title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {alertCount > 0 && (
          <button onClick={() => navigate('/alerts')}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
            <Bell className="w-3 h-3" />
            {alertCount} {alertCount === 1 ? t('header.alert') : t('header.alerts')}
          </button>
        )}

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          vpnStatus.connected
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : vpnStatus.configUploaded
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {vpnStatus.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {vpnStatus.connected ? t('header.vpnConnected') : vpnStatus.configUploaded ? t('header.vpnConfigured') : t('header.vpnNotConfigured')}
        </div>

        {/* Admin Gear Dropdown */}
        <div className="relative" ref={adminRef}>
          <button onClick={() => setShowAdmin(!showAdmin)}
            className={`p-2 rounded-lg transition ${showAdmin ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-surface-elevated text-text-secondary hover:bg-surface-active'}`}
            title="Administração">
            <Settings className={`w-4 h-4 ${showAdmin ? 'animate-spin' : ''}`} style={showAdmin ? { animationDuration: '2s' } : {}} />
          </button>

          {showAdmin && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Administração</p>
              </div>
              {visibleAdminItems.map(item => (
                <button key={item.to} onClick={() => { navigate(item.to); setShowAdmin(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition text-left">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">{user?.name}</span>
          <span className="text-[10px] bg-surface-elevated text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{user?.role}</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="p-1.5 text-text-muted hover:text-red-500 dark:hover:text-red-400 transition" title={t('header.logout')}>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
