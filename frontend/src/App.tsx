import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ExplorerPage from './pages/ExplorerPage'
import MonitorPage from './pages/MonitorPage'
import QueryPage from './pages/QueryPage'
import ExecutionPage from './pages/ExecutionPage'
import ComparePage from './pages/ComparePage'
import AuditPage from './pages/AuditPage'
import LoginPage from './pages/LoginPage'
import VPNSetupWizard from './components/wizard/VPNSetupWizard'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, loadUser, isLoading } = useAuthStore()
  const [showWizard, setShowWizard] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadUser().finally(() => setChecked(true))
    } else {
      setChecked(true)
    }
  }, [])

  if (!checked) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="query" element={<QueryPage />} />
          <Route path="monitor" element={<MonitorPage />} />
          <Route path="executions" element={<ExecutionPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showWizard && <VPNSetupWizard onComplete={() => setShowWizard(false)} />}
    </BrowserRouter>
  )
}
