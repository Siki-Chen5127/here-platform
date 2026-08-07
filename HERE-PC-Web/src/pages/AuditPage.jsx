import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

const fallbackActionLabels = {
  'staff.create': '创建工作人员',
  'staff.activate': '启用工作人员',
  'staff.deactivate': '停用工作人员',
  'work_order.resolve': '完成工单',
}

export default function AuditPage() {
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/audit-logs')
      setLogs(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审计日志加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/audit-logs')
      .then((response) => {
        if (active) setLogs(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '审计日志加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!logs) return <LoadingState text="正在读取审计日志..." />
  if (!logs.length) return <EmptyState title="暂无审计日志" />

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">审计日志</h2>
        <p className="mt-1 text-xs text-slate-500">记录关键账号与业务操作，最多显示最近 200 条</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
              <th className="px-5 py-3 font-medium">操作者</th>
              <th className="px-5 py-3 font-medium">资源</th>
              <th className="px-5 py-3 font-medium">补充信息</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                <td className="px-5 py-4 font-medium">{log.actionLabel || fallbackActionLabels[log.action] || log.action}</td>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-700">{log.actorName || '未知操作者'}</p>
                  <p className="mt-1 text-xs text-slate-500">{log.actorAccount || log.actorId}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-slate-700">{log.resourceName || log.resourceId || '-'}</p>
                  <p className="mt-1 text-xs text-slate-500">{log.resourceTypeLabel || log.resourceType}</p>
                </td>
                <td className="px-5 py-4 text-slate-500">{log.detail || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
