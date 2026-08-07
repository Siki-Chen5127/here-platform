import { Activity, BriefcaseMedical, FileCheck, ShieldAlert, UserRoundCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { roleLabels } from '../config/platforms'
import { api } from '../services/api'

const metricIcons = {
  activeStaff: UserRoundCheck,
  counselors: Users,
  psychologists: BriefcaseMedical,
  auditEvents: FileCheck,
  assignedStudents: Users,
  openAlerts: ShieldAlert,
  pendingOrders: ShieldAlert,
  interventions: Activity,
  activeCases: BriefcaseMedical,
  consentedCases: UserRoundCheck,
  pendingReviews: FileCheck,
  publishedDocuments: FileCheck,
}

export default function DashboardPage({ user }) {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/dashboard')
      setDashboard(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '工作概览加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/dashboard')
      .then((response) => {
        if (active) setDashboard(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '工作概览加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!dashboard) return <LoadingState text="正在读取工作概览..." />

  return (
    <div className="space-y-7">
      <section>
        <h2 className="text-lg font-bold">你好，{user.name}</h2>
        <p className="mt-1 text-sm text-slate-500">当前身份：{roleLabels[user.role]}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => {
          const Icon = metricIcons[metric.key] || Activity
          return (
            <article key={metric.key} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                  <Icon size={19} />
                </div>
              </div>
              <p className="mt-5 text-3xl font-bold">
                {metric.value}
                <span className="ml-1 text-sm font-medium text-slate-400">{metric.unit}</span>
              </p>
            </article>
          )
        })}
      </section>

      <section className="border-t border-slate-200 pt-6">
        <h3 className="font-semibold">数据范围说明</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {user.role === 'admin'
            ? '这里只显示系统运行和账号统计，不展示学生预警、咨询记录或干预内容。'
            : user.role === 'center_director'
              ? '这里只显示中心运行汇总和资料审核数量，不展示咨询谈话原文或完整个案记录。'
            : user.role === 'counselor'
              ? '统计仅包含分配给你的学生和你本人创建的干预记录。'
              : '统计仅包含分配给你的授权个案、转介工单和服务记录。'}
        </p>
      </section>
    </div>
  )
}
