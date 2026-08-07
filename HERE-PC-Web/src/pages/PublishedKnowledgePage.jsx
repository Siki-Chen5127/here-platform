import { Database, Download, FileText, HardDrive } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { graphStatusLabels } from '../config/knowledge'
import { api, downloadKnowledgeFile } from '../services/api'

function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function PublishedKnowledgePage() {
  const [documents, setDocuments] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/knowledge/published')
      setDocuments(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '知识库加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/knowledge/published')
      .then((response) => {
        if (active) setDocuments(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '知识库加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  const totals = useMemo(() => ({
    nodes: documents?.reduce((sum, document) => sum + document.nodes, 0) || 0,
    bytes: documents?.reduce((sum, document) => sum + document.sizeBytes, 0) || 0,
  }), [documents])

  const download = async (document) => {
    setError('')
    try {
      await downloadKnowledgeFile(document)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '原始文件下载失败')
    }
  }

  if (error && !documents) return <ErrorState message={error} onRetry={load} />
  if (!documents) return <LoadingState text="正在读取已发布知识..." />

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '已发布资料', value: documents.length, unit: '份', icon: FileText },
          { label: '知识节点', value: totals.nodes, unit: '个', icon: Database },
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">正式知识库</h2>
          <p className="mt-1 text-xs text-slate-500">这里只展示已经审核并发布的资料</p>
        </div>
        {error && <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {documents.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">资料名称</th>
                  <th className="px-5 py-3 font-medium">分类</th>
                  <th className="px-5 py-3 font-medium">提交人</th>
                  <th className="px-5 py-3 font-medium">图谱状态</th>
                  <th className="px-5 py-3 font-medium">发布时间</th>
                  <th className="px-5 py-3 text-right font-medium">文件</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium">{document.name}</p>
                      <p className="mt-1 line-clamp-1 max-w-sm text-xs text-slate-500">{document.description || '无资料说明'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{document.category || '-'}</td>
                    <td className="px-5 py-4 text-slate-600">{document.uploader}</td>
                    <td className="px-5 py-4">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {graphStatusLabels[document.graphStatus] || document.graphStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {document.publishedAt ? new Date(document.publishedAt).toLocaleString('zh-CN') : '历史导入'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        title={document.fileAvailable ? '下载原始文件' : '历史资料未保留原始文件'}
                        aria-label={`下载 ${document.name}`}
                        disabled={!document.fileAvailable}
                        onClick={() => download(document)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="暂无已发布资料" />
        )}
      </section>
    </div>
  )
}
