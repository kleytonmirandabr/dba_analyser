import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket'
import { useNavigate } from 'react-router-dom'

interface PendingExecution {
  id: string
  sql: string
  connectionName: string
  requestedBy: string
  createdAt: string
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`
  return `${Math.floor(seconds / 86400)}d atrás`
}

export default function NotificationBell() {
  const [pending, setPending] = useState<PendingExecution[]>([])
  const [open, setOpen] = useState(false)
  const socketRef = useSocket()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handler = (data: PendingExecution) => {
      setPending(prev => [data, ...prev.slice(0, 19)])
    }
    socket.on('execution:pending', handler)
    return () => { socket.off('execution:pending', handler) }
  }, [socketRef.current])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        title="Execuções pendentes"
      >
        <Bell className="w-4 h-4" />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
            {pending.length > 9 ? '9+' : pending.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Execuções Pendentes</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {pending.length === 0 ? (
              <p className="p-4 text-xs text-gray-500 dark:text-gray-400 text-center">Nenhuma execução pendente</p>
            ) : (
              pending.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setOpen(false); navigate('/executions') }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{item.connectionName}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 truncate font-mono">{item.sql.slice(0, 60)}{item.sql.length > 60 ? '...' : ''}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
