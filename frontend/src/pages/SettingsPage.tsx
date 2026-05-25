import { useState } from 'react'
import { User, Lock, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'
import api from '../lib/api'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setError('Senhas não coincidem'); return }
    if (newPw.length < 6) { setError('Mínimo 6 caracteres'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/api/auth/change-password', { currentPassword: currentPw, newPassword: newPw })
      setSuccess('Senha alterada com sucesso!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: any) { setError(err.response?.data?.error || 'Erro ao alterar senha') }
    setSaving(false)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Configurações</h1>

      {/* Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-sm font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800">{user?.role}</span>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Lock className="w-4 h-4" />Alterar Senha</h2>
        {success && <div className="mb-3 p-2 bg-green-900/30 border border-green-800 rounded text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{success}</div>}
        {error && <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400">{error}</div>}
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Senha atual</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nova senha</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirmar nova senha</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </form>
      </div>
    </div>
  )
}
