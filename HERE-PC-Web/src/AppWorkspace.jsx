import { useCallback, useEffect, useState } from 'react'
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
import ReviewCenterPage from './pages/ReviewCenterPage'
import StaffPage from './pages/StaffPage'
import StaffApplicationsPage from './pages/StaffApplicationsPage'
import StaffProfilePage from './pages/StaffProfilePage'
import StudentsPage from './pages/StudentsPage'
import WorkordersPage from './pages/WorkordersPage'
import { api, sessionStore } from './services/api'

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
  const [reviewCounts, setReviewCounts] = useState({ staffApplications: 0, knowledgeSubmissions: 0, total: 0 })
  const [pendingKnowledgeReviews, setPendingKnowledgeReviews] = useState(0)
  const [pendingWorkorders, setPendingWorkorders] = useState(0)

  useEffect(() => {
    const roleName = currentUser ? (roleLabels[currentUser.role] || currentUser.role) : '工作人员登录'
    document.title = `${roleName} | HERE`
  }, [currentUser])

  const loadReviewCounts = useCallback(async () => {
    if (currentUser?.role !== 'admin') return
    try {
      const response = await api.get('/admin/review-summary')
      setReviewCounts(response.data)
    } catch {
      // Badge refresh failure must not block the workspace.
    }
  }, [currentUser?.role])

  const loadKnowledgeReviewCount = useCallback(async () => {
    if (currentUser?.role !== 'center_director') return
    try {
      const response = await api.get('/knowledge/submissions')
      setPendingKnowledgeReviews(
        response.data.filter((document) => document.status === 'submitted').length,
      )
    } catch {
      // Badge refresh failure must not block the workspace.
    }
  }, [currentUser?.role])

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null)
      setCurrentView('dashboard')
    }
    window.addEventListener('here:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('here:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (currentUser?.role !== 'admin') return undefined
    let active = true
    const refresh = () => {
      api.get('/admin/review-summary')
        .then((response) => {
          if (active) setReviewCounts(response.data)
        })
        .catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [currentUser?.role])

  useEffect(() => {
    if (currentUser?.role !== 'center_director') {
      setPendingKnowledgeReviews(0)
      return undefined
    }

    loadKnowledgeReviewCount()
    const timer = window.setInterval(loadKnowledgeReviewCount, 30000)
    window.addEventListener('focus', loadKnowledgeReviewCount)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', loadKnowledgeReviewCount)
    }
  }, [currentUser?.role, loadKnowledgeReviewCount])

  useEffect(() => {
    if (!['counselor', 'psychologist'].includes(currentUser?.role)) {
      setPendingWorkorders(0)
      return undefined
    }

    let active = true
    const refresh = () => {
      api.get('/workorders/summary')
        .then((response) => {
          if (active) setPendingWorkorders(response.data.pending || 0)
        })
        .catch(() => {})
    }

    refresh()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('here:workorders-changed', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('here:workorders-changed', refresh)
    }
  }, [currentUser?.role])

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
      case 'reviews':
        return <ReviewCenterPage counts={reviewCounts} onRefresh={loadReviewCounts} />
      case 'profile':
        return <StaffProfilePage onLogout={logout} />
      case 'submissions':
        return <KnowledgeSubmissionsPage role={currentUser.role} />
      case 'review':
        return <KnowledgeReviewPage onChanged={loadKnowledgeReviewCount} />
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
      badges={{ review: pendingKnowledgeReviews, reviews: reviewCounts.total, workorders: pendingWorkorders }}
    >
      {renderCurrentPage()}
    </AppShell>
  )
}
