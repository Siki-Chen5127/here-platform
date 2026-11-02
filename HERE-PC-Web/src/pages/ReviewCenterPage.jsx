import { FileCheck2, UserRoundCheck } from 'lucide-react'
import { useState } from 'react'
import KnowledgeReviewPage from './KnowledgeReviewPage'
import StaffApplicationsPage from './StaffApplicationsPage'

export default function ReviewCenterPage({ counts, onRefresh }) {
  const [tab, setTab] = useState('staff')
  const tabs = [
    { id: 'staff', label: '入驻审核', count: counts.staffApplications, icon: UserRoundCheck },
    { id: 'knowledge', label: '资料审核', count: counts.knowledgeSubmissions, icon: FileCheck2 },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id)
                onRefresh()
              }}
              className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${tab === item.id ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Icon size={18} />
              {item.label}
              {item.count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                  {item.count > 99 ? '99+' : item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {tab === 'staff'
        ? <StaffApplicationsPage onChanged={onRefresh} />
        : <KnowledgeReviewPage onChanged={onRefresh} />}
    </div>
  )
}
