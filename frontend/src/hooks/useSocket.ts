import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

// Connect via same origin — Vite proxies /socket.io to backend
export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || window.location.origin
    socketRef.current = io(url, { 
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnectionAttempts: 3,
      reconnectionDelay: 5000,
      timeout: 10000,
    })
    return () => { socketRef.current?.disconnect() }
  }, [])

  return socketRef
}

export function useMonitorSocket(connId: string | null) {
  const socketRef = useSocket()
  const [data, setData] = useState<{ queries: any[]; locks: any[]; timestamp: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!connId || !socketRef.current) return
    const socket = socketRef.current

    socket.emit('monitor:subscribe', connId)
    socket.on('monitor:data', (d) => { setData(d); setError('') })
    socket.on('monitor:error', (e) => setError(e.error))

    return () => {
      socket.emit('monitor:unsubscribe', connId)
      socket.off('monitor:data')
      socket.off('monitor:error')
    }
  }, [connId])

  return { data, error }
}
