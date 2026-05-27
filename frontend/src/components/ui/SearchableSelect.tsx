import { useTranslation } from 'react-i18next'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
  className?: string
  disabled?: boolean
}

export default function SearchableSelect({ options, value, onChange, placeholder, searchable = true, className = '', disabled = false }: SearchableSelectProps) {
  const { t } = useTranslation()
  const effectivePlaceholder = placeholder || t('common.selectOption')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && searchable && inputRef.current) inputRef.current.focus()
  }, [open, searchable])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition
          bg-surface-elevated border-border
          text-text-primary
          hover:border-blue-400 dark:hover:border-blue-500
          focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
      >
        <span className={`truncate ${!selected ? 'text-text-muted' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-lg shadow-xl overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('common.searchPlaceholder')}
                  className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-border rounded-md text-text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">{t('common.noResults')}</p>
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm transition
                    ${option.value === value
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
