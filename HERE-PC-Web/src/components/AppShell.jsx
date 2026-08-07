import { HeartPulse, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { platformConfig, reviewNavigation, roleLabels } from '../config/platforms'

export default function AppShell({ user, currentView, onNavigate, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const platform = platformConfig[user.role]
  const hasReviewNavigation = platform.navigation.some((item) => item.id === 'review')
  const navigation = user.reviewScopes?.length && !hasReviewNavigation
    ? [...platform.navigation.slice(0, 1), reviewNavigation, ...platform.navigation.slice(1)]
    : platform.navigation
  const currentItem = navigation.find((item) => item.id === currentView)

  const navigate = (view) => {
    onNavigate(view)
    setMobileOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭导航"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <HeartPulse size={22} />
          </div>
          <div className="ml-3 min-w-0">
            <p className="text-lg font-bold">HERE</p>
            <p className="truncate text-xs text-slate-500">{platform.title}</p>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            className="ml-auto text-slate-500 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = currentView === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Icon size={19} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
              {user.name?.slice(0, 1) || '用'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabels[user.role]}</p>
            </div>
            <button
              type="button"
              title="退出登录"
              aria-label="退出登录"
              className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-20 items-center border-b border-slate-200 bg-white px-5 lg:px-8">
          <button
            type="button"
            aria-label="打开导航"
            className="mr-3 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div>
            <h1 className="text-xl font-bold">{currentItem?.label || platform.title}</h1>
            <p className="mt-1 text-xs text-slate-500">{platform.description}</p>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
