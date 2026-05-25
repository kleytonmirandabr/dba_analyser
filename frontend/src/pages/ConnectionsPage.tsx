export default function ConnectionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Conexões</h1>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          + Nova Conexão
        </button>
      </div>
      <div className="p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
        <p className="text-gray-400">Nenhuma conexão cadastrada ainda.</p>
      </div>
    </div>
  )
}
