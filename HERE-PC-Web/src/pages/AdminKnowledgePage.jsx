import {
  Archive,
  Download,
  FilePenLine,
  FileUp,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import {
  graphStatusLabels,
  knowledgeDomainLabels,
  knowledgeStatusLabels,
  knowledgeStatusStyles,
} from '../config/knowledge'
import { api, downloadKnowledgeFile } from '../services/api'

const emptyForm = {
  name: '',
  category: '',
  domain: 'psychology',
  description: '',
  sourceUrl: '',
}

export default function AdminKnowledgePage() {
  const [documents, setDocuments] = useState(null)
  const [filter, setFilter] = useState('published')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/knowledge/admin/documents')
      setDocuments(response.data)
      setSelectedIds([])
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '知识库加载失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleDocuments = useMemo(() => (
    documents?.filter((document) => filter === 'all' || document.status === filter) || []
  ), [documents, filter])
  const selectedDocuments = useMemo(() => (
    documents?.filter((document) => selectedIds.includes(document.id)) || []
  ), [documents, selectedIds])
  const allVisibleSelected = visibleDocuments.length > 0
    && visibleDocuments.every((document) => selectedIds.includes(document.id))
  const selectedPublished = selectedDocuments.length > 0
    && selectedDocuments.every((document) => document.status === 'published')
  const selectedArchived = selectedDocuments.length > 0
    && selectedDocuments.every((document) => document.status === 'archived')

  const toggleDocument = (documentId) => {
    setSelectedIds((current) => (
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    ))
  }

  const toggleAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleDocuments.map((document) => document.id))
  }

  const resetForm = () => {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
  }

  const startEdit = (document) => {
    setEditing(document)
    setForm({
      name: document.name,
      category: document.category || '',
      domain: document.domain || 'psychology',
      description: document.description || '',
      sourceUrl: document.sourceUrl || '',
    })
    setFile(null)
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editing && !file) {
      setError('导入资料时必须选择文件')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (editing) {
        await api.patch(`/knowledge/admin/documents/${editing.id}`, {
          name: form.name,
          category: form.category,
          domain: form.domain,
          description: form.description || null,
          source_url: form.sourceUrl || null,
        })
        if (file) {
          const body = new FormData()
          body.append('file', file)
          await api.put(`/knowledge/admin/documents/${editing.id}/file`, body)
        }
      } else {
        const body = new FormData()
        body.append('name', form.name)
        body.append('category', form.category)
        body.append('domain', form.domain)
        body.append('description', form.description)
        body.append('source_url', form.sourceUrl)
        body.append('file', file)
        await api.post('/knowledge/admin/documents', body)
      }
      resetForm()
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (document, action) => {
    setError('')
    try {
      if (action === 'delete') {
        await api.delete(`/knowledge/admin/documents/${document.id}`)
      } else {
        await api.post(`/knowledge/admin/documents/${document.id}/${action}`)
      }
      if (editing?.id === document.id) resetForm()
      await load()
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '知识库操作失败')
      return false
    }
  }

  const runBatchAction = async (action) => {
    if (!selectedIds.length) return false
    setBatchProcessing(true)
    setError('')
    try {
      await api.post('/knowledge/admin/documents/batch', {
        document_ids: selectedIds,
        action,
      })
      await load()
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '批量操作失败')
      return false
    } finally {
      setBatchProcessing(false)
    }
  }

  const confirmAction = async () => {
    if (!confirmation) return
    setConfirming(true)
    const successful = confirmation.kind === 'batch'
      ? await runBatchAction(confirmation.action)
      : await runAction(confirmation.document, confirmation.action)
    if (successful) setConfirmation(null)
    setConfirming(false)
  }

  const download = async (document) => {
    setError('')
    try {
      await downloadKnowledgeFile(document)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '原始文件下载失败')
    }
  }

  if (error && !documents) return <ErrorState message={error} onRetry={load} />
  if (!documents) return <LoadingState text="正在读取知识库..." />

  return (
    <>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">工作知识库</h2>
            <p className="mt-1 text-xs text-slate-500">维护已发布资料、文件版本和知识图谱处理状态</p>
          </div>
          <div className="grid grid-cols-3 rounded-md bg-slate-100 p-1">
            {[
              ['published', '已发布'],
              ['archived', '已下架'],
              ['all', '全部'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value)
                  setSelectedIds([])
                }}
                className={`h-8 px-3 text-xs font-medium ${filter === value ? 'rounded bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <span className="mr-auto text-sm font-medium text-slate-700">已选择 {selectedIds.length} 项</span>
            {selectedPublished && (
              <>
                <button
                  type="button"
                  disabled={batchProcessing}
                  onClick={() => setConfirmation({
                    kind: 'batch',
                    action: 'graph_retry',
                    title: '重新处理知识图谱',
                    message: `将选中的 ${selectedIds.length} 份资料重新加入图谱处理队列吗？`,
                    confirmLabel: '重新处理',
                    tone: 'default',
                  })}
                  className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  重新处理图谱
                </button>
                <button
                  type="button"
                  disabled={batchProcessing}
                  onClick={() => setConfirmation({
                    kind: 'batch',
                    action: 'archive',
                    title: '批量下架资料',
                    message: `确定批量下架选中的 ${selectedIds.length} 份资料吗？`,
                    confirmLabel: '确认下架',
                    tone: 'warning',
                  })}
                  className="flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  <Archive size={16} />
                  批量下架
                </button>
              </>
            )}
            {selectedArchived && (
              <button
                type="button"
                disabled={batchProcessing}
                onClick={() => setConfirmation({
                  kind: 'batch',
                  action: 'restore',
                  title: '批量恢复资料',
                  message: `确定恢复选中的 ${selectedIds.length} 份资料吗？`,
                  confirmLabel: '确认恢复',
                  tone: 'default',
                })}
                className="flex h-9 items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                <RotateCcw size={16} />
                批量恢复
              </button>
            )}
            {!selectedPublished && !selectedArchived && (
              <span className="text-xs text-amber-700">请选择状态相同的资料进行批量处理</span>
            )}
            <button
              type="button"
              title="清除选择"
              aria-label="清除选择"
              onClick={() => setSelectedIds([])}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-200"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {visibleDocuments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="全选当前列表"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 accent-emerald-700"
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">资料</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">图谱</th>
                  <th className="px-5 py-3 font-medium">版本</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${document.name}`}
                        checked={selectedIds.includes(document.id)}
                        onChange={() => toggleDocument(document.id)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-sm truncate font-medium">{document.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{knowledgeDomainLabels[document.domain] || document.domain} · {document.category || '未分类'} · {document.uploader}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${knowledgeStatusStyles[document.status] || 'bg-slate-100 text-slate-600'}`}>
                        {knowledgeStatusLabels[document.status] || document.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{graphStatusLabels[document.graphStatus] || document.graphStatus}</td>
                    <td className="px-5 py-4 text-slate-600">v{document.version}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="下载原始文件" disabled={!document.fileAvailable} onClick={() => download(document)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><Download size={18} /></button>
                        <button type="button" title="编辑资料" onClick={() => startEdit(document)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><FilePenLine size={18} /></button>
                        {document.status === 'published' ? (
                          <>
                            <button type="button" title="重新处理知识图谱" onClick={() => runAction(document, 'graph/retry')} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={18} /></button>
                            <button type="button" title="下架资料" onClick={() => setConfirmation({
                              kind: 'single',
                              action: 'archive',
                              document,
                              title: '下架知识资料',
                              message: `确定下架“${document.name}”吗？`,
                              confirmLabel: '确认下架',
                              tone: 'warning',
                            })} className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"><Archive size={18} /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" title="恢复发布" onClick={() => runAction(document, 'restore')} className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50"><RotateCcw size={18} /></button>
                            <button type="button" title="永久删除" onClick={() => setConfirmation({
                              kind: 'single',
                              action: 'delete',
                              document,
                              title: '永久删除知识资料',
                              message: `永久删除“${document.name}”及其文件？此操作无法撤销。`,
                              confirmLabel: '永久删除',
                              tone: 'danger',
                            })} className="rounded-md p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={18} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={filter === 'archived' ? '暂无已下架资料' : '暂无知识资料'} />
        )}
      </section>

      <section className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileUp className="text-emerald-700" size={19} />
            <h2 className="font-semibold">{editing ? '编辑知识资料' : '导入知识资料'}</h2>
          </div>
          {editing && <button type="button" title="取消编辑" onClick={resetForm} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>}
        </div>
        <form className="mt-5 space-y-4" onSubmit={save}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料名称</span>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料领域</span>
            <select
              value={form.domain}
              onChange={(event) => setForm({ ...form, domain: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
            >
              <option value="psychology">心理专业</option>
              <option value="student_affairs">学生工作政策</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料分类</span>
            <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="例如：危机干预指南" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料说明</span>
            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">来源链接（可选）</span>
            <input type="url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{editing ? '替换文件（可选）' : '资料文件'}</span>
            <input type="file" required={!editing} accept=".pdf,.doc,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700" />
          </label>
          <p className="text-xs leading-5 text-slate-500">管理员导入的资料会直接发布；替换文件会生成新版本并重新进入图谱处理队列。</p>
          <button type="submit" disabled={submitting} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <FileUp size={18} />}
            {editing ? '保存修改' : '导入并发布'}
          </button>
        </form>
      </section>
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel}
        tone={confirmation?.tone}
        busy={confirming}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmAction}
      />
    </>
  )
}
