import { useState } from 'react'
import { Zap, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react'
import DbaPanel from './DbaPanel'

const PANEL_OPTIONS = [
  { id: 'longQueries', label: 'Long Queries', icon: '🐌' },
  { id: 'waitStats', label: 'Wait Stats', icon: '⏳' },
  { id: 'memory', label: 'Memória / PLE', icon: '🧠' },
  { id: 'cpu', label: 'CPU', icon: '💻' },
  { id: 'io', label: 'IO Latency', icon: '💾' },
  { id: 'tempdb', label: 'TempDB', icon: '🗂️' },
  { id: 'idleSessions', label: 'Sessões Ociosas', icon: '😴' },
  { id: 'sessionsByApp', label: 'Sessões por App', icon: '📊' },
  { id: 'topConsumers', label: 'Top Consumers', icon: '🔥' },
  { id: 'deadlocks', label: 'Deadlocks', icon: '💀' },
  { id: 'logUsage', label: 'Log Usage', icon: '📜' },
]

interface Props {
  dbaStats: any
  enabledPanels: Set<string>
  setEnabledPanels: (fn: (prev: Set<string>) => Set<string>) => void
}

export default function DbaPanels({ dbaStats, enabledPanels, setEnabledPanels }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 hover:opacity-80 transition">
          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Painéis DBA</h2>
        </button>
        {!collapsed && (
          <button onClick={() => setShowConfig(!showConfig)}
            className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
            {showConfig ? <ToggleRight className="w-4 h-4 text-blue-400" /> : <ToggleLeft className="w-4 h-4" />}
            Configurar painéis
          </button>
        )}
      </div>

      {!collapsed && showConfig && (
        <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-wrap gap-2">
          {PANEL_OPTIONS.map(p => {
            const enabled = enabledPanels.has(p.id)
            return (
              <button key={p.id} onClick={() => setEnabledPanels(prev => {
                const n = new Set(prev); enabled ? n.delete(p.id) : n.add(p.id); return n
              })} className={`px-3 py-1.5 rounded-lg text-xs border transition ${enabled ? 'bg-blue-100 dark:bg-blue-600/20 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-600'}`}>
                {p.icon} {p.label}
              </button>
            )
          })}
        </div>
      )}

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enabledPanels.has('longQueries') && dbaStats.longQueries && (
            <DbaPanel title="🐌 Long Running Queries" subtitle={`> 60s (${dbaStats.longQueries.length})`} alert={dbaStats.longQueries.length > 0}>
              {dbaStats.longQueries.length === 0 ? <p className="text-gray-500 text-xs">Nenhuma</p> : (
                <div className="space-y-1">{dbaStats.longQueries.map((q: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-red-400 font-mono w-12">{q.durationSec}s</span>
                    <span className="text-gray-400">{q.username}</span>
                    <span className="text-gray-500 truncate flex-1 font-mono">{q.query?.slice(0, 80)}</span>
                  </div>
                ))}</div>
              )}
            </DbaPanel>
          )}

          {enabledPanels.has('waitStats') && dbaStats.waitStats && (
            <DbaPanel title="⏳ Wait Stats" subtitle="Top waits">
              <div className="space-y-1">{dbaStats.waitStats.slice(0, 8).map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-400 font-mono w-8 text-right">{i + 1}.</span>
                  <span className="text-gray-700 dark:text-gray-300 flex-1 font-mono text-[10px]">{w.waitType}</span>
                  <span className="text-gray-500">{Math.round(w.avgWaitMs || 0)}ms avg</span>
                  <span className="text-gray-400 dark:text-gray-600">{(w.waitCount || 0).toLocaleString()}x</span>
                </div>
              ))}</div>
            </DbaPanel>
          )}

          {enabledPanels.has('memory') && dbaStats.memory?.[0] && (
            <DbaPanel title="🧠 Memória" subtitle="Page Life Expectancy" alert={(dbaStats.memory[0]?.pageLifeExpectancy || 999) < 300}>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className={`text-lg font-bold ${(dbaStats.memory[0]?.pageLifeExpectancy || 0) < 300 ? 'text-red-400' : 'text-green-400'}`}>{dbaStats.memory[0]?.pageLifeExpectancy || 0}</p>
                  <p className="text-[10px] text-gray-500">PLE (seg)</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-400">{((dbaStats.memory[0]?.totalServerMemoryKB || 0) / 1048576).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500">Usado (GB)</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-400">{((dbaStats.memory[0]?.targetServerMemoryKB || 0) / 1048576).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500">Target (GB)</p>
                </div>
              </div>
            </DbaPanel>
          )}

          {enabledPanels.has('cpu') && dbaStats.cpu?.[0] && (
            <DbaPanel title="💻 CPU" alert={(dbaStats.cpu[0]?.sqlCpuPercent || 0) > 80}>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${(dbaStats.cpu[0]?.sqlCpuPercent || 0) > 80 ? 'text-red-400' : (dbaStats.cpu[0]?.sqlCpuPercent || 0) > 50 ? 'text-amber-400' : 'text-green-400'}`}>{dbaStats.cpu[0]?.sqlCpuPercent || 0}%</p>
                  <p className="text-[10px] text-gray-500">SQL Server CPU</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">{dbaStats.cpu[0]?.totalCpuPercent || 0}%</p>
                  <p className="text-[10px] text-gray-500">Total Sistema</p>
                </div>
              </div>
            </DbaPanel>
          )}

          {enabledPanels.has('io') && dbaStats.io && (
            <DbaPanel title="💾 IO Latency" subtitle="Por arquivo">
              <div className="space-y-1">{(dbaStats.io || []).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-12 text-right font-mono ${(f.avgReadLatencyMs || 0) > 20 ? 'text-red-400' : 'text-green-400'}`}>{Math.round(f.avgReadLatencyMs || 0)}ms</span>
                  <span className="text-gray-400 dark:text-gray-600">R</span>
                  <span className={`w-12 text-right font-mono ${(f.avgWriteLatencyMs || 0) > 20 ? 'text-red-400' : 'text-green-400'}`}>{Math.round(f.avgWriteLatencyMs || 0)}ms</span>
                  <span className="text-gray-400 dark:text-gray-600">W</span>
                  <span className="text-[10px] text-gray-500">{f.fileType}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 truncate flex-1">{f.fileName?.split('\\').pop()}</span>
                </div>
              ))}</div>
            </DbaPanel>
          )}

          {enabledPanels.has('tempdb') && dbaStats.tempdb?.[0] && (
            <DbaPanel title="🗂️ TempDB" alert={(dbaStats.tempdb[0]?.freeSpaceMB || 999) < 500}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Total:</span> <span className="text-gray-700 dark:text-gray-300 font-mono">{(dbaStats.tempdb[0]?.totalSizeMB || 0).toLocaleString()} MB</span></div>
                <div><span className="text-gray-500">Livre:</span> <span className={`font-mono ${(dbaStats.tempdb[0]?.freeSpaceMB || 0) < 500 ? 'text-red-400' : 'text-green-400'}`}>{(dbaStats.tempdb[0]?.freeSpaceMB || 0).toLocaleString()} MB</span></div>
                <div><span className="text-gray-500">User Obj:</span> <span className="text-gray-700 dark:text-gray-300 font-mono">{(dbaStats.tempdb[0]?.userObjectsMB || 0).toLocaleString()} MB</span></div>
                <div><span className="text-gray-500">Version Store:</span> <span className="text-gray-700 dark:text-gray-300 font-mono">{(dbaStats.tempdb[0]?.versionStoreMB || 0).toLocaleString()} MB</span></div>
              </div>
            </DbaPanel>
          )}

          {enabledPanels.has('idleSessions') && dbaStats.idleSessions && (
            <DbaPanel title="😴 Sessões Ociosas c/ Transação" subtitle={`${dbaStats.idleSessions.length} encontradas`} alert={dbaStats.idleSessions.length > 0}>
              {dbaStats.idleSessions.length === 0 ? <p className="text-gray-500 text-xs">Nenhuma</p> : (
                <div className="space-y-1">{dbaStats.idleSessions.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400 font-mono w-8">{s.pid}</span>
                    <span className="text-gray-400">{s.username}</span>
                    <span className="text-red-400 font-mono">{s.idleSec}s idle</span>
                    <span className="text-gray-400 dark:text-gray-600 truncate flex-1 text-[10px]">{s.appName}</span>
                  </div>
                ))}</div>
              )}
            </DbaPanel>
          )}

          {enabledPanels.has('sessionsByApp') && dbaStats.sessionsByApp && (
            <DbaPanel title="📊 Sessões por Aplicação">
              <div className="space-y-1">{(dbaStats.sessionsByApp || []).slice(0, 8).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-blue-400 font-mono w-6 text-right">{s.sessionCount}</span>
                  <span className="text-green-400 font-mono w-4">{s.activeCount}</span>
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{s.appName || '(sem nome)'}</span>
                  <span className="text-gray-400 dark:text-gray-600 text-[10px]">{Math.round(s.totalCpuMs / 1000)}s CPU</span>
                </div>
              ))}</div>
            </DbaPanel>
          )}

          {enabledPanels.has('topConsumers') && dbaStats.topConsumers && (
            <DbaPanel title="🔥 Top Consumers (CPU)">
              <div className="space-y-1">{(dbaStats.topConsumers || []).slice(0, 6).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <span className="text-gray-700 dark:text-gray-300 w-20 truncate">{s.username}</span>
                  <span className="text-amber-400 font-mono">{Math.round(s.cpuMs / 1000)}s</span>
                  <span className="text-gray-400 dark:text-gray-600 text-[10px]">{(s.logicalReads || 0).toLocaleString()} reads</span>
                  <span className="text-gray-400 dark:text-gray-600 truncate flex-1 text-[10px]">{s.appName}</span>
                </div>
              ))}</div>
            </DbaPanel>
          )}

          {enabledPanels.has('deadlocks') && dbaStats.deadlocks && (
            <DbaPanel title="💀 Deadlocks Recentes" alert={dbaStats.deadlocks.length > 0}>
              {dbaStats.deadlocks.length === 0 ? <p className="text-gray-500 text-xs">Nenhum deadlock recente</p> : (
                <div className="space-y-1">{dbaStats.deadlocks.map((d: any, i: number) => (
                  <div key={i} className="text-xs text-red-400">{d.occurredAt}</div>
                ))}</div>
              )}
            </DbaPanel>
          )}
        </div>
      )}
    </div>
  )
}
