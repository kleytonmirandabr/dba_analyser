import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dba-sidebar-collapsed') === 'true')

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('dba-sidebar-collapsed', String(next))
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 transition-colors">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header sidebarCollapsed={collapsed} onToggleSidebar={toggle} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
