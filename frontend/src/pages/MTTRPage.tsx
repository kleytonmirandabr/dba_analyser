import { useState, useEffect } from 'react';
import { Clock, RefreshCw, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

interface MTTRData {
  period: { hours: number };
  totalIncidents: number; openCount: number;
  mttr: { avg: number; max: number; min: number };
  byAlert: { alertId: string; name: string; count: number; avgMin: number }[];
  recentIncidents: { alertName: string; database: string; startedAt: string; resolvedAt: string; durationMin: number }[];
}

export default function MTTRPage() {
  const [data, setData] = useState<MTTRData | null>(null);
  const [hours, setHours] = useState(168);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { const { data: d } = await api.get(`/api/alerts/mttr?hours=${hours}`); setData(d); } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [hours]);

  function fmtDuration(min: number) {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return `${h}h ${m}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6" /> MTTR — Tempo de Resolução</h1>
        <div className="flex items-center gap-3">
          <select className="border border-border rounded px-3 py-1.5 bg-background text-sm" value={hours} onChange={e => setHours(+e.target.value)}>
            <option value={24}>24 horas</option>
            <option value={72}>3 dias</option>
            <option value={168}>7 dias</option>
            <option value={720}>30 dias</option>
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg hover:bg-muted text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {data && (<>
        {/* Summary cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">Incidentes</p>
            <p className="text-2xl font-bold">{data.totalIncidents}</p>
          </div>
          <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-center bg-amber-50/50 dark:bg-amber-950/20">
            <p className="text-xs text-amber-600">Abertos</p>
            <p className="text-2xl font-bold text-amber-600">{data.openCount}</p>
          </div>
          <div className="border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-center bg-blue-50/50 dark:bg-blue-950/20">
            <p className="text-xs text-blue-600">MTTR Médio</p>
            <p className="text-2xl font-bold text-blue-600">{fmtDuration(data.mttr.avg)}</p>
          </div>
          <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 text-center bg-red-50/50 dark:bg-red-950/20">
            <p className="text-xs text-red-600">MTTR Máximo</p>
            <p className="text-2xl font-bold text-red-600">{fmtDuration(data.mttr.max)}</p>
          </div>
          <div className="border border-green-200 dark:border-green-900 rounded-lg p-4 text-center bg-green-50/50 dark:bg-green-950/20">
            <p className="text-xs text-green-600">MTTR Mínimo</p>
            <p className="text-2xl font-bold text-green-600">{fmtDuration(data.mttr.min)}</p>
          </div>
        </div>

        {/* By alert */}
        <div className="grid grid-cols-2 gap-6">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3 text-sm">MTTR por Alerta</h3>
            <div className="space-y-2">
              {data.byAlert.map(a => (
                <div key={a.alertId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{a.name}</span>
                  <span className="text-muted-foreground mx-2">{a.count}x</span>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{fmtDuration(a.avgMin)}</span>
                </div>
              ))}
              {data.byAlert.length === 0 && <p className="text-sm text-muted-foreground">Nenhum incidente resolvido no período</p>}
            </div>
          </div>

          {/* Recent incidents */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3 text-sm">Últimos Incidentes Resolvidos</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.recentIncidents.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs border-b border-border pb-2 last:border-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{i.alertName}</p>
                    <p className="text-muted-foreground">{i.database}</p>
                  </div>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{fmtDuration(i.durationMin)}</span>
                </div>
              ))}
              {data.recentIncidents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum incidente resolvido</p>}
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}
