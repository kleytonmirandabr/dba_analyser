import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Wifi, WifiOff, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Shield, Key, Server, Terminal, X, RotateCcw } from 'lucide-react'
import api from '../lib/api'

interface VPNStatus {
  connected: boolean
  configUploaded: boolean
  ip?: string
  lastError?: string
  vpnContainerAvailable?: boolean
}

export default function VPNPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<VPNStatus>({ connected: false, configUploaded: false })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectStep, setConnectStep] = useState('')
  const [ovpnContent, setOvpnContent] = useState('')
  const [ovpnFilename, setOvpnFilename] = useState('')
  const [vpnUser, setVpnUser] = useState('')
  const [vpnPass, setVpnPass] = useState('')
  const [serverIp, setServerIp] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const pollRef = useRef<any>(null)
  const logsPollRef = useRef<any>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const stepTimers = useRef<any[]>([])

  const loadStatus = async () => {
    try {
      const { data } = await api.get('/api/vpn/status')
      setStatus(data.data)
      if (data.data.connected && connecting) { stopConnecting() }
    } catch {} finally { setLoading(false) }
  }

  const loadLogs = async () => {
    try {
      const { data } = await api.get('/api/vpn/logs?lines=100')
      setLogs(data.data.logs)
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {} finally { setLogsLoading(false) }
  }

  useEffect(() => { loadStatus(); const i = setInterval(loadStatus, 8000); return () => clearInterval(i) }, [])

  useEffect(() => {
    if (showLogs) {
      setLogsLoading(true)
      loadLogs()
      logsPollRef.current = setInterval(loadLogs, 3000)
    } else {
      if (logsPollRef.current) { clearInterval(logsPollRef.current); logsPollRef.current = null }
    }
    return () => { if (logsPollRef.current) clearInterval(logsPollRef.current) }
  }, [showLogs])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOvpnFilename(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setOvpnContent(ev.target?.result as string)
    reader.readAsText(file)
  }

  const stopConnecting = (error?: string) => {
    setConnecting(false)
    setConnectStep('')
    stepTimers.current.forEach(t => clearTimeout(t))
    stepTimers.current = []
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (error) setMessage({ type: 'error', text: error })
  }

  const startConnecting = () => {
    setConnecting(true)
    setMessage(null)
    setShowLogs(true)
    setConnectStep(t('vpn.startingContainer'))
    stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.authenticating')), 3000))
    stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.establishingTunnel')), 6000))
    stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.verifyingConnectivity')), 10000))
    pollRef.current = setInterval(loadStatus, 3000)
    stepTimers.current.push(setTimeout(() => {
      if (!status.connected && connecting) {
        stopConnecting('Tempo esgotado (30s). Verifique o arquivo .ovpn e credenciais. Consulte os logs para detalhes.')
      }
    }, 30000))
  }

  const cancelConnection = async () => {
    stopConnecting()
    try { await api.post('/api/vpn/disconnect') } catch {}
    setMessage({ type: 'error', text: t('vpn.cancelledByUser') })
    setTimeout(loadStatus, 2000)
  }

  const handleUpload = async () => {
    if (!ovpnContent) { setMessage({ type: 'error', text: t('vpn.selectFile') }); return }
    setUploading(true); setMessage(null)
    try {
      await api.post('/api/vpn/upload', {
        ovpnContent,
        username: vpnUser || undefined,
        password: vpnPass || undefined,
        serverIp: serverIp || undefined,
      })
      setOvpnContent(''); setOvpnFilename(''); setVpnUser(''); setVpnPass('')
      try {
        await api.post('/api/vpn/connect')
        startConnecting()
      } catch (err: any) {
        setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao conectar' })
      }
      loadStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('vpn.errorSendingConfig') })
    }
    setUploading(false)
  }

  const handleConnect = async () => {
    setMessage(null)
    try {
      await api.post('/api/vpn/connect')
      startConnecting()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao conectar' })
    }
  }

  const handleDisconnect = async () => {
    try {
      await api.post('/api/vpn/disconnect')
      setMessage({ type: 'success', text: 'VPN desconectada' })
      setTimeout(loadStatus, 2000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro' })
    }
  }

  const handleRestart = async () => {
    setMessage(null)
    setConnecting(true)
    setConnectStep('Reiniciando container VPN...')
    try {
      await api.post('/api/vpn/restart')
      setShowLogs(true)
      setConnectStep(t('vpn.startingContainer'))
      pollRef.current = setInterval(loadStatus, 3000)
      stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.authenticating')), 4000))
      stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.establishingTunnel')), 8000))
      stepTimers.current.push(setTimeout(() => setConnectStep(t('vpn.verifyingConnectivity')), 12000))
      stepTimers.current.push(setTimeout(() => {
        if (!status.connected) stopConnecting()
      }, 30000))
    } catch (err: any) {
      stopConnecting()
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao reiniciar container VPN' })
    }
  }

  const handleRemove = async () => {
    if (!confirm(t('vpn.confirmRemove'))) return
    try {
      await api.delete('/api/vpn/config')
      setMessage({ type: 'success', text: t('vpn.configRemoved') })
      loadStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao remover' })
    }
  }

  const getLogColor = (line: string) => {
    if (line.includes('ERROR') || line.includes('error') || line.includes('SIGTERM')) return 'text-red-400'
    if (line.includes('WARNING') || line.includes('WARN')) return 'text-amber-400'
    if (line.includes('Initialization Sequence Completed')) return 'text-green-400 font-bold'
    if (line.includes('CONNECTED') || line.includes('connected')) return 'text-green-400'
    if (line.includes('PUSH_REPLY') || line.includes('ifconfig')) return 'text-blue-400'
    return 'text-text-secondary'
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      {/* Main content */}
      <div className={`${showLogs ? 'w-1/2' : 'w-full max-w-2xl'} overflow-y-auto pr-2 transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">{t('vpn.title')}</h1>
          <button onClick={() => setShowLogs(!showLogs)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1.5 ${showLogs ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'}`}>
            <Terminal className="w-3.5 h-3.5" />
            {showLogs ? 'Logs ativo' : 'Ver Logs'}
          </button>
        </div>

        {/* No VPN container warning */}
        {!status.vpnContainerAvailable && status.configUploaded && !connecting && (
          <div className="p-4 rounded-xl border border-amber-800 bg-amber-900/10 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Container VPN não disponível</p>
                <p className="text-xs text-text-secondary mt-1">
                  Este ambiente está rodando sem o sidecar OpenVPN (<code className="bg-surface-elevated px-1 py-0.5 rounded text-[10px]">docker-compose.dev.yml</code>).
                </p>
                <code className="block mt-2 text-[11px] bg-surface-elevated text-green-400 px-3 py-2 rounded-lg">docker compose up --build</code>
              </div>
            </div>
          </div>
        )}

        {/* Status card */}
        <div className={`p-5 rounded-xl border mb-4 ${status.connected ? 'bg-green-900/10 border-green-800' : status.configUploaded ? 'bg-amber-900/10 border-amber-800' : 'bg-red-900/10 border-red-800'}`}>
          <div className="flex items-center gap-3">
            {status.connected ? <Wifi className="w-6 h-6 text-green-400" /> : connecting ? <Loader2 className="w-6 h-6 text-amber-400 animate-spin" /> : <WifiOff className="w-6 h-6 text-red-400" />}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${status.connected ? 'text-green-400' : connecting ? 'text-amber-400' : status.configUploaded ? 'text-amber-400' : 'text-red-400'}`}>
                {status.connected ? t('vpn.connected') : connecting ? t('vpn.connecting') : status.configUploaded ? t('vpn.configured') : t('vpn.notConfigured')}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {status.connected ? `${t('vpn.tunnelActive')} • IP: ${status.ip || t('vpn.gettingIp')}` : connecting ? connectStep : status.configUploaded ? t('vpn.readyToConnect') : t('vpn.uploadOvpn')}
              </p>
            </div>
            {!connecting && (
              <div className="flex gap-2">
                {status.configUploaded && !status.connected && (
                  <button onClick={handleConnect} className="px-4 py-2 text-xs bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" /> Conectar
                  </button>
                )}
                {status.connected && (
                  <button onClick={handleDisconnect} className="px-4 py-2 text-xs bg-red-600/80 hover:bg-red-600 text-white font-medium rounded-lg transition flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5" /> Desconectar
                  </button>
                )}
                <button onClick={handleRestart} title="Reiniciar container VPN" className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
                </button>
              </div>
            )}
          </div>

          {/* Progress */}
          {connecting && (
            <div className="mt-4 ml-9">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <button onClick={cancelConnection} className="px-3 py-1 text-[11px] bg-surface-elevated hover:bg-red-900/30 text-text-secondary hover:text-red-400 border border-border hover:border-red-800 rounded-lg transition">
                  Cancelar
                </button>
              </div>
              <div className="space-y-1">
                {[t('vpn.startingContainer'), t('vpn.authenticating'), t('vpn.establishingTunnel'), t('vpn.verifyingConnectivity')].map((step, i) => {
                  const steps = [t('vpn.startingContainer'), t('vpn.authenticating'), t('vpn.establishingTunnel'), t('vpn.verifyingConnectivity')]
                  const currentIdx = steps.indexOf(connectStep)
                  const isDone = i < currentIdx
                  const isCurrent = i === currentIdx
                  return (
                    <div key={i} className={`flex items-center gap-2 text-xs ${isDone ? 'text-green-400' : isCurrent ? 'text-amber-400' : 'text-gray-600'}`}>
                      {isDone ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className="w-3 h-3 rounded-full border border-border" />}
                      {step}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        {message && !connecting && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-900/20 border border-green-800 text-green-400' : 'bg-red-900/20 border border-red-800 text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* Upload form */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            {status.configUploaded ? t('vpn.updateConfig') : t('vpn.configureVpn')}
          </h2>

          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1">
              <Server className="w-3 h-3" /> IP do Servidor VPN
            </label>
            <input className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: 192.168.1.100 ou vpn.empresa.com.br" value={serverIp} onChange={e => setServerIp(e.target.value)} />
            <p className="text-[10px] text-gray-600 mt-1">Endereço do servidor VPN (informativo, o .ovpn já contém este dado)</p>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Arquivo .ovpn</label>
            <div className="border-2 border-dashed border-border rounded-xl p-6 hover:border-blue-600 transition cursor-pointer relative text-center">
              <input type="file" accept=".ovpn,.conf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              {ovpnFilename ? <p className="text-sm text-green-400">✅ {ovpnFilename}</p> : <p className="text-sm text-text-secondary">Clique ou arraste o arquivo .ovpn aqui</p>}
              <p className="text-[10px] text-gray-600 mt-1">Formatos aceitos: .ovpn, .conf</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1">
              <Key className="w-3 h-3" /> Credenciais VPN (opcional)
            </label>
            <p className="text-[10px] text-gray-600 mb-2">Se sua VPN requer autenticação user/password, informe abaixo.</p>
            <div className="grid grid-cols-2 gap-3">
              <input className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={t('vpn.username')} value={vpnUser} onChange={e => setVpnUser(e.target.value)} />
              <input type="password" className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Senha VPN" value={vpnPass} onChange={e => setVpnPass(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={uploading || !ovpnContent}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Salvar e Conectar'}
            </button>
            {status.configUploaded && (
              <button onClick={handleRemove} className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm font-medium rounded-lg transition flex items-center gap-2 border border-red-800">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs panel */}
      {showLogs && (
        <div className="w-1/2 bg-background border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-100/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-text-primary">Logs do Container VPN</span>
              <span className="text-[10px] text-text-tertiary">auto-refresh 3s</span>
            </div>
            <button onClick={() => setShowLogs(false)} className="p-1 hover:bg-surface-elevated rounded transition">
              <X className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {logsLoading && logs.length === 0 ? (
              <div className="flex items-center gap-2 text-text-tertiary"><Loader2 className="w-3 h-3 animate-spin" /> Carregando logs...</div>
            ) : logs.length === 0 ? (
              <p className="text-gray-600">{t('vpn.noLogs')}</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={`py-0.5 ${getLogColor(line)} break-all`}>
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
