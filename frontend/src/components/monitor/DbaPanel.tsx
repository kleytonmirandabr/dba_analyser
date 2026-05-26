interface Props {
  title: string
  subtitle?: string
  alert?: boolean
  children: React.ReactNode
}

export default function DbaPanel({ title, subtitle, alert, children }: Props) {
  return (
    <div className={`p-4 bg-white dark:bg-gray-900 border rounded-xl ${alert ? 'border-red-300 dark:border-red-900/50' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
        {alert && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
      </div>
      {children}
    </div>
  )
}
