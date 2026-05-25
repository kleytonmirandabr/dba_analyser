import { Shield, ShieldOff, Wifi, WifiOff } from 'lucide-react'

export default function Header() {
  // TODO: real VPN status from API
  const vpnConnected = false

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {/* VPN Status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          vpnConnected 
            ? 'bg-green-900/30 text-green-400 border border-green-800' 
            : 'bg-red-900/30 text-red-400 border border-red-800'
        }`}>
          {vpnConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          VPN {vpnConnected ? 'Conectada' : 'Desconectada'}
        </div>
        {/* User */}
        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-gray-300">KM</span>
        </div>
      </div>
    </header>
  )
}
