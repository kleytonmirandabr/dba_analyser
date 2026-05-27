import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wifi, Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import api from '../../lib/api'

interface Props { onComplete: () => void }

export default function VPNSetupWizard({ onComplete }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [ovpnContent, setOvpnContent] = useState('')
  const [vpnUser, setVpnUser] = useState('')
  const [vpnPass, setVpnPass] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setOvpnContent(ev.target?.result as string)
    reader.readAsText(file)
  }

  const handleUpload = async () => {
    setUploading(true); setError('')
    try {
      await api.post('/api/vpn/upload', {
        ovpnContent,
        username: vpnUser || undefined,
        password: vpnPass || undefined
      })
      setSuccess(true)
      setStep(3)
    } catch (err: any) {
      setError(err.response?.data?.error || t('vpn.errorSendingConfig'))
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-blue-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="text-center">
            <Wifi className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">{t('vpn.configureVpn')}</h2>
            <p className="text-sm text-gray-400 mb-6">
              Faça upload do arquivo .ovpn para conectar aos bancos de dados da rede interna.
            </p>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 hover:border-blue-600 transition cursor-pointer relative">
              <input type="file" accept=".ovpn,.conf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-gray-400">{ovpnContent ? '✅ Arquivo carregado' : 'Clique ou arraste o arquivo .ovpn'}</p>
            </div>
            <button onClick={() => setStep(2)} disabled={!ovpnContent}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onComplete} className="mt-2 text-xs text-text-tertiary hover:text-gray-400">Pular (sem VPN)</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Credenciais VPN</h2>
            <p className="text-sm text-gray-400 mb-4">Se sua VPN requer autenticação, informe abaixo. Caso contrário, deixe em branco.</p>
            {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t('vpn.username')}</label>
                <input className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={vpnUser} onChange={e => setVpnUser(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Senha VPN (opcional)</label>
                <input type="password" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={vpnPass} onChange={e => setVpnPass(e.target.value)} />
              </div>
            </div>
            <button onClick={handleUpload} disabled={uploading}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? t('common.sending') : t('vpn.saveAndConnect')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">VPN Configurada!</h2>
            <p className="text-sm text-gray-400 mb-2">
              Arquivo .ovpn salvo com sucesso. O container VPN usará esta configuração na próxima inicialização.
            </p>
            <p className="text-xs text-amber-400 mb-6">
              ⚠️ Reinicie o Docker Compose para ativar a VPN: <code className="bg-gray-800 px-1.5 py-0.5 rounded">docker compose restart vpn</code>
            </p>
            <button onClick={onComplete} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
              Ir para o Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
