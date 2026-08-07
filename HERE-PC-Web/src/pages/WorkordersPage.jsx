import { CheckCircle2, Clock3, LoaderCircle, ShieldAlert, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

const priorityStyles = {
  critical: 'border-rose-500 bg-rose-50 text-rose-700',
  high: 'border-orange-500 bg-orange-50 text-orange-700',
  medium: 'border-amber-400 bg-amber-50 text-amber-700',
  low: 'border-sky-500 bg-sky-50 text-sky-700',
}

const statusLabels = {
  pending: '待处理',
  assigned: '已分配',
  processing: '处理中',
  resolved: '已完成',
}

export default function WorkordersPage({ role }) {
  const [orders, setOrders] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('open')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/workorders')
      setOrders(response.data)
      setSelectedId((current) => (
        response.data.some((item) => item.id === current) ? current : response.data[0]?.id || null
      ))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '工单加载失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredOrders = useMemo(() => {
    if (!orders) return []
    return orders.filter((order) => (
      filter === 'all' || (filter === 'open' ? order.status !== 'resolved' : order.status === 'resolved')
    ))
  }, [filter, orders])

  const selected = orders?.find((order) => order.id === selectedId) || filteredOrders[0] || null

  const resolve = async () => {
    if (!selected || !note.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/workorders/${selected.id}/resolve`, { note: note.trim() })
      setNote('')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '工单处理失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (error && !orders) return <ErrorState message={error} onRetry={load} />
  if (!orders) return <LoadingState text="正在读取权限范围内的工单..." />
  if (!orders.length) {
    return <EmptyState title={role === 'psychologist' ? '暂无转介工单' : '暂无预警工单'} description="当前账号的数据范围内没有工单。" />
  }

  return (
    <div className="grid min-h-[650px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid grid-cols-3 rounded-md bg-slate-100 p-1">
            {[
              ['open', '待处理'],
              ['resolved', '已完成'],
              ['all', '全部'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`h-8 rounded text-xs font-medium ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[590px] overflow-y-auto p-3">
          {filteredOrders.length ? (
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className={`w-full rounded-md border p-4 text-left transition-colors ${selected?.id === order.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded border-l-2 px-2 py-1 text-xs font-semibold ${priorityStyles[order.level] || priorityStyles.medium}`}>
                      {order.levelText}
                    </span>
                    <span className="text-xs text-slate-400">{statusLabels[order.status] || order.status}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-800">{order.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">{order.student}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="当前筛选下暂无工单" />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">工单编号</p>
                  <h2 className="mt-1 font-mono text-lg font-bold">{selected.id}</h2>
                </div>
                <span className={`rounded border-l-2 px-2 py-1 text-xs font-semibold ${priorityStyles[selected.level] || priorityStyles.medium}`}>
                  {selected.levelText}
                </span>
              </div>
            </div>

            <div className="grid gap-5 py-6 md:grid-cols-2">
              <div className="flex gap-3">
                <UserRound className="mt-0.5 text-slate-400" size={19} />
                <div>
                  <p className="text-xs text-slate-500">学生</p>
                  <p className="mt-1 text-sm font-medium">{selected.student}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 text-slate-400" size={19} />
                <div>
                  <p className="text-xs text-slate-500">创建时间</p>
                  <p className="mt-1 text-sm font-medium">{new Date(selected.time).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 py-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert size={18} className="text-amber-600" />
                预警信息
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{selected.details || selected.summary}</p>
              <p className="mt-2 text-xs text-slate-400">来源：{selected.source}</p>
            </div>

            <div className="mt-auto border-t border-slate-200 pt-5">
              {selected.status === 'resolved' ? (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={18} />
                  此工单已完成闭环
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="resolution-note">处置记录</label>
                  <textarea
                    id="resolution-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder={role === 'psychologist' ? '填写联系、评估或转介处理情况' : '填写联系、核实、面谈或转介情况'}
                    className="mt-2 w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
                  <button
                    type="button"
                    disabled={submitting || !note.trim()}
                    onClick={resolve}
                    className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    完成并归档
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="请选择一条工单" />
        )}
      </section>
    </div>
  )
}
