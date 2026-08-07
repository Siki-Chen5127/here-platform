import { Database, FileText, HardDrive, LoaderCircle, UploadCloud } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function KnowledgeBasePage({ role }) {
  const [documents, setDocuments] = useState(null)
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const canUpload = role === 'admin'

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/knowledge/docs')
      setDocuments(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '知识库加载失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => ({
    nodes: documents?.reduce((sum, document) => sum + document.nodes, 0) || 0,
    bytes: documents?.reduce((sum, document) => sum + document.sizeBytes, 0) || 0,
  }), [documents])

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setUploadStatus('正在上传...')
    const body = new FormData()
    body.append('file', file)
    try {
      await api.post('/knowledge/upload', body)
      setUploadStatus('上传完成')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '文档上传失败')
      setUploadStatus('')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  if (error && !documents) return <ErrorState message={error} onRetry={load} />
  if (!documents) return <LoadingState text="正在读取规章知识库..." />

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '文档数量', value: documents.length, unit: '份', icon: FileText },
          { label: '已记录节点', value: totals.nodes, unit: '个', icon: Database },
          { label: '文件总大小', value: formatSize(totals.bytes), unit: '', icon: HardDrive },
        ].map((item) => (
          <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{item.label}</p>
              <item.icon className="text-slate-400" size={19} />
            </div>
            <p className="mt-4 text-2xl font-bold">
              {item.value}
              {item.unit && <span className="ml-1 text-sm font-medium text-slate-400">{item.unit}</span>}
            </p>
          </article>
        ))}
      </section>

      <div className={`grid gap-5 ${canUpload ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
        {canUpload && (
          <section className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">上传规章文档</h2>
            <p className="mt-1 text-xs text-slate-500">支持 PDF、Word 和 TXT，单个文件不超过 20 MB</p>
            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center hover:border-emerald-500 hover:bg-emerald-50">
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.doc,.docx,.txt"
                disabled={uploading}
                onChange={upload}
              />
              {uploading ? <LoaderCircle className="animate-spin text-emerald-700" size={28} /> : <UploadCloud className="text-slate-500" size={28} />}
              <span className="mt-3 text-sm font-medium text-slate-700">{uploadStatus || '选择本地文档'}</span>
            </label>
            {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">已入库文档</h2>
            {!canUpload && <p className="mt-1 text-xs text-slate-500">当前角色为只读权限</p>}
          </div>
          {documents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">文档名称</th>
                    <th className="px-5 py-3 font-medium">节点数</th>
                    <th className="px-5 py-3 font-medium">大小</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => (
                    <tr key={document.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">{document.name}</td>
                      <td className="px-5 py-4 text-slate-600">{document.nodes}</td>
                      <td className="px-5 py-4 text-slate-600">{formatSize(document.sizeBytes)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          {document.status === 'uploaded' ? '已上传' : document.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="知识库暂无文档" />
          )}
        </section>
      </div>
    </div>
  )
}
