import { CheckCircle2, Download, LoaderCircle, RotateCcw, Send, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import {
  graphStatusLabels,
  knowledgeDomainLabels,
  knowledgeStatusLabels,
  knowledgeStatusStyles,
} from '../config/knowledge'
import { api, downloadKnowledgeFile } from '../services/api'

const filters = [
  ['submitted', '待审核'],
  ['approved', '待发布'],
  ['published', '已发布'],
  ['all', '全部'],
]

export default function KnowledgeReviewPage({ onChanged = () => {} }) {
  const [documents, setDocuments] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('submitted')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/knowledge/submissions')
      setDocuments(response.data)
      setSelectedId((current) => (
        response.data.some((item) => item.id === current) ? current : response.data[0]?.id || null
      ))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审核资料加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/knowledge/submissions')
      .then((response) => {
        if (!active) return
        setDocuments(response.data)
        setSelectedId(response.data[0]?.id || null)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '审核资料加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!documents) return []
    return documents.filter((document) => filter === 'all' || document.status === filter)
  }, [documents, filter])

  const selected = documents?.find((document) => document.id === selectedId)
    || filtered[0]
    || null

  const review = async (action) => {
    if (!selected) return
    if (action !== 'approve' && !note.trim()) {
      setError('退回或拒绝时必须填写审核意见')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/knowledge/submissions/${selected.id}/review`, {
        action,
        note: note.trim() || null,
      })
      setNote('')
      await load()
      onChanged()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审核操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const publish = async () => {
    if (!selected) return
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/knowledge/submissions/${selected.id}/publish`)
      await load()
      onChanged()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const download = async () => {
    if (!selected) return
    setError('')
    try {
      await downloadKnowledgeFile(selected)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '原始文件下载失败')
    }
  }

  if (error && !documents) return <ErrorState message={error} onRetry={load} />
  if (!documents) return <LoadingState text="正在读取待审核资料..." />

  return (
    <div className="grid min-h-[650px] gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid grid-cols-4 rounded-md bg-slate-100 p-1">
            {filters.map(([value, label]) => (
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
          {filtered.length ? (
            <div className="space-y-2">
              {filtered.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(document.id)
                    setNote('')
                    setError('')
                  }}
                  className={`w-full rounded-md border p-4 text-left ${selected?.id === document.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold">{document.name}</p>
                    <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${knowledgeStatusStyles[document.status] || 'bg-slate-100 text-slate-600'}`}>
                      {knowledgeStatusLabels[document.status] || document.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{document.uploader} · {knowledgeDomainLabels[document.domain] || document.domain}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="当前分类暂无资料" />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs text-slate-500">{knowledgeDomainLabels[selected.domain] || selected.domain} · {selected.category || '未分类'}</p>
                <h2 className="mt-1 text-xl font-bold">{selected.name}</h2>
                <p className="mt-2 text-sm text-slate-500">提交人：{selected.uploader}</p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${knowledgeStatusStyles[selected.status] || 'bg-slate-100 text-slate-600'}`}>
                {knowledgeStatusLabels[selected.status] || selected.status}
              </span>
            </div>

            <div className="grid gap-5 py-6 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">资料说明</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selected.description || '提交人未填写说明'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">来源链接</p>
                {selected.sourceUrl ? (
                  <a className="mt-2 block break-all text-sm text-emerald-700 hover:underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                    {selected.sourceUrl}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">未提供</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 py-5">
              <button
                type="button"
                disabled={!selected.fileAvailable}
                onClick={download}
                className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={18} />
                下载原始文件审核
              </button>
            </div>

            {selected.reviewNote && (
              <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
                上次审核意见：{selected.reviewNote}
              </div>
            )}

            <div className="mt-auto border-t border-slate-200 pt-5">
              {selected.status === 'submitted' && (
                <>
                  <label className="text-sm font-medium text-slate-700" htmlFor="review-note">审核意见</label>
                  <textarea
                    id="review-note"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="通过时可选，退回或拒绝时必填"
                    className="mt-2 w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => review('approve')}
                      className="flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      审核通过
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !note.trim()}
                      onClick={() => review('request_changes')}
                      className="flex h-10 items-center gap-2 rounded-md border border-orange-300 px-4 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-40"
                    >
                      <RotateCcw size={18} />
                      退回修改
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !note.trim()}
                      onClick={() => review('reject')}
                      className="flex h-10 items-center gap-2 rounded-md border border-rose-300 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    >
                      <XCircle size={18} />
                      拒绝
                    </button>
                  </div>
                </>
              )}

              {selected.status === 'approved' && (
                <div>
                  <p className="text-sm text-slate-600">资料已经通过审核，发布后所有工作人员均可查阅。</p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={publish}
                    className="mt-3 flex h-10 items-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
                    发布并加入图谱处理队列
                  </button>
                </div>
              )}

              {selected.status === 'published' && (
                <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  已发布，{graphStatusLabels[selected.graphStatus] || selected.graphStatus}。
                </div>
              )}

              {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>
          </div>
        ) : (
          <EmptyState title="请选择一份资料" />
        )}
      </section>
    </div>
  )
}
