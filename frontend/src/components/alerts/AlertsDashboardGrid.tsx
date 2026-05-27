import { useMemo, useRef, useState, useEffect } from 'react'
import { GridLayout } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import AlertWidget from './AlertWidget'
import { useAlertDashboardLayout, LayoutPreset } from '../../hooks/useAlertDashboardLayout'
import { LayoutGrid, Grid, Maximize2, Minimize2, RotateCcw, Pencil, Lock } from 'lucide-react'

interface AlertDashboard {
  id: string; name: string; severity: string; currentStatus: string;
  connectionName: string; databaseName: string; evaluationType: string;
  lastCheckedAt: string; lastMessage: string;
  stats: { totalChecks: number; triggeredCount: number; errorCount: number; okCount: number; avgExecutionMs: number };
  timeline: { time: string; ok: number; triggered: number; error: number }[];
  lastValues: { time: string; value: number | null; status: string }[];
}

interface Props {
  data: AlertDashboard[]
  filter?: { severity?: string; status?: string; connection?: string }
}

const PRESETS: { value: LayoutPreset; label: string; icon: any }[] = [
  { value: 'overview', label: 'Visão Geral', icon: Grid },
  { value: 'compact', label: 'Compacto', icon: Minimize2 },
  { value: 'by-severity', label: 'Por Severidade', icon: LayoutGrid },
  { value: 'critical-only', label: 'Só Críticos', icon: Maximize2 },
]

export default function AlertsDashboardGrid({ data, filter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    obs.observe(el)
    setWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const filtered = useMemo(() => {
    let items = data
    if (filter?.severity) items = items.filter(d => d.severity === filter.severity)
    if (filter?.status) items = items.filter(d => d.currentStatus === filter.status)
    if (filter?.connection) items = items.filter(d => d.connectionName.includes(filter.connection!))
    return items
  }, [data, filter])

  const alertIds = useMemo(() => filtered.map(d => d.id), [filtered])
  const { layout, preset, setLayout, setWidgetConfig, applyPreset, getConfig } = useAlertDashboardLayout(alertIds)

  return (
    <div ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              editMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-surface-elevated text-text-secondary border border-border hover:border-blue-500/50'
            }`}>
            {editMode ? <><Pencil className="w-3.5 h-3.5" /> Editando</> : <><Lock className="w-3.5 h-3.5" /> Editar Layout</>}
          </button>
          {editMode && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[10px] text-text-tertiary mr-1">Preset:</span>
              {PRESETS.map(p => (
                <button key={p.value} onClick={() => applyPreset(p.value)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition ${
                    preset === p.value ? 'bg-blue-600 text-white' : 'text-text-secondary hover:bg-surface-elevated border border-border/50'
                  }`}>
                  <p.icon className="w-3 h-3" /> {p.label}
                </button>
              ))}
              <button onClick={() => applyPreset('overview')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-tertiary hover:text-text-primary rounded transition ml-2" title="Reset">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <p className="text-text-secondary text-sm">Nenhum alerta encontrado.</p>
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={80}
          width={width}
          onLayoutChange={(newLayout: Layout[]) => { if (editMode) setLayout(newLayout) }}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          margin={[12, 12] as [number, number]}
        >
          {filtered.map(d => (
            <div key={d.id} className="h-full">
              <AlertWidget
                  id={d.id}
                  name={d.name}
                  severity={d.severity}
                  currentStatus={d.currentStatus}
                  connectionName={d.connectionName}
                  databaseName={d.databaseName}
                  lastCheckedAt={d.lastCheckedAt}
                  lastMessage={d.lastMessage}
                  stats={d.stats}
                  timeline={d.timeline}
                  lastValues={d.lastValues}
                  config={getConfig(d.id)}
                  onConfigChange={setWidgetConfig}
                  editMode={editMode}
                />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  )
}
