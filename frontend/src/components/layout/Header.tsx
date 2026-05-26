import { useEffect, useState } from 'react'
import { Wifi, WifiOff, LogOut, Bell, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store'
import { useThemeStore } from '../../stores/theme.store'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const navigate = useNavigate()
  const [vpnStatus, setVpnStatus] = useState<{ connected: boolean; configUploaded: boolean }>({ connected: false, configUploaded: false })
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await api.get('/api/vpn/status')
        setVpnStatus(data.data)
      } catch {}
    }
    check()
    const checkAlerts = async () => {
      try { const { data } = await api.get('/api/alerts/summary'); setAlertCount(data.data.triggered || 0) } catch {}
    }
    checkAlerts()
    const interval = setInterval(check, 30000)
    const alertInterval = setInterval(checkAlerts, 15000)
    return () => { clearInterval(interval); clearInterval(alertInterval) }
  }, [])

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-colors">
      <div />
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <NotificationBell />

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Alert Badge */}
        {alertCount > 0 && (
          <button onClick={() => navigate('/alerts')}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
            <Bell className="w-3 h-3" />
            {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
          </button>
        )}

        {/* VPN Status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          vpnStatus.connected
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : vpnStatus.configUploaded
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {vpnStatus.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          VPN {vpnStatus.connected ? 'Conectada' : vpnStatus.configUploaded ? 'Configurada' : 'Não configurada'}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">{user?.name}</span>
          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{user?.role}</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition" title="Sair">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
