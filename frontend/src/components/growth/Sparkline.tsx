export default function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-gray-700 text-xs">—</span>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72, h = 24
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const trending = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={trending ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────


export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ─── Rule Modal ──────────────────────────────────────────────────────────────
