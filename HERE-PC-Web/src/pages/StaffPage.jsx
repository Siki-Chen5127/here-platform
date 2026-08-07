import { UserCheck, UserX } from 'lucide-react'
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
                    <span className={`rounded px-2 py-1 text-xs font-medium ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : status === 'suspended' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                      {accountStatusLabels[status] || status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
