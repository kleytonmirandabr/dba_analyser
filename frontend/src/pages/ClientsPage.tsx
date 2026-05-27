import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, Globe, Languages } from 'lucide-react';
import api from '../lib/api';

const TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'America/Fortaleza',
  'America/Cuiaba', 'America/Porto_Velho', 'America/Rio_Branco', 'America/Noronha',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
];

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
];

const COUNTRIES = [
  { value: 'BR', label: 'Brasil' }, { value: 'US', label: 'Estados Unidos' },
  { value: 'PT', label: 'Portugal' }, { value: 'ES', label: 'Espanha' },
  { value: 'CO', label: 'Colômbia' }, { value: 'AR', label: 'Argentina' },
  { value: 'MX', label: 'México' }, { value: 'CL', label: 'Chile' },
];

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const TIME_FORMATS = ['24h', '12h'];

interface Client {
  id: string; name: string; code: string; timezone: string; language: string;
  country: string; dateFormat: string; timeFormat: string; isActive: boolean;
  maxUsers: number; maxConnections: number; logo?: string; primaryContact?: string;
  contactEmail?: string; contractStart?: string; contractEnd?: string; notes?: string;
}

export default function ClientsPage() {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({
    timezone: 'America/Sao_Paulo', language: 'pt-BR', country: 'BR',
    dateFormat: 'DD/MM/YYYY', timeFormat: '24h', maxUsers: 10, maxConnections: 20, isActive: true,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await api.get('/api/clients');
    setClients(data);
  }

  async function save() {
    if (!form.name || !form.code || !form.timezone || !form.language || !form.country) return alert('Preencha os campos obrigatórios');
    if (editing) {
      await api.put(`/api/clients/${editing.id}`, form);
    } else {
      await api.post('/api/clients', form);
    }
    setShowForm(false); setEditing(null);
    setForm({ timezone: 'America/Sao_Paulo', language: 'pt-BR', country: 'BR', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', maxUsers: 10, maxConnections: 20, isActive: true });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Deseja realmente excluir este cliente?')) return;
    await api.delete(`/api/clients/${id}`);
    load();
  }

  function edit(c: Client) {
    setForm(c); setEditing(c); setShowForm(true);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6" /> Clientes</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Código</th>
              <th className="text-left p-3 font-medium"><Globe className="w-3.5 h-3.5 inline mr-1" />Timezone</th>
              <th className="text-left p-3 font-medium"><Languages className="w-3.5 h-3.5 inline mr-1" />Idioma</th>
              <th className="text-left p-3 font-medium">País</th>
              <th className="text-center p-3 font-medium">Usuários</th>
              <th className="text-center p-3 font-medium">Conexões</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-muted-foreground">{c.code}</td>
                <td className="p-3 text-xs">{c.timezone}</td>
                <td className="p-3 text-xs">{LANGUAGES.find(l => l.value === c.language)?.label || c.language}</td>
                <td className="p-3">{c.country}</td>
                <td className="p-3 text-center">{c.maxUsers}</td>
                <td className="p-3 text-center">{c.maxConnections}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {c.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => edit(c)} className="p-1 hover:bg-muted rounded" title="Editar"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(c.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum cliente cadastrado</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Código (slug) *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.code || ''} onChange={e => setForm({...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Timezone *</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.timezone || ''} onChange={e => setForm({...form, timezone: e.target.value})}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Idioma *</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.language || ''} onChange={e => setForm({...form, language: e.target.value})}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">País *</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.country || ''} onChange={e => setForm({...form, country: e.target.value})}>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Formato de Data</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.dateFormat || ''} onChange={e => setForm({...form, dateFormat: e.target.value})}>
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Formato de Hora</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.timeFormat || ''} onChange={e => setForm({...form, timeFormat: e.target.value})}>
                  {TIME_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Máx. Usuários</label>
                <input type="number" className="w-full border border-border rounded px-3 py-2 bg-background" value={form.maxUsers || 10} onChange={e => setForm({...form, maxUsers: +e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Máx. Conexões</label>
                <input type="number" className="w-full border border-border rounded px-3 py-2 bg-background" value={form.maxConnections || 20} onChange={e => setForm({...form, maxConnections: +e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contato Principal</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.primaryContact || ''} onChange={e => setForm({...form, primaryContact: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email Contato</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.contactEmail || ''} onChange={e => setForm({...form, contactEmail: e.target.value})} />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} />
                <label className="text-sm">Ativo</label>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                <textarea className="w-full border border-border rounded px-3 py-2 bg-background h-20" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg">Cancelar</button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
