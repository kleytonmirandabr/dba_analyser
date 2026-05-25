import { Database, Plug, Activity, GitCompare } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Plug} label="Conexões" value="0" color="blue" />
        <StatCard icon={Database} label="Databases" value="0" color="purple" />
        <StatCard icon={Activity} label="Queries Ativas" value="0" color="green" />
        <StatCard icon={GitCompare} label="Diffs Salvos" value="0" color="amber" />
      </div>
      
      <div className="mt-8 p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
        <Plug className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-300">Nenhuma conexão configurada</h2>
        <p className="text-sm text-gray-500 mt-1">Configure sua VPN e adicione conexões de banco para começar.</p>
        <a href="/connections" className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          Configurar Conexão
        </a>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/20 border-blue-800 text-blue-400',
    purple: 'bg-purple-900/20 border-purple-800 text-purple-400',
    green: 'bg-green-900/20 border-green-800 text-green-400',
    amber: 'bg-amber-900/20 border-amber-800 text-amber-400',
  }
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs mt-2 opacity-70">{label}</p>
    </div>
  )
}
