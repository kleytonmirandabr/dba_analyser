import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Cloud, LayoutGrid } from 'lucide-react'
import { useModuleStore, AppModule } from '../../stores/module.store'

export default function ModuleSwitcher() {
  const [open, setOpen] = useState(false)
  const { activeModule, setModule } = useModuleStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const switchTo = (module: AppModule) => {
    setModule(module)
    setOpen(false)
    navigate(module === 'dba' ? '/' : '/k8s')
  }

  const modules = [
    {
      id: 'dba' as AppModule,
      name: 'DBA Analyser',
      description: 'Banco de Dados',
      icon: Database,
      color: 'bg-blue-500',
      textColor: 'text-blue-400'
    },
    {
      id: 'devops' as AppModule,
      name: 'DevOps Monitor',
      description: 'Kubernetes / AKS',
      icon: Cloud,
      color: 'bg-purple-500',
      textColor: 'text-purple-400'
    }
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-surface-elevated transition text-text-secondary hover:text-text-primary"
        title="Módulos"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-50 p-4">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Módulos</p>
          <div className="grid grid-cols-2 gap-3">
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => switchTo(mod.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition hover:shadow-md ${
                  activeModule === mod.id
                    ? 'border-blue-500 bg-blue-950/20 shadow-sm'
                    : 'border-border hover:border-gray-600 bg-surface-elevated'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl ${mod.color} flex items-center justify-center`}>
                  <mod.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-text-primary">{mod.name}</p>
                  <p className="text-[10px] text-text-tertiary">{mod.description}</p>
                </div>
                {activeModule === mod.id && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">Ativo</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
