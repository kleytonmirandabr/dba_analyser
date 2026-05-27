import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react';
import { Bell, Plus, Pencil, Trash2, Send, TestTube2 } from 'lucide-react';
import api from '../lib/api';

interface Channel {
  id: string; name: string; type: 'telegram' | 'email' | 'webhook' | 'slack';
  config: any; isActive: boolean; severity: string; alertIds?: string[];
}

const TYPE_LABELS: Record<string, string> = { telegram: 'Telegram', email: 'Email', webhook: 'Webhook', slack: 'Slack' };
const TYPE_COLORS: Record<string, string> = { telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', email: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', webhook: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', slack: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };

export default function NotificationsPage() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<any>({ type: 'telegram', config: {}, isActive: true, severity: 'all' });

  useEffect(() => { load(); }, []);
  async function load() { const { data } = await api.get('/api/notifications'); setChannels(data); }

  async function save() {
    if (!form.name || !form.type) return alert('Preencha nome e tipo');
    if (editing) { await api.put(`/api/notifications/${editing.id}`, form); }
    else { await api.post('/api/notifications', form); }
    setShowForm(false); setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm(t('notifications.confirmDelete'))) return;
    await api.delete(`/api/notifications/${id}`); load();
  }

  async function test() {
    await api.post('/api/notifications/test', {});
    alert('Notificação de teste enviada!');
  }

  function edit(c: Channel) { setForm({ ...c }); setEditing(c); setShowForm(true); }

  function renderConfigFields() {
    if (form.type === 'telegram') return (<>
      <div><label className="text-xs font-medium text-muted-foreground">Bot Token</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" placeholder="123456:ABC-DEF..." value={form.config?.botToken || ''} onChange={e => setForm({...form, config: {...form.config, botToken: e.target.value}})} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Chat ID</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" placeholder="-1001234567890" value={form.config?.chatId || ''} onChange={e => setForm({...form, config: {...form.config, chatId: e.target.value}})} /></div>
    </>);
    if (form.type === 'email') return (<>
      <div><label className="text-xs font-medium text-muted-foreground">SMTP Host</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" value={form.config?.smtp?.host || ''} onChange={e => setForm({...form, config: {...form.config, smtp: {...(form.config?.smtp||{}), host: e.target.value}}})} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">SMTP Port</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" value={form.config?.smtp?.port || ''} onChange={e => setForm({...form, config: {...form.config, smtp: {...(form.config?.smtp||{}), port: e.target.value}}})} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">SMTP User</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" value={form.config?.smtp?.user || ''} onChange={e => setForm({...form, config: {...form.config, smtp: {...(form.config?.smtp||{}), user: e.target.value}}})} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">SMTP Password</label>
        <input type="password" className="w-full border border-border rounded px-3 py-2 bg-background text-sm" value={form.config?.smtp?.pass || ''} onChange={e => setForm({...form, config: {...form.config, smtp: {...(form.config?.smtp||{}), pass: e.target.value}}})} /></div>
      <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Destinatários (separados por vírgula)</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" value={(form.config?.to || []).join(', ')} onChange={e => setForm({...form, config: {...form.config, to: e.target.value.split(',').map((s:string) => s.trim()).filter(Boolean)}})} /></div>
    </>);
    if (form.type === 'webhook') return (<>
      <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">URL</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" placeholder="https://..." value={form.config?.url || ''} onChange={e => setForm({...form, config: {...form.config, url: e.target.value}})} /></div>
    </>);
    if (form.type === 'slack') return (<>
      <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
        <input className="w-full border border-border rounded px-3 py-2 bg-background text-sm" placeholder="https://hooks.slack.com/..." value={form.config?.webhookUrl || ''} onChange={e => setForm({...form, config: {...form.config, webhookUrl: e.target.value}})} /></div>
    </>);
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6" /> Notificações</h1>
        <div className="flex gap-2">
          <button onClick={test} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"><TestTube2 className="w-4 h-4" /> Testar</button>
          <button onClick={() => { setEditing(null); setForm({ type: 'telegram', config: {}, isActive: true, severity: 'all' }); setShowForm(true); }} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Novo Canal
          </button>
        </div>
      </div>

      {/* Channels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map(c => (
          <div key={c.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{c.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => edit(c)} className="p-1 hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(c.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLORS[c.type]}`}>{TYPE_LABELS[c.type]}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${c.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'}`}>{c.isActive ? 'Ativo' : 'Inativo'}</span>
              <span className="text-xs text-muted-foreground">Severidade: {c.severity}</span>
            </div>
            {c.type === 'telegram' && <p className="text-xs text-muted-foreground">Chat: {c.config?.chatId}</p>}
            {c.type === 'webhook' && <p className="text-xs text-muted-foreground truncate">{c.config?.url}</p>}
            {c.type === 'slack' && <p className="text-xs text-muted-foreground truncate">{c.config?.webhookUrl}</p>}
            {c.type === 'email' && <p className="text-xs text-muted-foreground">{c.config?.to?.join(', ')}</p>}
          </div>
        ))}
        {channels.length === 0 && <p className="col-span-3 text-center py-12 text-muted-foreground">{t('notifications.noChannels')}</p>}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? t('notifications.editChannel') : t('notifications.newChannel')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.type} onChange={e => setForm({...form, type: e.target.value, config: {}})}>
                  <option value="telegram">Telegram</option><option value="email">Email</option><option value="webhook">Webhook</option><option value="slack">Slack</option>
                </select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Severidade</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
                  <option value="all">Todas</option><option value="critical">Somente Crítico</option><option value="warning">Warning +</option>
                </select></div>
              {renderConfigFields()}
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} /><label className="text-sm">Ativo</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg">{t('common.cancel')}</button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
