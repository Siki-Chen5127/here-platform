import { CheckCircle2, Download, LoaderCircle, RotateCcw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { roleLabels } from '../config/platforms'
import { api, downloadStaffProof } from '../services/api'

const filters = [
  ['pending_review', '待审核'],
  ['changes_requested', '已退回'],
  ['approved', '已通过'],
  ['all', '全部'],
]

const applicationTypeLabels = {
  registration: '首次入驻',
  profile_update: '资料变更',
}

export default function StaffApplicationsPage() {
  const [applications, setApplications] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('pending_review')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (statusFilter = filter) => {
    setError('')
    try {
      const response = await api.get('/admin/staff-applications', {
        params: { status_filter: statusFilter },
      })
      setApplications(response.data)
      setSelectedId((current) => (
        response.data.some((item) => item.id === current) ? current : response.data[0]?.id || null
      ))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '入驻申请加载失败')
    }
  }, [filter])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  const selected = useMemo(
    () => applications?.find((item) => item.id === selectedId) || applications?.[0] || null,
    [applications, selectedId],
  )

  const review = async (action) => {
    if (!selected) return
    if (action !== 'approve' && !note.trim()) {
      setError('退回或拒绝时必须填写审核意见')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/admin/staff-applications/${selected.id}/review`, {
        action,
        note: note.trim() || null,
      })
      setNote('')
      await load(filter)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审核操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadProof = async (credential) => {
    setError('')
    try {
      await downloadStaffProof(selected.id, credential)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '证明文件下载失败')
    }
  }

  if (error && !applications) return <ErrorState message={error} onRetry={() => load(filter)} />
  if (!applications) return <LoadingState text="正在读取入驻申请..." />

  return (
    <div className="grid min-h-[650px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 p-2">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value)
                setSelectedId(null)
              }}
              className={`h-9 rounded text-xs font-medium ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[600px] space-y-2 overflow-y-auto p-3">
          {applications.length ? applications.map((application) => (
            <button
              key={application.id}
              type="button"
              onClick={() => {
                setSelectedId(application.id)
                setNote('')
                setError('')
              }}
              className={`w-full rounded-md border p-4 text-left ${selected?.id === application.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{application.applicantName}</p>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{applicationTypeLabels[application.applicationType]}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{roleLabels[application.requestedRole]} · {application.profile.organization}</p>
            </button>
          )) : <EmptyState title="当前分类暂无申请" />}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 pb-5">
              <p className="text-xs text-slate-500">{applicationTypeLabels[selected.applicationType]}</p>
              <h2 className="mt-1 text-xl font-bold">{selected.applicantName}</h2>
              <p className="mt-2 text-sm text-slate-500">{selected.applicantEmail} · 申请成为{roleLabels[selected.requestedRole]}</p>
            </div>

            <dl className="grid gap-x-6 gap-y-4 py-6 sm:grid-cols-2">
              {[
                ['真实姓名', selected.profile.realName],
                ['显示名称', selected.profile.displayName],
                ['工作手机号', selected.profile.phone],
                ['学校或机构', selected.profile.organization],
                ['所属部门', selected.profile.department],
                ['所属学院', selected.profile.college || '-'],
                ['工号', selected.profile.employeeNumber],
                ['身份证信息', selected.profile.idNumberMasked || '未填写'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-slate-100 py-5">
              <p className="text-xs font-medium text-slate-500">证明材料</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.credentials.length ? selected.credentials.map((credential) => (
                  <button
                    key={credential.id}
                    type="button"
                    onClick={() => downloadProof(credential)}
                    className="flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={16} />
                    {credential.name}
                  </button>
                )) : <span className="text-sm text-slate-500">本次变更未上传新证明</span>}
              </div>
            </div>

            {selected.reviewNote && (
              <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">审核意见：{selected.reviewNote}</p>
            )}

            {selected.status === 'pending_review' && (
              <div className="mt-auto border-t border-slate-200 pt-5">
                <label className="text-sm font-medium text-slate-700" htmlFor="application-note">审核意见</label>
                <textarea
                  id="application-note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="退回或拒绝时必须填写"
                  className="mt-2 w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={submitting} onClick={() => review('approve')} className="flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                    {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    审核通过
                  </button>
                  <button type="button" disabled={submitting || !note.trim()} onClick={() => review('request_changes')} className="flex h-10 items-center gap-2 rounded-md border border-orange-300 px-4 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-40">
                    <RotateCcw size={18} />
                    退回补充
                  </button>
                  <button type="button" disabled={submitting || !note.trim()} onClick={() => review('reject')} className="flex h-10 items-center gap-2 rounded-md border border-rose-300 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                    <XCircle size={18} />
                    拒绝申请
                  </button>
                </div>
              </div>
            )}
            {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          </div>
        ) : <EmptyState title="请选择一份申请" />}
      </section>
    </div>
  )
}
