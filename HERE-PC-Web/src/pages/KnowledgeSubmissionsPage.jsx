import { FilePenLine, FileUp, LoaderCircle, Send, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import {
  editableKnowledgeStatuses,
  knowledgeDomainLabels,
  knowledgeStatusLabels,
  knowledgeStatusStyles,
} from '../config/knowledge'
import { api } from '../services/api'

const emptyForm = (role) => ({
  name: '',
  category: '',
  domain: role === 'psychologist' ? 'psychology' : 'student_affairs',
  description: '',
  sourceUrl: '',
})

export default function KnowledgeSubmissionsPage({ role }) {
  const [documents, setDocuments] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => emptyForm(role))
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/knowledge/submissions')
      setDocuments(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料列表加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/knowledge/submissions')
      .then((response) => {
        if (active) setDocuments(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '资料列表加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  const resetForm = () => {
    setEditing(null)
    setForm(emptyForm(role))
    setFile(null)
    setError('')
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
      setError('新建资料时必须选择文件')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (editing) {
        await api.patch(`/knowledge/submissions/${editing.id}`, {
          name: form.name,
          category: form.category,
          domain: form.domain,
          description: form.description || null,
          source_url: form.sourceUrl || null,
        })
        if (file) {
          const fileBody = new FormData()
          fileBody.append('file', file)
          await api.put(`/knowledge/submissions/${editing.id}/file`, fileBody)
        }
      } else {
        const body = new FormData()
        body.append('name', form.name)
        body.append('category', form.category)
        body.append('domain', form.domain)
        body.append('description', form.description)
        body.append('source_url', form.sourceUrl)
        body.append('file', file)
        await api.post('/knowledge/submissions', body)
      }
      resetForm()
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (document) => {
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/knowledge/submissions/${document.id}`)
      if (editing?.id === document.id) resetForm()
      await load()
      setPendingDelete(null)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const submitForReview = async (document) => {
    setError('')
    try {
      await api.post(`/knowledge/submissions/${document.id}/submit`)
      if (editing?.id === document.id) resetForm()
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '提交审核失败')
    }
  }

  if (error && !documents) return <ErrorState message={error} onRetry={load} />
  if (!documents) return <LoadingState text="正在读取我的资料..." />

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">我的资料</h2>
          <p className="mt-1 text-xs text-slate-500">
            {role === 'psychologist' ? '提交专业指南、伦理规范和培训资料' : '提交学校制度、工作流程和教育材料'}
          </p>
        </div>
        {error && <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {documents.length ? (
          <div className="divide-y divide-slate-100">
            {documents.map((document) => {
              const editable = editableKnowledgeStatuses.has(document.status)
              return (
                <article key={document.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_120px_150px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{document.name}</h3>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${knowledgeStatusStyles[document.status] || 'bg-slate-100 text-slate-600'}`}>
                        {knowledgeStatusLabels[document.status] || document.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{knowledgeDomainLabels[document.domain] || document.domain} · {document.category || '未分类'}</p>
                    {document.reviewNote && (
                      <p className="mt-2 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-800">
                        审核意见：{document.reviewNote}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-slate-500">{new Date(document.updatedAt).toLocaleDateString('zh-CN')}</time>
                  <div className="flex justify-end gap-1">
                    {editable && (
                      <>
                        <button
                          type="button"
                          title="编辑资料"
                          aria-label={`编辑 ${document.name}`}
                          onClick={() => startEdit(document)}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <FilePenLine size={18} />
                        </button>
                        <button
                          type="button"
                          title="删除草稿"
                          aria-label={`删除 ${document.name}`}
                          onClick={() => setPendingDelete(document)}
                          className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          type="button"
                          title="提交审核"
                          aria-label={`提交 ${document.name}`}
                          onClick={() => submitForReview(document)}
                          className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Send size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState title="还没有提交资料" description="在右侧建立第一份资料草稿。" />
        )}
      </section>

      <section className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileUp className="text-emerald-700" size={19} />
            <h2 className="font-semibold">{editing ? '编辑资料' : '新建资料草稿'}</h2>
          </div>
          {editing && (
            <button
              type="button"
              title="取消编辑"
              aria-label="取消编辑"
              onClick={resetForm}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <form className="mt-5 space-y-4" onSubmit={save}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料名称</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
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
            <input
              required
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder={role === 'psychologist' ? '例如：伦理规范' : '例如：工作流程'}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">资料说明</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">来源链接（可选）</span>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              {editing ? '替换文件（可选）' : '资料文件'}
            </span>
            <input
              type="file"
              required={!editing}
              accept=".pdf,.doc,.docx,.txt"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700"
            />
          </label>
          <p className="text-xs leading-5 text-slate-500">保存后仍是草稿，需要在列表中点击提交审核。</p>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <FileUp size={18} />}
            {editing ? '保存修改' : '保存草稿'}
          </button>
        </form>
      </section>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除资料草稿"
        message={pendingDelete ? `确定删除草稿“${pendingDelete.name}”吗？删除后无法恢复。` : ''}
        confirmLabel="确认删除"
        tone="danger"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => remove(pendingDelete)}
      />
    </>
  )
}
