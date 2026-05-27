import { useState, useCallback } from 'react'
import { Layout } from 'react-grid-layout'
import { ChartType, TimePeriod, WidgetConfig } from '../components/alerts/AlertWidget'

const STORAGE_KEY = 'dba-alert-dashboard-layout'
const CONFIG_KEY = 'dba-alert-widget-configs'

export type LayoutPreset = 'overview' | 'by-severity' | 'critical-only' | 'compact'

interface DashboardState {
  layout: Layout[]
  configs: Record<string, WidgetConfig>
  preset: LayoutPreset | 'custom'
}

const DEFAULT_CONFIG: WidgetConfig = { chartType: 'area', period: '24h', showLegend: true }

function generateLayout(ids: string[], preset: LayoutPreset): Layout[] {
  const cols = preset === 'compact' ? 4 : preset === 'overview' ? 3 : 2
  const h = preset === 'compact' ? 2 : 3

  return ids.map((id, i) => ({
    i: id,
    x: (i % cols) * (12 / cols),
    y: Math.floor(i / cols) * h,
    w: 12 / cols,
    h,
    minW: 2,
    minH: 2,
    maxH: 6,
  }))
}

export function useAlertDashboardLayout(alertIds: string[]) {
  const [state, setState] = useState<DashboardState>(() => {
    try {
      const savedLayout = localStorage.getItem(STORAGE_KEY)
      const savedConfigs = localStorage.getItem(CONFIG_KEY)
      if (savedLayout && savedConfigs) {
        return {
          layout: JSON.parse(savedLayout),
          configs: JSON.parse(savedConfigs),
          preset: 'custom'
        }
      }
    } catch {}
    return {
      layout: generateLayout(alertIds, 'overview'),
      configs: Object.fromEntries(alertIds.map(id => [id, DEFAULT_CONFIG])),
      preset: 'overview'
    }
  })

  // Sync layout when alertIds change (new alerts added)
  const syncedLayout = state.layout.filter(l => alertIds.includes(l.i))
  const newIds = alertIds.filter(id => !state.layout.find(l => l.i === id))
  if (newIds.length > 0) {
    const maxY = syncedLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    newIds.forEach((id, i) => {
      syncedLayout.push({ i: id, x: (i % 3) * 4, y: maxY, w: 4, h: 3, minW: 2, minH: 2, maxH: 6 })
    })
  }

  const setLayout = useCallback((layout: Layout[]) => {
    setState(s => ({ ...s, layout, preset: 'custom' }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [])

  const setWidgetConfig = useCallback((id: string, config: WidgetConfig) => {
    setState(s => {
      const configs = { ...s.configs, [id]: config }
      localStorage.setItem(CONFIG_KEY, JSON.stringify(configs))
      return { ...s, configs }
    })
  }, [])

  const applyPreset = useCallback((preset: LayoutPreset) => {
    const layout = generateLayout(alertIds, preset)
    const configs = Object.fromEntries(alertIds.map(id => [id, {
      ...DEFAULT_CONFIG,
      chartType: preset === 'compact' ? 'stat' as ChartType : preset === 'critical-only' ? 'gauge' as ChartType : 'area' as ChartType
    }]))
    setState({ layout, configs, preset })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    localStorage.setItem(CONFIG_KEY, JSON.stringify(configs))
  }, [alertIds])

  const getConfig = useCallback((id: string): WidgetConfig => {
    return state.configs[id] || DEFAULT_CONFIG
  }, [state.configs])

  return {
    layout: syncedLayout.length > 0 ? syncedLayout : state.layout,
    preset: state.preset,
    setLayout,
    setWidgetConfig,
    applyPreset,
    getConfig,
  }
}
