import { useEffect, useState } from 'react'
import { Wifi, WifiOff, LogOut, Settings, Bell } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function Header() {
  const { user, logout } = useAuthStore()
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
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {/* Alert Badge */}
        {alertCount > 0 && (
          <button onClick={() => navigate('/alerts')}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-800 animate-pulse">
            <Bell className="w-3 h-3" />
            {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
          </button>
        )}

        {/* VPN Status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          vpnStatus.connected
            ? 'bg-green-900/30 text-green-400 border border-green-800'
            : vpnStatus.configUploaded
            ? 'bg-amber-900/30 text-amber-400 border border-amber-800'
            : 'bg-red-900/30 text-red-400 border border-red-800'
        }`}>
          {vpnStatus.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          VPN {vpnStatus.connected ? 'Conectada' : vpnStatus.configUploaded ? 'Configurada' : 'Não configurada'}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{user?.name}</span>
          <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{user?.role}</span>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="p-1.5 text-gray-500 hover:text-red-400 transition" title="Sair">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
