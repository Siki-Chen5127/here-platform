import { ArrowLeft, ArrowRight, HeartPulse, LoaderCircle, Lock, Mail, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { authApi } from '../services/api'

const demoAccounts = [
  { label: '辅导员', email: 'counselor@here.edu', password: 'Counselor123!' },
  { label: '心理咨询师', email: 'psychologist@here.edu', password: 'Psychologist123!' },
  { label: '中心负责人', email: 'director@here.edu', password: 'Director123!' },
  { label: '管理员', email: 'admin@here.edu', password: 'ChangeMe123!' },
]

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState({
    name: '',
    email: '',
    requested_role: 'counselor',
    password: '',
    confirmPassword: '',
  })

  const submit = async (event) => {
    event.preventDefault()
    setIsLoggingIn(true)
    setError('')
    try {
      const session = await authApi.login(email, password)
      onLogin(session.user)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '无法连接后端服务')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const applyDemoAccount = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
  }

  const submitRegistration = async (event) => {
    event.preventDefault()
    if (registration.password !== registration.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setIsLoggingIn(true)
    setError('')
    try {
      const session = await authApi.register({
        name: registration.name,
        email: registration.email,
        requested_role: registration.requested_role,
        password: registration.password,
      })
      onLogin(session.user)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || '注册申请提交失败')
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-100 lg:grid-cols-[minmax(320px,0.9fr)_minmax(480px,1.1fr)]">
      <section className="hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500">
            <HeartPulse size={24} />
          </div>
          <span className="text-xl font-bold">HERE</span>
        </div>
        <div className="my-auto max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">校园心理健康协同工作平台</h1>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <HeartPulse size={24} />
            </div>
            <h1 className="text-2xl font-bold">HERE 工作平台</h1>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
            {mode === 'login' ? (
              <>
                <h2 className="text-xl font-bold">工作人员登录</h2>
                <p className="mt-1 text-sm text-slate-500">使用已审核通过或正在申请的账号登录</p>

                <form className="mt-7 space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">工作邮箱</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    placeholder="name@here.edu"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">密码</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    placeholder="请输入密码"
                  />
                </div>
              </label>
              {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? <LoaderCircle className="animate-spin" size={19} /> : <>登录 <ArrowRight size={18} /></>}
              </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                  }}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserPlus size={18} />
                  申请工作人员账号
                </button>

                {import.meta.env.DEV && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="mb-2 text-xs font-medium text-slate-500">本地演示账号</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => applyDemoAccount(account)}
                      className="rounded-md border border-slate-200 px-2 py-2 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      {account.label}
                    </button>
                  ))}
                </div>
              </div>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                  className="mb-5 rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  title="返回登录"
                  aria-label="返回登录"
                >
                  <ArrowLeft size={19} />
                </button>
                <h2 className="text-xl font-bold">申请工作人员账号</h2>
                <p className="mt-1 text-sm text-slate-500">注册后继续填写任职信息并提交审核</p>
                <form className="mt-7 space-y-4" onSubmit={submitRegistration}>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">姓名</span>
                    <input
                      required
                      value={registration.name}
                      onChange={(event) => setRegistration({ ...registration, name: event.target.value })}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">工作邮箱</span>
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={registration.email}
                      onChange={(event) => setRegistration({ ...registration, email: event.target.value })}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">申请角色</span>
                    <select
                      value={registration.requested_role}
                      onChange={(event) => setRegistration({ ...registration, requested_role: event.target.value })}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600"
                    >
                      <option value="counselor">高校辅导员</option>
                      <option value="psychologist">心理咨询师</option>
                      <option value="center_director">心理中心负责人</option>
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">密码</span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={registration.password}
                        onChange={(event) => setRegistration({ ...registration, password: event.target.value })}
                        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">确认密码</span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={registration.confirmPassword}
                        onChange={(event) => setRegistration({ ...registration, confirmPassword: event.target.value })}
                        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                  {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {isLoggingIn ? <LoaderCircle className="animate-spin" size={19} /> : <UserPlus size={18} />}
                    注册并填写资料
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
