import { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, Circle, AlertTriangle, XCircle, Clock, Zap } from 'lucide-react';
import api from '../services/api';

interface HeartbeatResult {
  connectionId: string; connectionName: string; databaseName: string;
  dbType: string; status: 'online' | 'offline' | 'warning' | 'error';
  responseMs: number; details: any; checkedAt: string;
}

export default function HeartbeatPage() {
  const [results, setResults] = useState<HeartbeatResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<any>(null);

  async function check() {
    setLoading(true);
    try {
      const { data } = await api.get('/heartbeat/status');
      setResults(data);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { check(); }, []);
  useEffect(() => {
    if (autoRefresh) { intervalRef.current = setInterval(check, 30000); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const online = results.filter(r => r.status === 'online').length;
  const offline = results.filter(r => r.status === 'offline').length;
  const warning = results.filter(r => r.status === 'warning').length;

  function statusIcon(s: string) {
    if (s === 'online') return <Circle className="w-3 h-3 fill-green-500 text-green-500" />;
    if (s === 'warning') return <AlertTriangle className="w-3 h-3 text-amber-500" />;
    return <XCircle className="w-3 h-3 text-red-500" />;
  }

  function statusBg(s: string) {
    if (s === 'online') return 'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20';
    if (s === 'warning') return 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20';
    return 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20';
  }

  function formatUptime(seconds: number) {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6" /> Heartbeat</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto (30s)
          </label>
          <button onClick={check} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg hover:bg-muted text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Verificar
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{results.length}</p>
        </div>
        <div className="border border-green-200 dark:border-green-900 rounded-lg p-4 text-center bg-green-50/50 dark:bg-green-950/20">
          <p className="text-xs text-green-700 dark:text-green-400">Online</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{online}</p>
        </div>
        <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-center bg-amber-50/50 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">Warning</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{warning}</p>
        </div>
        <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 text-center bg-red-50/50 dark:bg-red-950/20">
          <p className="text-xs text-red-700 dark:text-red-400">Offline</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{offline}</p>
        </div>
      </div>

      {/* Connection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map(r => (
          <div key={r.connectionId} className={`border rounded-lg p-4 ${statusBg(r.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {statusIcon(r.status)}
                <span className="font-semibold text-sm">{r.connectionName}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{r.dbType}</span>
            </div>
            {r.databaseName && <p className="text-xs text-muted-foreground mb-2">{r.databaseName}</p>}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3" />{r.responseMs}ms</span>
              {r.details?.uptimeSeconds && <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" />{formatUptime(r.details.uptimeSeconds)}</span>}
              {r.details?.activeSessions !== undefined && <span className="text-muted-foreground">{r.details.activeSessions} sessões</span>}
            </div>
            {r.status === 'offline' && r.details?.error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 truncate" title={r.details.error}>{r.details.error}</p>
            )}
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">Nenhuma conexão configurada</div>
        )}
      </div>
    </div>
  );
}
