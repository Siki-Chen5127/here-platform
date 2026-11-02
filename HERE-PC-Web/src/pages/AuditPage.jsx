import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [pageInfo, setPageInfo] = useState({ total: 0, pages: 1 })

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/audit-logs', {
        params: { page, page_size: pageSize, search: search || undefined },
      })
      setLogs(response.data.items)
      setPageInfo({ total: response.data.total, pages: response.data.pages })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审计日志加载失败')
    }
  }, [page, pageSize, search])

  useEffect(() => {
    let active = true
    api.get('/audit-logs', {
      params: { page, page_size: pageSize, search: search || undefined },
    })
      .then((response) => {
        if (!active) return
        setLogs(response.data.items)
        setPageInfo({ total: response.data.total, pages: response.data.pages })
        if (page > response.data.pages) setPage(response.data.pages)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '审计日志加载失败')
      })
    return () => {
      active = false
    }
  }, [page, pageSize, search])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!logs) return <LoadingState text="正在读取审计日志..." />

  const submitSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const visiblePages = (() => {
    const totalPages = pageInfo.pages
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const candidates = new Set([1, totalPages, page - 1, page, page + 1])
    const sorted = [...candidates].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b)
    const result = []
    sorted.forEach((item, index) => {
      if (index > 0 && item - sorted[index - 1] > 1) result.push(`gap-${item}`)
      result.push(item)
    })
    return result
  })()

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold">审计日志</h2>
          <p className="mt-1 text-xs text-slate-500">记录关键账号与业务操作，共 {pageInfo.total} 条</p>
        </div>
        <form onSubmit={submitSearch} className="flex w-full max-w-md items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索操作、人员、账号或资源"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 text-sm outline-none focus:border-emerald-600"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch} title="清空搜索" aria-label="清空搜索" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={15} />
              </button>
            )}
          </div>
          <button type="submit" className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">搜索</button>
        </form>
      </div>
      <div className="max-h-[calc(100vh-270px)] min-h-[420px] overflow-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
              <th className="px-5 py-3 font-medium">操作者</th>
              <th className="px-5 py-3 font-medium">资源</th>
              <th className="px-5 py-3 font-medium">补充信息</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!logs.length && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-slate-500">
                  {search ? `没有找到与“${search}”相关的审计记录` : '暂无审计日志'}
                </td>
              </tr>
            )}
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>第 {page} / {pageInfo.pages} 页</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
            aria-label="每页条数"
            className="h-8 rounded-md border border-slate-300 bg-white px-2 outline-none focus:border-emerald-600"
          >
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>每页 {size} 条</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="上一页"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft size={17} />
          </button>
          {visiblePages.map((item) => typeof item === 'string' ? (
            <span key={item} className="px-1 text-sm text-slate-400">...</span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`第 ${item} 页`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => setPage(item)}
              className={`h-9 min-w-9 rounded-md border px-2 text-sm ${item === page ? 'border-emerald-700 bg-emerald-700 font-semibold text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            title="下一页"
            aria-label="下一页"
            disabled={page >= pageInfo.pages}
            onClick={() => setPage((current) => Math.min(pageInfo.pages, current + 1))}
            className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
