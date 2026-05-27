import { useState, useEffect, useMemo, useRef } from 'react';
import { User, Save, Lock, Eye, EyeOff, CheckCircle2, Globe, Languages, Shield, QrCode, Search, ChevronDown, Phone } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo', offset: 'UTC-3' },
  { value: 'America/Manaus', label: 'Manaus', offset: 'UTC-4' },
  { value: 'America/Bahia', label: 'Bahia', offset: 'UTC-3' },
  { value: 'America/Fortaleza', label: 'Fortaleza', offset: 'UTC-3' },
  { value: 'America/Cuiaba', label: 'Cuiabá', offset: 'UTC-4' },
  { value: 'America/Porto_Velho', label: 'Porto Velho', offset: 'UTC-4' },
  { value: 'America/Rio_Branco', label: 'Rio Branco', offset: 'UTC-5' },
  { value: 'America/Noronha', label: 'Noronha', offset: 'UTC-2' },
  { value: 'America/New_York', label: 'New York', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'Chicago', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'Denver', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', offset: 'UTC-8' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires', offset: 'UTC-3' },
  { value: 'America/Santiago', label: 'Santiago', offset: 'UTC-4' },
  { value: 'America/Bogota', label: 'Bogotá', offset: 'UTC-5' },
  { value: 'America/Mexico_City', label: 'Cidade do México', offset: 'UTC-6' },
  { value: 'Europe/London', label: 'Londres', offset: 'UTC+0' },
  { value: 'Europe/Lisbon', label: 'Lisboa', offset: 'UTC+0' },
  { value: 'Europe/Madrid', label: 'Madrid', offset: 'UTC+1' },
  { value: 'Europe/Paris', label: 'Paris', offset: 'UTC+1' },
  { value: 'Europe/Berlin', label: 'Berlim', offset: 'UTC+1' },
  { value: 'Asia/Tokyo', label: 'Tóquio', offset: 'UTC+9' },
  { value: 'Asia/Shanghai', label: 'Xangai', offset: 'UTC+8' },
  { value: 'Asia/Dubai', label: 'Dubai', offset: 'UTC+4' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: 'UTC+10' },
  { value: 'UTC', label: 'UTC', offset: 'UTC+0' },
];

const COUNTRIES_PHONE = [
  { code: 'BR', flag: '🇧🇷', ddi: '+55', mask: '(##) #####-####' },
  { code: 'US', flag: '🇺🇸', ddi: '+1', mask: '(###) ###-####' },
  { code: 'PT', flag: '🇵🇹', ddi: '+351', mask: '### ### ###' },
  { code: 'AR', flag: '🇦🇷', ddi: '+54', mask: '## ####-####' },
  { code: 'CO', flag: '🇨🇴', ddi: '+57', mask: '### ###-####' },
  { code: 'MX', flag: '🇲🇽', ddi: '+52', mask: '## ####-####' },
  { code: 'ES', flag: '🇪🇸', ddi: '+34', mask: '### ## ## ##' },
  { code: 'CL', flag: '🇨🇱', ddi: '+56', mask: '# ####-####' },
];

const LANGUAGES = [
  { value: '', label: 'Usar padrão do cliente' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
];

function applyPhoneMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, '');
  let result = '';
  let di = 0;
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === '#') { result += digits[di]; di++; }
    else { result += mask[i]; }
  }
  return result;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Searchable Timezone Select
function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return TIMEZONES;
    const q = search.toLowerCase();
    return TIMEZONES.filter(tz => tz.label.toLowerCase().includes(q) || tz.value.toLowerCase().includes(q) || tz.offset.toLowerCase().includes(q));
  }, [search]);

  const selected = TIMEZONES.find(tz => tz.value === value);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full border border-border rounded px-3 py-2 bg-background text-left flex items-center justify-between text-sm">
        {selected ? (
          <span><span className="font-medium">{selected.label}</span> <span className="text-muted-foreground text-xs">({selected.offset})</span></span>
        ) : <span className="text-muted-foreground">Selecione o timezone...</span>}
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="w-full pl-8 pr-3 py-1.5 border border-border rounded bg-background text-sm" placeholder="Buscar timezone..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 text-muted-foreground">
              Usar padrão do cliente
            </button>
            {filtered.map(tz => (
              <button key={tz.value} type="button" onClick={() => { onChange(tz.value); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between ${value === tz.value ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                <span>{tz.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{tz.offset}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum resultado</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Phone input with country flag + DDI + mask
function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [country, setCountry] = useState(COUNTRIES_PHONE[0]);
  const [showCountries, setShowCountries] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect country from value
    for (const c of COUNTRIES_PHONE) {
      if (value?.startsWith(c.ddi)) { setCountry(c); break; }
    }
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setShowCountries(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const rawDigits = value?.replace(/\D/g, '').replace(new RegExp('^' + country.ddi.replace('+', '')), '') || '';
  const masked = applyPhoneMask(rawDigits, country.mask);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(country.ddi + digits);
  }

  return (
    <div className="flex gap-1" ref={ref}>
      <div className="relative">
        <button type="button" onClick={() => setShowCountries(!showCountries)}
          className="h-full px-2 border border-border rounded-l bg-muted/50 flex items-center gap-1 text-sm min-w-[80px]">
          <span>{country.flag}</span>
          <span className="text-xs text-muted-foreground">{country.ddi}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        {showCountries && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-background border border-border rounded-lg shadow-lg w-44">
            {COUNTRIES_PHONE.map(c => (
              <button key={c.code} type="button" onClick={() => { setCountry(c); setShowCountries(false); onChange(c.ddi + rawDigits); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 text-left">
                <span>{c.flag}</span><span>{c.ddi}</span><span className="text-muted-foreground text-xs">{c.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        className="flex-1 border border-border rounded-r px-3 py-2 bg-background text-sm"
        placeholder={country.mask.replace(/#/g, '0')}
        value={masked}
        onChange={handleChange}
      />
    </div>
  );
}

export default function MyAccountPage() {
  const { user, loadUser } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', preferredLanguage: '', preferredTimezone: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [twoFA, setTwoFA] = useState<{ enabled: boolean; secret?: string; otpauthUrl?: string }>({ enabled: false });
  const [tfaToken, setTfaToken] = useState('');
  const [tfaMsg, setTfaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function setup2FA() {
    try { const { data } = await api.post('/api/2fa/setup'); setTwoFA({ enabled: false, secret: data.secret, otpauthUrl: data.otpauthUrl }); }
    catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Erro' }); }
  }
  async function enable2FA() {
    try { await api.post('/api/2fa/enable', { token: tfaToken }); setTwoFA({ enabled: true }); setTfaToken(''); setTfaMsg({ type: 'ok', text: '2FA ativado!' }); }
    catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Código inválido' }); }
  }
  async function disable2FA() {
    try { await api.post('/api/2fa/disable', { token: tfaToken }); setTwoFA({ enabled: false }); setTfaToken(''); setTfaMsg({ type: 'ok', text: '2FA desativado' }); }
    catch (e: any) { setTfaMsg({ type: 'err', text: e.response?.data?.error || 'Código inválido' }); }
  }

  useEffect(() => {
    if (user) setForm({ name: user.name || '', email: (user as any).email || '', phone: (user as any).phone || '', preferredLanguage: (user as any).preferredLanguage || '', preferredTimezone: (user as any).preferredTimezone || '' });
  }, [user]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório';
    if (!form.email.trim()) errs.email = 'Email é obrigatório';
    else if (!validateEmail(form.email)) errs.email = 'Email inválido (ex: usuario@dominio.com)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveProfile() {
    if (!validate()) return;
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6"><User className="w-6 h-6" /> Minha Conta</h1>

      {/* Profile section */}
      <div className="border border-border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-4">Dados Pessoais</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome <span className="text-red-500">*</span></label>
            <input className={`w-full border rounded px-3 py-2 bg-background ${errors.name ? 'border-red-500' : 'border-border'}`} value={form.name} onChange={e => { setForm({...form, name: e.target.value}); setErrors({...errors, name: ''}); }} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email <span className="text-red-500">*</span></label>
            <input type="email" placeholder="usuario@dominio.com" className={`w-full border rounded px-3 py-2 bg-background ${errors.email ? 'border-red-500' : 'border-border'}`} value={form.email} onChange={e => { setForm({...form, email: e.target.value}); setErrors({...errors, email: ''}); }} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</label>
            <PhoneInput value={form.phone} onChange={v => setForm({...form, phone: v})} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Timezone (override pessoal)</label>
            <TimezoneSelect value={form.preferredTimezone} onChange={v => setForm({...form, preferredTimezone: v})} />
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
