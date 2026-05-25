import { useState, useEffect } from 'react'
import { Database, Plug, Activity, Shield, Terminal, GitCompareArrows, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState({ connections: 0, pendingExec: 0, todayQueries: 0, vpnConnected: false })

  useEffect(() => {
    Promise.all([
      api.get('/api/connections').then(r => r.data.data.length).catch(() => 0),
      api.get('/api/execution?status=pending').then(r => r.data.data.length).catch(() => 0),
      api.get('/api/vpn/status').then(r => r.data.data.connected).catch(() => false),
    ]).then(([connections, pendingExec, vpnConnected]) => {
      setStats({ connections, pendingExec, todayQueries: 0, vpnConnected })
    })
  }, [])

  const cards = [
    { label: 'Conexões', value: stats.connections, icon: Plug, to: '/connections', color: 'blue' },
    { label: 'Execuções Pendentes', value: stats.pendingExec, icon: Activity, to: '/executions', color: stats.pendingExec > 0 ? 'amber' : 'green' },
    { label: 'VPN', value: stats.vpnConnected ? 'Conectada' : 'Offline', icon: Database, to: '/connections', color: stats.vpnConnected ? 'green' : 'red' },
  ]

  const quickActions = [
    { label: 'Nova Query', icon: Terminal, to: '/query' },
    { label: 'Explorer', icon: Database, to: '/explorer' },
    { label: 'Comparar', icon: GitCompareArrows, to: '/compare' },
    { label: 'Audit Log', icon: Shield, to: '/audit' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <Link key={i} to={c.to} className="p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition group">
            <div className="flex items-center justify-between">
              <c.icon className={`w-5 h-5 text-${c.color}-400`} />
              <ArrowUpRight className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition" />
            </div>
            <p className={`text-2xl font-bold mt-3 text-${c.color}-400`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((a, i) => (
            <Link key={i} to={a.to} className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-800 hover:bg-blue-900/5 transition text-center">
              <a.icon className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-400">{a.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
