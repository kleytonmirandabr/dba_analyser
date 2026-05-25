import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] })
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
