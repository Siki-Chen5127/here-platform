import { Trash2, UserCheck, UserX, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { roleLabels } from '../config/platforms'
import { api } from '../services/api'

const accountStatusLabels = {
  profile_incomplete: '资料待完善',
  pending_review: '等待审核',
  changes_requested: '待补充资料',
  rejected: '申请未通过',
  active: '启用',
  suspended: '停用',
  closed: '已注销',
}

const scopeOptions = [
  { value: '', label: '无知识审核权限' },
  { value: 'psychology', label: '心理专业资料' },
  { value: 'student_affairs', label: '学生工作政策' },
  { value: 'psychology,student_affairs', label: '心理专业与学生工作' },
]

export default function StaffPage({ currentUser }) {
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [closingAccount, setClosingAccount] = useState(null)
  const [closeReason, setCloseReason] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/admin/staff')
      setStaff(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '工作人员账号加载失败')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleStatus = async (account) => {
    setUpdatingId(account.id)
    setError('')
    try {
      await api.patch(`/admin/staff/${account.id}/status`, { is_active: !account.isActive })
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '账号状态修改失败')
    } finally {
      setUpdatingId(null)
    }
  }

  const updateScopes = async (account, value) => {
    setUpdatingId(account.id)
    setError('')
    try {
      await api.patch(`/admin/staff/${account.id}/review-scopes`, {
        scopes: value ? value.split(',') : [],
      })
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '审核范围修改失败')
    } finally {
      setUpdatingId(null)
    }
  }

  const closeAccount = async (event) => {
    event.preventDefault()
    if (!closingAccount || closeReason.trim().length < 2) return
    setUpdatingId(closingAccount.id)
    setError('')
    try {
      await api.post(`/admin/staff/${closingAccount.id}/close`, { reason: closeReason.trim() })
      setClosingAccount(null)
      setCloseReason('')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '账号注销失败')
    } finally {
      setUpdatingId(null)
    }
  }

  if (error && !staff) return <ErrorState message={error} onRetry={load} />
  if (!staff) return <LoadingState text="正在读取工作人员账号..." />

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">工作人员账号</h2>
        <p className="mt-1 text-xs text-slate-500">账号由工作人员自主申请，管理员在入驻审核中确认身份</p>
      </div>
      {error && <p className="m-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">姓名 / 联系方式</th>
              <th className="px-5 py-3 font-medium">角色</th>
              <th className="px-5 py-3 font-medium">机构 / 部门</th>
              <th className="px-5 py-3 font-medium">知识审核范围</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((account) => {
              const status = account.accountStatus || (account.isActive ? 'active' : 'suspended')
              const canToggle = ['active', 'suspended'].includes(status) && account.id !== currentUser.id
              return (
                <tr key={account.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium">{account.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{account.email}{account.phone ? ` · ${account.phone}` : ''}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{roleLabels[account.role] || account.role}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <p>{account.organization || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">{account.department || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={(account.reviewScopes || []).join(',')}
                      disabled={status !== 'active' || account.role === 'admin' || updatingId === account.id}
                      onChange={(event) => updateScopes(account, event.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-emerald-600 disabled:opacity-50"
                    >
                      {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : status === 'closed' ? 'bg-rose-50 text-rose-700' : status === 'suspended' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                      {accountStatusLabels[status] || status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title={account.isActive ? '停用账号' : '启用账号'}
                        aria-label={account.isActive ? '停用账号' : '启用账号'}
                        disabled={!canToggle || updatingId === account.id}
                        onClick={() => toggleStatus(account)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {account.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        type="button"
                        title="注销账号"
                        aria-label={`注销 ${account.name}`}
                        disabled={account.id === currentUser.id || account.role === 'admin' || status === 'closed' || updatingId === account.id}
                        onClick={() => {
                          setClosingAccount(account)
                          setCloseReason('')
                        }}
                        className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {closingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5">
          <form onSubmit={closeAccount} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">注销工作人员账号</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {closingAccount.name} 将无法再次登录。历史业务记录和审计责任链会继续保留，此操作不可恢复。
                </p>
              </div>
              <button type="button" onClick={() => setClosingAccount(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" aria-label="关闭注销窗口">
                <X size={18} />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">注销原因</span>
              <textarea
                required
                minLength={2}
                rows={3}
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                className="w-full resize-none rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-rose-500"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setClosingAccount(null)} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700">取消</button>
              <button type="submit" disabled={closeReason.trim().length < 2 || updatingId === closingAccount.id} className="h-10 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-40">确认注销</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
