import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ExplorerPage from './pages/ExplorerPage'
import MonitorPage from './pages/MonitorPage'
import DiagnosticsPage from './pages/DiagnosticsPage'
import QueryPage from './pages/QueryPage'
import ExecutionPage from './pages/ExecutionPage'
import ComparePage from './pages/ComparePage'
import AuditPage from './pages/AuditPage'
import SettingsPage from './pages/SettingsPage'
import VPNPage from './pages/VPNPage'
import HealthPage from './pages/HealthPage'
import AlertsPage from './pages/AlertsPage'
import AvailabilityPage from './pages/AvailabilityPage'
import GrowthPage from './pages/GrowthPage'
import AdvisorPage from './pages/AdvisorPage'
import ReportsPage from './pages/ReportsPage'
import ERDiagramPage from './pages/ERDiagramPage'
import BackupPage from './pages/BackupPage'
import SchemaVersionPage from './pages/SchemaVersionPage'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'
import ProfilesPage from './pages/ProfilesPage'
import FeaturesPage from './pages/FeaturesPage'
import UsersPage from './pages/UsersPage'
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
          <Route path="er-diagram" element={<ERDiagramPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
            <Route path="monitor" element={<MonitorPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="growth" element={<GrowthPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="executions" element={<ExecutionPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="schema-versions" element={<SchemaVersionPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="vpn" element={<VPNPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showWizard && <VPNSetupWizard onComplete={() => setShowWizard(false)} />}
    </BrowserRouter>
  )
}
