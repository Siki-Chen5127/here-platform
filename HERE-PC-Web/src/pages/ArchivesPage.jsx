import { CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

export default function ArchivesPage({ role }) {
  const [archives, setArchives] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/intervention-archives')
      setArchives(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '档案加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/intervention-archives')
      .then((response) => {
        if (active) setArchives(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '档案加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!archives) return <LoadingState text="正在读取已归档记录..." />
  if (!archives.length) {
    return <EmptyState title="暂无归档记录" description="完成工单后，处置记录会自动进入这里。" />
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">{role === 'psychologist' ? '服务档案' : '干预档案'}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {role === 'counselor' ? '展示负责学生已经完成闭环的处置记录' : '仅展示已经完成闭环的服务记录'}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {archives.map((archive) => (
          <article key={archive.id} className="grid gap-4 px-5 py-5 md:grid-cols-[48px_1fr_180px] md:items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">{archive.student}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{archive.note || '未填写补充说明'}</p>
              <p className="mt-2 font-mono text-xs text-slate-400">工单 {archive.workOrderNumber}</p>
              {role !== 'psychologist' && <p className="mt-1 text-xs text-slate-400">处置人：{archive.staff}</p>}
            </div>
            <time className="text-xs text-slate-500">{new Date(archive.createdAt).toLocaleString('zh-CN')}</time>
          </article>
        ))}
      </div>
    </div>
  )
}
