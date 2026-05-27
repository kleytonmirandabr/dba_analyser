import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Pencil, Trash2, Check, Minus } from 'lucide-react';
import api from '../services/api';

interface Profile { id: string; name: string; description?: string; clientId?: string; isDefault: boolean; features?: string[]; }
interface Feature { id: string; code: string; name: string; description: string; module: string; moduleOrder: number; featureOrder: number; }
interface GroupedFeatures { [module: string]: Feature[]; }

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [grouped, setGrouped] = useState<GroupedFeatures>({});
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; isDefault: boolean; features: string[] }>({ name: '', description: '', isDefault: false, features: [] });

  useEffect(() => { load(); loadFeatures(); }, []);

  async function load() {
    const { data } = await api.get('/profiles');
    setProfiles(data);
  }

  async function loadFeatures() {
    const { data } = await api.get('/features');
    setFeatures(data.features);
    setGrouped(data.grouped);
  }

  async function openEdit(p: Profile) {
    const { data } = await api.get(`/profiles/${p.id}`);
    setForm({ name: data.name, description: data.description || '', isDefault: data.isDefault, features: data.features || [] });
    setEditing(p);
    setShowForm(true);
  }

  async function save() {
    if (!form.name) return alert('Nome obrigatório');
    if (editing) {
      await api.put(`/profiles/${editing.id}`, form);
    } else {
      await api.post('/profiles', form);
    }
    setShowForm(false); setEditing(null); setForm({ name: '', description: '', isDefault: false, features: [] });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Deseja excluir este perfil?')) return;
    await api.delete(`/profiles/${id}`);
    load();
  }

  function toggleFeature(code: string) {
    setForm(f => ({
      ...f,
      features: f.features.includes(code) ? f.features.filter(c => c !== code) : [...f.features, code],
    }));
  }

  function toggleModule(module: string) {
    const moduleCodes = grouped[module]?.map(f => f.code) || [];
    const allSelected = moduleCodes.every(c => form.features.includes(c));
    if (allSelected) {
      setForm(f => ({ ...f, features: f.features.filter(c => !moduleCodes.includes(c)) }));
    } else {
      setForm(f => ({ ...f, features: [...new Set([...f.features, ...moduleCodes])] }));
    }
  }

  function moduleCheckState(module: string): 'all' | 'some' | 'none' {
    const moduleCodes = grouped[module]?.map(f => f.code) || [];
    const selected = moduleCodes.filter(c => form.features.includes(c)).length;
    if (selected === 0) return 'none';
    if (selected === moduleCodes.length) return 'all';
    return 'some';
  }

  const sortedModules = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const oa = grouped[a]?.[0]?.moduleOrder || 0;
      const ob = grouped[b]?.[0]?.moduleOrder || 0;
      return oa - ob;
    });
  }, [grouped]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> Perfis</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', isDefault: false, features: [] }); setShowForm(true); }} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Novo Perfil
        </button>
      </div>

      {/* Profiles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(p => (
          <div key={p.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{p.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1 hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(p.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{p.description || 'Sem descrição'}</p>
            {p.isDefault && <span className="inline-block mt-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">Padrão</span>}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Perfil' : 'Novo Perfil'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <input className="w-full border border-border rounded px-3 py-2 bg-background" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
            </div>

            <h3 className="font-semibold mb-3">Funcionalidades</h3>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto border border-border rounded-lg p-4">
              {sortedModules.map(module => {
                const state = moduleCheckState(module);
                return (
                  <div key={module} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-center gap-2 cursor-pointer select-none mb-2" onClick={() => toggleModule(module)}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        state === 'all' ? 'bg-blue-600 border-blue-600 text-white' :
                        state === 'some' ? 'bg-blue-200 border-blue-400 dark:bg-blue-900 dark:border-blue-600' :
                        'border-gray-300 dark:border-gray-600'
                      }`}>
                        {state === 'all' && <Check className="w-3 h-3" />}
                        {state === 'some' && <Minus className="w-3 h-3 text-blue-700 dark:text-blue-300" />}
                      </div>
                      <span className="font-medium text-sm">{module}</span>
                      <span className="text-xs text-muted-foreground">({grouped[module]?.length})</span>
                    </div>
                    <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-1">
                      {grouped[module]?.map(f => (
                        <label key={f.code} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1" title={f.description || ''}>
                          <input type="checkbox" checked={form.features.includes(f.code)} onChange={() => toggleFeature(f.code)} className="rounded" />
                          <span>{f.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">{form.features.length} funcionalidades selecionadas</span>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg">Cancelar</button>
                <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
