import { FileCheck2, FileUp, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { roleLabels } from '../config/platforms'
import { api } from '../services/api'

const statusLabels = {
  profile_incomplete: '资料待完善',
  pending_review: '等待管理员审核',
  changes_requested: '需要补充资料',
  rejected: '申请未通过',
  active: '已审核通过',
  suspended: '账号已停用',
}

const emptyForm = {
  realName: '',
  displayName: '',
  phone: '',
  organization: '',
  department: '',
  college: '',
  employeeNumber: '',
  idNumber: '',
  requestedRole: 'counselor',
}

export default function StaffProfilePage({ standalone = false, onLogout }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [proofs, setProofs] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/staff/profile')
      const details = response.data
      setData(details)
      const source = details.latestApplication?.profile || details.profile
      setForm({
        realName: source?.realName || details.account.name || '',
        displayName: source?.displayName || details.account.name || '',
        phone: source?.phone || '',
        organization: source?.organization || '',
        department: source?.department || '',
        college: source?.college || '',
        employeeNumber: source?.employeeNumber || '',
        idNumber: '',
        requestedRole: details.latestApplication?.requestedRole || details.account.role || 'counselor',
      })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '个人资料加载失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const body = new FormData()
      body.append('real_name', form.realName)
      body.append('display_name', form.displayName)
      body.append('phone', form.phone)
      body.append('organization', form.organization)
      body.append('department', form.department)
      body.append('college', form.college)
      body.append('employee_number', form.employeeNumber)
      body.append('requested_role', form.requestedRole)
      if (form.idNumber) body.append('id_number', form.idNumber)
      proofs.forEach((file) => body.append('proofs', file))
      await api.post('/staff/applications', body)
      setProofs([])
      setSuccess('资料已经提交审核')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '资料提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (error && !data) return <ErrorState message={error} onRetry={load} />
  if (!data) return <LoadingState text="正在读取个人资料..." />

  const application = data.latestApplication
  const pending = application?.status === 'pending_review'
  const content = (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-700" size={20} />
            <h2 className="font-semibold">{data.account.name}</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">{data.account.email} · {roleLabels[data.account.role]}</p>
        </div>
        <span className={`rounded px-3 py-1.5 text-sm font-medium ${data.account.accountStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {statusLabels[data.account.accountStatus] || data.account.accountStatus}
        </span>
      </section>

      {application && application.status !== 'approved' && (
        <section className={`rounded-lg border px-5 py-4 ${application.status === 'pending_review' ? 'border-amber-200 bg-amber-50' : 'border-orange-200 bg-orange-50'}`}>
          <p className="font-medium">{statusLabels[application.status] || application.status}</p>
          {application.reviewNote && <p className="mt-2 text-sm text-slate-700">审核意见：{application.reviewNote}</p>}
        </section>
      )}

      <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
          <FileCheck2 className="text-emerald-700" size={20} />
          <div>
            <h2 className="font-semibold">{data.profile ? '修改个人资料' : '完善入驻资料'}</h2>
            <p className="mt-1 text-xs text-slate-500">关键资料修改后需要管理员重新审核</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ['realName', '真实姓名', 'text'],
            ['displayName', '工作台显示名称', 'text'],
            ['phone', '工作手机号', 'tel'],
            ['organization', '学校或机构', 'text'],
            ['department', '所属部门', 'text'],
            ['college', '所属学院（可选）', 'text'],
            ['employeeNumber', '工号', 'text'],
            ['idNumber', data.profile?.idNumberMasked ? `身份证号（当前 ${data.profile.idNumberMasked}）` : '身份证号（可选）', 'text'],
          ].map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
              <input
                type={type}
                required={!['college', 'idNumber'].includes(key)}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">申请角色</span>
            <select
              value={form.requestedRole}
              onChange={(event) => setForm({ ...form, requestedRole: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
            >
              <option value="counselor">高校辅导员</option>
              <option value="psychologist">心理咨询师</option>
              <option value="center_director">心理中心负责人</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">任职或资质证明{data.profile ? '（修改时可选）' : ''}</span>
            <input
              type="file"
              multiple
              required={!data.profile}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setProofs(Array.from(event.target.files || []))}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium"
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {success && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
        <button
          type="submit"
          disabled={submitting || pending}
          className="mt-5 flex h-10 items-center gap-2 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <FileUp size={18} />}
          {pending ? '审核处理中' : '提交审核'}
        </button>
      </form>
    </div>
  )

  if (!standalone) return content
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <p className="font-bold">HERE 工作人员入驻</p>
          <button type="button" onClick={onLogout} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="退出登录" aria-label="退出登录">
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <main className="p-5 lg:p-8">{content}</main>
    </div>
  )
}
