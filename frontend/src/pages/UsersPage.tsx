import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

interface UserItem {
  id: string; name: string; username: string; email?: string; phone?: string;
  isActive: boolean; clientId?: string; profileId?: string;
  preferredLanguage?: string; preferredTimezone?: string;
  client?: { id: string; name: string };
  profile?: { id: string; name: string };
  lastLoginAt?: string; createdAt: string;
}
interface Client { id: string; name: string; }
interface Profile { id: string; name: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState<any>({ isActive: true });

  useEffect(() => { load(); loadMeta(); }, []);

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }
  async function loadMeta() {
    const [c, p] = await Promise.all([api.get('/clients'), api.get('/profiles')]);
    setClients(c.data);
    setProfiles(p.data);
  }

  async function save() {
    if (!form.name || !form.username || !form.clientId || !form.profileId) return alert('Preencha os campos obrigatórios');
    if (!editing && !form.password) return alert('Senha obrigatória para novo usuário');
    if (editing) {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await api.put(`/users/${editing.id}`, payload);
    } else {
      await api.post('/users', form);
    }
    setShowForm(false); setEditing(null); setForm({ isActive: true });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Deseja excluir este usuário?')) return;
    await api.delete(`/users/${id}`);
    load();
  }

  function edit(u: UserItem) {
    setForm({ name: u.name, username: u.username, email: u.email, phone: u.phone, clientId: u.clientId, profileId: u.profileId, preferredLanguage: u.preferredLanguage, preferredTimezone: u.preferredTimezone, isActive: u.isActive });
    setEditing(u); setShowForm(true);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Usuários</h1>
        <button onClick={() => { setEditing(null); setForm({ isActive: true }); setShowForm(true); }} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Username</th>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium">Perfil</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Último Login</th>
              <th className="text-center p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-muted-foreground">{u.username}</td>
                <td className="p-3">{u.client?.name || '-'}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{u.profile?.name || '-'}</span>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}</td>
                <td className="p-3 text-center">
                  <button onClick={() => edit(u)} className="p-1 hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(u.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum usuário cadastrado</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Username *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.username || ''} onChange={e => setForm({...form, username: e.target.value})} disabled={!!editing} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Senha {editing ? '(deixe vazio para manter)' : '*'}</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className="w-full border border-border rounded px-3 py-2 bg-background pr-10" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.clientId || ''} onChange={e => setForm({...form, clientId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Perfil *</label>
                <select className="w-full border border-border rounded px-3 py-2 bg-background" value={form.profileId || ''} onChange={e => setForm({...form, profileId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({...form, isActive: e.target.checked})} />
                <label className="text-sm">Ativo</label>
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
