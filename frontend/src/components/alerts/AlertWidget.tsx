import { useState, useMemo } from 'react'
import { Settings, Database, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

export type ChartType = 'area' | 'line' | 'bar' | 'gauge' | 'stat'
export type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d'

export interface WidgetConfig {
  chartType: ChartType
  period: TimePeriod
  showLegend: boolean
}

interface AlertWidgetProps {
  id: string
  name: string
  severity: string
  currentStatus: string
  connectionName: string
  databaseName: string
  lastCheckedAt: string
  lastMessage: string
  stats: { totalChecks: number; triggeredCount: number; errorCount: number; okCount: number; avgExecutionMs: number }
  timeline: { time: string; ok: number; triggered: number; error: number }[]
  lastValues: { time: string; value: number | null; status: string }[]
  config: WidgetConfig
  onConfigChange: (id: string, config: WidgetConfig) => void
  compact?: boolean
  editMode?: boolean
}

function timeSince(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return seconds + 's'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'min'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return hours + 'h' + (mins > 0 ? mins + 'min' : '')
  return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h'
}

export default function AlertWidget({ id, name, severity, currentStatus, connectionName, databaseName, lastCheckedAt, lastMessage, stats, timeline, lastValues, config, onConfigChange, compact, editMode }: AlertWidgetProps) {
  // Parse lastMessage for multi-connection details
  const details = useMemo(() => {
    try {
      const parsed = JSON.parse(lastMessage || '{}')
      if (parsed.details) return parsed.details as { connName: string; database: string; status: string; message: string }[]
    } catch {}
    return null
  }, [lastMessage])

  const problemDbs = details?.filter(d => d.status === 'triggered') || []
  const errorDbs = details?.filter(d => d.status === 'error') || []
  const okDbs = details?.filter(d => d.status === 'ok') || []
  const totalDbs = details?.length || 1

  // Find first triggered time from timeline to calculate persistence
  const firstTriggered = useMemo(() => {
    // Find earliest consecutive triggered from the end of timeline
    const reversed = [...timeline].reverse()
    let firstTime = ''
    for (const t of reversed) {
      if (t.triggered > 0) firstTime = t.time
      else break
    }
    return firstTime
  }, [timeline])

  const severityColors = severity === 'critical' ? 'border-red-500/40 bg-red-50 dark:bg-red-950/30' :
    severity === 'warning' ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/30' :
    'border-blue-500/40 bg-blue-50 dark:bg-blue-950/30'

  return (
    <div className={`h-full flex flex-col border rounded-xl overflow-hidden shadow-sm ${severityColors}`}>
      {/* Header */}
      <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center justify-between px-3 py-2 border-b border-inherit bg-white/50 dark:bg-gray-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${
            currentStatus === 'ok' ? 'bg-green-500' :
            currentStatus === 'triggered' ? 'bg-amber-500 animate-pulse' :
            'bg-red-500 animate-pulse'
          }`} />
          <span className="text-xs font-bold text-text-primary truncate">{name}</span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
            severity === 'critical' ? 'bg-red-200 dark:bg-red-900/60 text-red-700 dark:text-red-300' :
            severity === 'warning' ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' :
            'bg-blue-200 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
          }`}>{severity}</span>
        </div>
        {editMode && (
          <button className="p-1 text-text-tertiary hover:text-text-primary rounded"><Settings className="w-3.5 h-3.5" /></button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 p-3 overflow-y-auto">
        {details && details.length > 1 ? (
          /* Multi-connection alert: show databases */
          <div className="space-y-2">
            {/* Summary */}
            <div className="flex items-center gap-3 text-xs">
              {problemDbs.length > 0 && (
                <span className="text-amber-700 dark:text-amber-400 font-bold">
                  <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                  {problemDbs.length} de {totalDbs} bancos com problema
                </span>
              )}
              {currentStatus === 'ok' && (
                <span className="text-green-700 dark:text-green-400 font-bold">
                  <CheckCircle className="w-3 h-3 inline mr-0.5" />
                  Todos OK ({totalDbs})
                </span>
              )}
            </div>

            {/* Problem databases */}
            {problemDbs.length > 0 && (
              <div className="space-y-1">
                {problemDbs.slice(0, 8).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 bg-amber-100/60 dark:bg-amber-900/30 rounded text-[10px]">
                    <Database className="w-3 h-3 text-amber-600" />
                    <span className="font-medium text-text-primary">{d.database || d.connName}</span>
                    <span className="text-text-tertiary ml-auto truncate max-w-[120px]">{d.message?.replace(/^\[[^\]]+\]\s*/, '')}</span>
                  </div>
                ))}
                {problemDbs.length > 8 && (
                  <p className="text-[9px] text-text-tertiary px-2">+{problemDbs.length - 8} mais...</p>
                )}
              </div>
            )}

            {/* Error databases */}
            {errorDbs.length > 0 && (
              <div className="space-y-1 mt-1">
                {errorDbs.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 bg-red-100/60 dark:bg-red-900/30 rounded text-[10px]">
                    <Database className="w-3 h-3 text-red-600" />
                    <span className="font-medium text-text-primary">{d.database || d.connName}</span>
                    <span className="text-red-600 text-[9px] ml-auto">ERRO</span>
                  </div>
                ))}
              </div>
            )}

            {/* OK databases (collapsed) */}
            {okDbs.length > 0 && (
              <p className="text-[9px] text-green-700 dark:text-green-400 px-2 mt-1">
                ✅ {okDbs.length} banco{okDbs.length > 1 ? 's' : ''} OK: {okDbs.slice(0, 5).map(d => d.database || d.connName).join(', ')}{okDbs.length > 5 ? '...' : ''}
              </p>
            )}
          </div>
        ) : (
          /* Single connection alert */
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Database className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="font-medium text-text-primary">{databaseName || connectionName}</span>
            </div>
            {lastMessage && !lastMessage.startsWith('{') && (
              <p className="text-[10px] text-text-secondary bg-surface rounded px-2 py-1.5">{lastMessage}</p>
            )}
            {lastValues.length > 0 && (
              <div className="text-xs">
                <span className="text-text-tertiary">Último valor: </span>
                <span className="font-bold text-text-primary">{lastValues[lastValues.length - 1]?.value}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with persistence info */}
      <div className="px-3 py-1.5 border-t border-inherit flex items-center justify-between text-[9px] text-text-tertiary bg-white/30 dark:bg-gray-900/30">
        <div className="flex items-center gap-2">
          <span>{connectionName}</span>
          {currentStatus === 'triggered' && firstTriggered && (
            <>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                Problema há {timeSince(firstTriggered)}
              </span>
            </>
          )}
        </div>
        <span>{lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString().slice(0, 5) : '—'}</span>
      </div>
    </div>
  )
}
