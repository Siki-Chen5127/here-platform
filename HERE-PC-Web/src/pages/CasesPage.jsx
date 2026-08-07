import { ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

const statusLabels = {
  assigned: '待联系',
  scheduled: '已预约',
  active: '进行中',
  completed: '已结案',
  cancelled: '已取消',
}

export default function CasesPage() {
  const [cases, setCases] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/consultations')
      setCases(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '个案列表加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/consultations')
      .then((response) => {
        if (active) setCases(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '个案列表加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!cases) return <LoadingState text="正在读取授权个案..." />
  if (!cases.length) return <EmptyState title="暂无分配个案" description="后续由心理中心负责人完成接案与分配。" />

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">我的个案</h2>
        <p className="mt-1 text-xs text-slate-500">只展示已分配给当前咨询师的记录</p>
      </div>
      <div className="divide-y divide-slate-100">
        {cases.map((item) => (
          <article key={item.id} className="grid gap-4 px-5 py-5 hover:bg-slate-50 md:grid-cols-[1fr_180px_140px] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{item.student}</h3>
                <span className="text-xs text-slate-400">{item.studentNumber || '无学号'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{[item.college, item.className].filter(Boolean).join(' / ') || '院系信息未完善'}</p>
            </div>
            <div className="text-sm text-slate-600">
              {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString('zh-CN') : '尚未预约'}
            </div>
            <div className="flex items-center gap-2">
              {item.consentGranted ? <ShieldCheck className="text-emerald-600" size={18} /> : <ShieldQuestion className="text-amber-600" size={18} />}
              <span className="text-sm">{statusLabels[item.status] || item.status}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
