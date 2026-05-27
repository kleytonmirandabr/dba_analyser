import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

interface SearchItem { path: string; label: string; keywords: string[]; feature?: string; }

const SEARCH_ITEMS: SearchItem[] = [
  { path: '/', label: 'Dashboard', keywords: ['dashboard', 'inicio', 'home'], feature: 'dashboard.view' },
  { path: '/connections', label: 'Conexões', keywords: ['conexao', 'banco', 'database', 'host'], feature: 'connections.view' },
  { path: '/query', label: 'Query Editor', keywords: ['query', 'sql', 'select', 'editor'], feature: 'query.execute' },
  { path: '/monitor', label: 'Monitor', keywords: ['monitor', 'sessao', 'processo', 'kill', 'lock'], feature: 'monitor.view' },
  { path: '/alerts', label: 'Alertas', keywords: ['alerta', 'regra', 'notificacao', 'trigger'], feature: 'alerts.view' },
  { path: '/availability', label: 'Disponibilidade', keywords: ['disponibilidade', 'sla', 'uptime'], feature: 'availability.view' },
  { path: '/heartbeat', label: 'Heartbeat', keywords: ['heartbeat', 'ping', 'online', 'offline'], feature: 'monitor.view' },
  { path: '/mttr', label: 'MTTR', keywords: ['mttr', 'resolucao', 'tempo', 'incidente'], feature: 'alerts.view' },
  { path: '/health', label: 'Health Monitor', keywords: ['health', 'saude', 'tabela', 'indice'], feature: 'health.view' },
  { path: '/growth', label: 'Crescimento', keywords: ['crescimento', 'tamanho', 'disco'], feature: 'growth.view' },
  { path: '/backup', label: 'Backup', keywords: ['backup', 'restaurar'], feature: 'backup.view' },
  { path: '/diagnostics', label: 'Diagnóstico', keywords: ['diagnostico', 'analise'], feature: 'diagnostics.view' },
  { path: '/vpn', label: 'VPN', keywords: ['vpn', 'openvpn', 'tunel'], feature: 'vpn.view' },
  { path: '/reports', label: 'Relatórios', keywords: ['relatorio', 'pdf', 'export'], feature: 'reports.view' },
  { path: '/compare', label: 'Comparador', keywords: ['comparar', 'schema', 'diff'], feature: 'comparator.view' },
  { path: '/er-diagram', label: 'ER Diagram', keywords: ['diagrama', 'entidade', 'relacionamento'], feature: 'erdiagram.view' },
  { path: '/notifications', label: 'Notificações', keywords: ['notificacao', 'telegram', 'email', 'webhook'], feature: 'alerts.manage' },
  { path: '/clients', label: 'Clientes', keywords: ['cliente', 'tenant', 'organizacao'], feature: 'admin.clients' },
  { path: '/users', label: 'Usuários', keywords: ['usuario', 'conta', 'perfil'], feature: 'admin.users' },
  { path: '/profiles', label: 'Perfis', keywords: ['perfil', 'permissao', 'acesso'], feature: 'admin.profiles' },
  { path: '/features', label: 'Funcionalidades', keywords: ['funcionalidade', 'feature', 'permissao'], feature: 'admin.profiles' },
  { path: '/help', label: 'Central de Ajuda', keywords: ['ajuda', 'help', 'documentacao', 'como'] },
  { path: '/my-account', label: 'Minha Conta', keywords: ['conta', 'senha', 'perfil', 'idioma', '2fa'] },
  { path: '/settings', label: 'Configurações', keywords: ['configuracao', 'config'], feature: 'admin.settings' },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { hasFeature } = useAuthStore();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const results = useMemo(() => {
    if (!query) return SEARCH_ITEMS.filter(i => !i.feature || hasFeature(i.feature)).slice(0, 8);
    const q = query.toLowerCase();
    return SEARCH_ITEMS
      .filter(i => (!i.feature || hasFeature(i.feature)) && (i.label.toLowerCase().includes(q) || i.keywords.some(k => k.includes(q))))
      .slice(0, 8);
  }, [query, hasFeature]);

  function go(path: string) { navigate(path); setOpen(false); setQuery(''); }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input ref={inputRef} className="flex-1 bg-transparent outline-none text-base" placeholder="Buscar telas, funcionalidades..." value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && results.length > 0) go(results[0].path); }} />
          <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {results.map(item => (
            <button key={item.path} onClick={() => go(item.path)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition text-left">
              <span className="flex-1">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.path}</span>
            </button>
          ))}
          {results.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum resultado</p>}
        </div>
      </div>
    </div>
  );
}
