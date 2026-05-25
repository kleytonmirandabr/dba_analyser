import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Shield, Key, Server, RefreshCw } from 'lucide-react'
import api from '../lib/api'

interface VPNStatus {
  connected: boolean
  configUploaded: boolean
  ip?: string
  lastError?: string
}

export default function VPNPage() {
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
  const pollRef = useRef<any>(null)

  const loadStatus = async () => {
    try {
      const { data } = await api.get('/api/vpn/status')
      setStatus(data.data)
      if (data.data.connected) { setConnecting(false); setConnectStep('') }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { loadStatus(); const i = setInterval(loadStatus, 10000); return () => clearInterval(i) }, [])

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
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (error) setMessage({ type: 'error', text: error })
  }

  const startConnecting = () => {
    setConnecting(true)
    setMessage(null)
    setConnectStep('Iniciando container VPN...')
    setTimeout(() => { if (connecting) setConnectStep('Autenticando com servidor...') }, 3000)
    setTimeout(() => { if (connecting) setConnectStep('Estabelecendo túnel...') }, 6000)
    setTimeout(() => { if (connecting) setConnectStep('Verificando conectividade...') }, 10000)
    // Poll faster during connection
    pollRef.current = setInterval(loadStatus, 3000)
    // Timeout after 30s
    setTimeout(() => {
      if (!status.connected && connecting) {
        stopConnecting('Tempo esgotado (30s). Verifique o arquivo .ovpn e credenciais.')
      }
    }, 30000)
  }

  const cancelConnection = async () => {
    stopConnecting()
    try { await api.post('/api/vpn/disconnect') } catch {}
    setMessage({ type: 'error', text: 'Conexão cancelada pelo usuário.' })
    setTimeout(loadStatus, 2000)
  }

  const handleUpload = async () => {
    if (!ovpnContent) { setMessage({ type: 'error', text: 'Selecione um arquivo .ovpn' }); return }
    setUploading(true); setMessage(null)
    try {
      await api.post('/api/vpn/upload', {
        ovpnContent,
        username: vpnUser || undefined,
        password: vpnPass || undefined,
        serverIp: serverIp || undefined,
      })
      setOvpnContent(''); setOvpnFilename(''); setVpnUser(''); setVpnPass('')
      // Auto-connect
      try {
        await api.post('/api/vpn/connect')
        startConnecting()
        setMessage({ type: 'success', text: 'Configuração salva. Conectando VPN automaticamente...' })
      } catch {
        setMessage({ type: 'success', text: 'Configuração salva. Clique em "Conectar VPN" para iniciar.' })
      }
      loadStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao enviar configuração' })
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

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover a configuração VPN?')) return
    try {
      await api.delete('/api/vpn/config')
      setMessage({ type: 'success', text: 'Configuração VPN removida' })
      loadStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao remover' })
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Configuração VPN</h1>

      {/* Status card */}
      <div className={`p-5 rounded-xl border mb-6 ${status.connected ? 'bg-green-900/10 border-green-800' : status.configUploaded ? 'bg-amber-900/10 border-amber-800' : 'bg-red-900/10 border-red-800'}`}>
        <div className="flex items-center gap-3">
          {status.connected ? <Wifi className="w-6 h-6 text-green-400" /> : connecting ? <Loader2 className="w-6 h-6 text-amber-400 animate-spin" /> : <WifiOff className="w-6 h-6 text-red-400" />}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${status.connected ? 'text-green-400' : connecting ? 'text-amber-400' : status.configUploaded ? 'text-amber-400' : 'text-red-400'}`}>
              {status.connected ? 'VPN Conectada' : connecting ? 'Conectando...' : status.configUploaded ? 'VPN Configurada (desconectada)' : 'VPN Não Configurada'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {status.connected ? `Túnel ativo${status.ip ? ' • IP: ' + status.ip : ''}` : connecting ? connectStep : status.configUploaded ? 'Pronta para conectar' : 'Faça upload do arquivo .ovpn para começar'}
            </p>
          </div>
          {/* Action buttons */}
          {status.configUploaded && !connecting && (
            <div className="flex gap-2">
              {!status.connected && (
                <button onClick={handleConnect}
                  className="px-4 py-2 text-xs bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" /> Conectar
                </button>
              )}
              {status.connected && (
                <button onClick={handleDisconnect}
                  className="px-4 py-2 text-xs bg-red-600/80 hover:bg-red-600 text-white font-medium rounded-lg transition flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5" /> Desconectar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Connection progress */}
        {connecting && (
          <div className="mt-4 ml-9">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <button onClick={cancelConnection}
                className="px-3 py-1 text-[11px] bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg transition">
                Cancelar
              </button>
            </div>
            <div className="space-y-1">
              {['Iniciando container VPN...', 'Autenticando com servidor...', 'Estabelecendo túnel...', 'Verificando conectividade...'].map((step, i) => {
                const currentIdx = ['Iniciando container VPN...', 'Autenticando com servidor...', 'Estabelecendo túnel...', 'Verificando conectividade...'].indexOf(connectStep)
                const isDone = i < currentIdx
                const isCurrent = i === currentIdx
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs ${isDone ? 'text-green-400' : isCurrent ? 'text-amber-400' : 'text-gray-600'}`}>
                    {isDone ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className="w-3 h-3 rounded-full border border-gray-700" />}
                    {step}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {status.lastError && <p className="text-xs text-red-400 mt-3 ml-9 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Último erro: {status.lastError}</p>}
      </div>

      {/* Messages */}
      {message && !connecting && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-900/20 border border-green-800 text-green-400' : 'bg-red-900/20 border border-red-800 text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Upload form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          {status.configUploaded ? 'Atualizar Configuração VPN' : 'Configurar VPN'}
        </h2>

        {/* Server IP */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
            <Server className="w-3 h-3" />
            IP do Servidor VPN
          </label>
          <input className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ex: 192.168.1.100 ou vpn.empresa.com.br" value={serverIp} onChange={e => setServerIp(e.target.value)} />
          <p className="text-[10px] text-gray-600 mt-1">Endereço do servidor VPN (informativo, o .ovpn já contém este dado)</p>
        </div>

        {/* File upload */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Arquivo .ovpn</label>
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 hover:border-blue-600 transition cursor-pointer relative text-center">
            <input type="file" accept=".ovpn,.conf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            {ovpnFilename ? (
              <p className="text-sm text-green-400">✅ {ovpnFilename}</p>
            ) : (
              <p className="text-sm text-gray-400">Clique ou arraste o arquivo .ovpn aqui</p>
            )}
            <p className="text-[10px] text-gray-600 mt-1">Formatos aceitos: .ovpn, .conf</p>
          </div>
        </div>

        {/* Credentials */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
            <Key className="w-3 h-3" />
            Credenciais VPN (opcional)
          </label>
          <p className="text-[10px] text-gray-600 mb-2">Se sua VPN requer autenticação user/password, informe abaixo.</p>
          <div className="grid grid-cols-2 gap-3">
            <input className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Usuário VPN" value={vpnUser} onChange={e => setVpnUser(e.target.value)} />
            <input type="password" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Senha VPN" value={vpnPass} onChange={e => setVpnPass(e.target.value)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleUpload} disabled={uploading || !ovpnContent}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Enviando...' : 'Salvar e Conectar'}
          </button>
          {status.configUploaded && (
            <button onClick={handleRemove}
              className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm font-medium rounded-lg transition flex items-center gap-2 border border-red-800">
              <Trash2 className="w-4 h-4" /> Remover
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-400 mb-3">📋 Como funciona</h3>
        <ol className="space-y-2 text-xs text-gray-500">
          <li className="flex gap-2"><span className="text-blue-400 font-bold">1.</span> Informe o IP do servidor (opcional, apenas referência)</li>
          <li className="flex gap-2"><span className="text-blue-400 font-bold">2.</span> Faça upload do arquivo .ovpn fornecido pelo administrador da rede</li>
          <li className="flex gap-2"><span className="text-blue-400 font-bold">3.</span> Se necessário, informe as credenciais de autenticação</li>
          <li className="flex gap-2"><span className="text-blue-400 font-bold">4.</span> Clique "Salvar e Conectar" — a VPN conecta automaticamente</li>
          <li className="flex gap-2"><span className="text-blue-400 font-bold">5.</span> Após conectado, cadastre conexões que acessam a rede interna via VPN</li>
        </ol>
      </div>
    </div>
  )
}
