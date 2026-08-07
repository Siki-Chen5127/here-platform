import { useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import { platformConfig, roleLabels } from './config/platforms'
import ArchivesPage from './pages/ArchivesPage'
import AuditPage from './pages/AuditPage'
import AdminKnowledgePage from './pages/AdminKnowledgePage'
import CasesPage from './pages/CasesPage'
import DashboardPage from './pages/DashboardPage'
import KnowledgeReviewPage from './pages/KnowledgeReviewPage'
import KnowledgeSubmissionsPage from './pages/KnowledgeSubmissionsPage'
import LoginPage from './pages/LoginPage'
import PublishedKnowledgePage from './pages/PublishedKnowledgePage'
import StaffPage from './pages/StaffPage'
import StaffApplicationsPage from './pages/StaffApplicationsPage'
import StaffProfilePage from './pages/StaffProfilePage'
import StudentsPage from './pages/StudentsPage'
import WorkordersPage from './pages/WorkordersPage'
import { sessionStore } from './services/api'

function UnsupportedPlatform({ user, onLogout }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-bold">{roleLabels[user.role] || user.role}工作台尚未开放</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          角色已经保留在权限模型中，页面与业务流程会在后续阶段接入。
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}

export default function AppWorkspace() {
  const [currentUser, setCurrentUser] = useState(() => sessionStore.getUser())
  const [currentView, setCurrentView] = useState('dashboard')

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null)
      setCurrentView('dashboard')
    }
    window.addEventListener('here:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('here:unauthorized', handleUnauthorized)
  }, [])

  const logout = () => {
    sessionStore.clear()
    setCurrentUser(null)
    setCurrentView('dashboard')
  }

  const login = (user) => {
    setCurrentUser(user)
    setCurrentView('dashboard')
  }

  if (!currentUser) return <LoginPage onLogin={login} />
  if (currentUser.accountStatus && currentUser.accountStatus !== 'active') {
    return <StaffProfilePage standalone onLogout={logout} />
  }
  if (!platformConfig[currentUser.role]) {
    return <UnsupportedPlatform user={currentUser} onLogout={logout} />
  }

  const renderCurrentPage = () => {
    switch (currentView) {
      case 'students':
        return <StudentsPage />
      case 'cases':
        return <CasesPage />
      case 'workorders':
        return <WorkordersPage role={currentUser.role} />
      case 'archives':
        return <ArchivesPage role={currentUser.role} />
      case 'staff':
        return <StaffPage currentUser={currentUser} />
      case 'applications':
        return <StaffApplicationsPage />
      case 'profile':
        return <StaffProfilePage />
      case 'submissions':
        return <KnowledgeSubmissionsPage role={currentUser.role} />
      case 'review':
        return <KnowledgeReviewPage />
      case 'knowledge':
        return currentUser.role === 'admin' ? <AdminKnowledgePage /> : <PublishedKnowledgePage />
      case 'audit':
        return <AuditPage />
      default:
        return <DashboardPage user={currentUser} />
    }
  }

  return (
    <AppShell
      user={currentUser}
      currentView={currentView}
      onNavigate={setCurrentView}
      onLogout={logout}
    >
      {renderCurrentPage()}
    </AppShell>
  )
}
