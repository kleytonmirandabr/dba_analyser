import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react';
import { Key, Search } from 'lucide-react';
import api from '../lib/api';

interface Feature { code: string; name: string; description: string; module: string; }

export default function FeaturesPage() {
  const { t } = useTranslation()
  const [grouped, setGrouped] = useState<Record<string, Feature[]>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/api/features').then(({ data }) => setGrouped(data.grouped));
  }, []);

  const filtered = Object.entries(grouped).reduce((acc, [module, feats]) => {
    const f = feats.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()) || f.description?.toLowerCase().includes(search.toLowerCase()));
    if (f.length > 0) acc[module] = f;
    return acc;
  }, {} as Record<string, Feature[]>);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="w-6 h-6" /> Funcionalidades</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="pl-9 pr-4 py-2 border border-border rounded-lg bg-background w-64" placeholder="Buscar funcionalidade..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Funcionalidades são registradas automaticamente pelo sistema. Não podem ser criadas ou editadas manualmente. Use os Perfis para vincular funcionalidades aos usuários.</p>

      <div className="space-y-6">
        {Object.entries(filtered).map(([module, feats]) => (
          <div key={module} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 font-semibold text-sm flex items-center justify-between">
              <span>{module}</span>
              <span className="text-xs text-muted-foreground">{feats.length} funcionalidade{feats.length > 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {feats.map(f => (
                  <tr key={f.code} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs text-blue-600 dark:text-blue-400 w-48">{f.code}</td>
                    <td className="p-3 font-medium">{f.name}</td>
                    <td className="p-3 text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
