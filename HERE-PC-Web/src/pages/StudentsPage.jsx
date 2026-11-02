import { Phone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { api } from '../services/api'

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await api.get('/students')
      setStudents(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '学生列表加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/students')
      .then((response) => {
        if (active) setStudents(response.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || '学生列表加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!students) return <LoadingState text="正在读取负责学生..." />
  if (!students.length) return <EmptyState title="尚未分配学生" description="学生与辅导员的归属关系需要由管理流程建立。" />

  const statusText = {
    active: '正常',
    imported: '历史导入',
    disabled: '停用',
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">负责学生</h2>
        <p className="mt-1 text-xs text-slate-500">共 {students.length} 人，仅显示分配给当前账号的数据</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">姓名</th>
              <th className="px-5 py-3 font-medium">联系电话</th>
              <th className="px-5 py-3 font-medium">学号</th>
              <th className="px-5 py-3 font-medium">学院 / 专业</th>
              <th className="px-5 py-3 font-medium">班级</th>
              <th className="px-5 py-3 font-medium">账号状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-medium">{student.name}</td>
                <td className="px-5 py-4">
                  <a
                    href={`tel:${student.phone}`}
                    className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
                  >
                    <Phone size={15} />
                    {student.phone}
                  </a>
                </td>
                <td className="px-5 py-4 text-slate-600">{student.studentNumber || '-'}</td>
                <td className="px-5 py-4 text-slate-600">{[student.college, student.major].filter(Boolean).join(' / ') || '-'}</td>
                <td className="px-5 py-4 text-slate-600">{student.className || '-'}</td>
                <td className="px-5 py-4">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${student.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {statusText[student.status] || student.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
