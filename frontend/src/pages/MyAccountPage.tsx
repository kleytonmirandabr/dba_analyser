import { useState, useEffect } from 'react';
import { User, Save, Lock, Eye, EyeOff, CheckCircle2, Globe, Languages, Shield, QrCode } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

const TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'America/Fortaleza',
  'America/Cuiaba', 'America/Porto_Velho', 'America/Rio_Branco',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris',
  'Asia/Tokyo', 'UTC',
];
const LANGUAGES = [
  { value: '', label: 'Usar padrão do cliente' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
];

export default function MyAccountPage() {
  const { user, loadUser } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', preferredLanguage: '', preferredTimezone: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', email: (user as any).email || '', phone: (user as any).phone || '', preferredLanguage: (user as any).preferredLanguage || '', preferredTimezone: (user as any).preferredTimezone || '' });
  }, [user]);

  async function saveProfile() {
    setSaving(true);
    try {
      await api.put('/api/auth/me', form);
      if (form.preferredTimezone) localStorage.setItem('dba-timezone', form.preferredTimezone);
      if (form.preferredLanguage) localStorage.setItem('dba-language', form.preferredLanguage);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      loadUser();
    } catch (e: any) { alert(e.response?.data?.error || 'Erro ao salvar'); }
    setSaving(false);
  }

  async function changePassword() {
    if (pwdForm.newPassword !== pwdForm.confirm) return setPwdMsg({ type: 'err', text: 'Senhas não conferem' });
    try {
      await api.put('/api/auth/change-password', { currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      setPwdMsg({ type: 'ok', text: 'Senha alterada com sucesso!' });
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) { setPwdMsg({ type: 'err', text: e.response?.data?.error || 'Erro' }); }
  }

  const [twoFA, setTwoFA] = useState<{ enabled: boolean; secret?: string; otpauthUrl?: string }>({ enabled: false });
  const [tfaToken, setTfaToken] = useState('');
  const [tfaMsg, setTfaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function setup2FA() {
    try {
      const { data } = await api.post('/api/2fa/setup');
      setTwoFA({ enabled: false, secret: data.secret, otpauthUrl: data.otpauthUrl });
    } catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Erro' }); }
  }

  async function enable2FA() {
    try {
      await api.post('/api/2fa/enable', { token: tfaToken });
      setTwoFA({ enabled: true }); setTfaToken(''); setTfaMsg({ type: 'ok', text: '2FA ativado!' });
    } catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Código inválido' }); }
  }

  async function disable2FA() {
    try {
      await api.post('/api/2fa/disable', { token: tfaToken });
      setTwoFA({ enabled: false }); setTfaToken(''); setTfaMsg({ type: 'ok', text: '2FA desativado' });
    } catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Código inválido' }); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6"><User className="w-6 h-6" /> Minha Conta</h1>

      {/* Profile section */}
      <div className="border border-border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-4">Dados Pessoais</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Telefone</label>
            <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Timezone (override pessoal)</label>
            <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.preferredTimezone} onChange={e => setForm({...form, preferredTimezone: e.target.value})}>
              <option value="">Usar padrão do cliente</option>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Languages className="w-3 h-3" /> Idioma (override pessoal)</label>
            <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.preferredLanguage} onChange={e => setForm({...form, preferredLanguage: e.target.value})}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>

      {/* 2FA section */}
      <div className="border border-border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Autenticação em Dois Fatores (2FA)</h2>
        {twoFA.enabled ? (
          <div>
            <p className="text-sm text-green-600 dark:text-green-400 mb-3">✅ 2FA está ativado</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Código para desativar</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={tfaToken} onChange={e => setTfaToken(e.target.value)} placeholder="000000" maxLength={6} />
              </div>
              <button onClick={disable2FA} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Desativar</button>
            </div>
          </div>
        ) : twoFA.secret ? (
          <div>
            <p className="text-sm mb-3">Escaneie o QR code com Google Authenticator ou Authy:</p>
            <div className="bg-white p-4 rounded-lg inline-block mb-3">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFA.otpauthUrl || '')}`} alt="QR Code" className="w-48 h-48" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">Ou insira manualmente: <code className="bg-muted px-1 py-0.5 rounded text-xs">{twoFA.secret}</code></p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Digite o código do app</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={tfaToken} onChange={e => setTfaToken(e.target.value)} placeholder="000000" maxLength={6} />
              </div>
              <button onClick={enable2FA} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Ativar</button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">Proteja sua conta com autenticação em dois fatores. Após ativar, será necessário um código do app a cada login.</p>
            <button onClick={setup2FA} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2"><QrCode className="w-4 h-4" /> Configurar 2FA</button>
          </div>
        )}
        {tfaMsg && <p className={`text-sm mt-2 ${tfaMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{tfaMsg.text}</p>}
      </div>

      {/* Password section */}
      <div className="border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Alterar Senha</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Senha Atual</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className="w-full border border-border rounded px-3 py-2 bg-background pr-10" value={pwdForm.currentPassword} onChange={e => setPwdForm({...pwdForm, currentPassword: e.target.value})} />
              <button onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nova Senha</label>
            <input type={showPwd ? 'text' : 'password'} className="w-full border border-border rounded px-3 py-2 bg-background" value={pwdForm.newPassword} onChange={e => setPwdForm({...pwdForm, newPassword: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Confirmar Nova Senha</label>
            <input type={showPwd ? 'text' : 'password'} className="w-full border border-border rounded px-3 py-2 bg-background" value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} />
          </div>
          {pwdMsg && <p className={`text-sm ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>}
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, 1 maiúscula, 1 número, 1 caractere especial</p>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={changePassword} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Alterar Senha</button>
        </div>
      </div>
    </div>
  );
}
