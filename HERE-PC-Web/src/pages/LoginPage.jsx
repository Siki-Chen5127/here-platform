import { ArrowLeft, ArrowRight, HeartPulse, LoaderCircle, Lock, Mail, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { authApi, getApiErrorMessage } from '../services/api'

const demoAccounts = [
  { label: '辅导员', email: 'counselor@here.edu', password: 'Counselor123!' },
  { label: '心理咨询师', email: 'psychologist@here.edu', password: 'Psychologist123!' },
  { label: '中心负责人', email: 'director@here.edu', password: 'Director123!' },
  { label: '管理员', email: 'admin@here.edu', password: 'ChangeMe123!' },
]

export default function LoginPage({ onLogin }) {
  const initialResetToken = new URLSearchParams(window.location.search).get('reset_token') || ''
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recovery, setRecovery] = useState({
    email: '',
    token: initialResetToken,
    password: '',
    confirmPassword: '',
  })
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

  const requestReset = async (event) => {
    event.preventDefault()
    setIsLoggingIn(true)
    setError('')
    setSuccess('')
    try {
      const result = await authApi.requestPasswordReset(recovery.email.trim().toLowerCase())
      if (result.debugToken) {
        setRecovery((current) => ({ ...current, token: result.debugToken }))
        setSuccess('本地开发模式已生成重置码，请设置新密码')
        setMode('reset')
      } else {
        setSuccess(result.message)
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '密码重置申请失败'))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const confirmReset = async (event) => {
    event.preventDefault()
    if (recovery.password !== recovery.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setIsLoggingIn(true)
    setError('')
    try {
      const result = await authApi.confirmPasswordReset(recovery.token.trim(), recovery.password)
      window.history.replaceState({}, '', window.location.pathname)
      setMode('login')
      setPassword('')
      setSuccess(result.message)
      setRecovery({ email: '', token: '', password: '', confirmPassword: '' })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '密码重置失败'))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const submitRegistration = async (event) => {
    event.preventDefault()
    const normalizedName = registration.name.trim()
    const normalizedEmail = registration.email.trim().toLowerCase()
    if (!normalizedName) {
      setError('请输入姓名')
      return
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) {
      setError('请输入有效的工作邮箱')
      return
    }
    if (registration.password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }
    if (registration.password !== registration.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setIsLoggingIn(true)
    setError('')
    try {
      const session = await authApi.register({
        name: normalizedName,
        email: normalizedEmail,
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
              {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
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
                    setMode('forgot')
                    setError('')
                    setSuccess('')
                  }}
                  className="mt-3 w-full text-center text-sm text-emerald-700 hover:underline"
                >
                  忘记密码
                </button>

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
            ) : mode === 'register' ? (
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
            ) : mode === 'forgot' ? (
              <>
                <button type="button" onClick={() => setMode('login')} className="mb-5 rounded-md p-2 text-slate-500 hover:bg-slate-100" title="返回登录" aria-label="返回登录">
                  <ArrowLeft size={19} />
                </button>
                <h2 className="text-xl font-bold">找回密码</h2>
                <p className="mt-1 text-sm text-slate-500">输入注册邮箱，系统将发送限时重置链接</p>
                <form className="mt-7 space-y-4" onSubmit={requestReset}>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">注册邮箱</span>
                    <input type="email" required value={recovery.email} onChange={(event) => setRecovery({ ...recovery, email: event.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600" />
                  </label>
                  {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                  {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
                  <button type="submit" disabled={isLoggingIn} className="flex h-11 w-full items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50">
                    {isLoggingIn ? <LoaderCircle className="animate-spin" size={19} /> : '发送重置说明'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('login')} className="mb-5 rounded-md p-2 text-slate-500 hover:bg-slate-100" title="返回登录" aria-label="返回登录">
                  <ArrowLeft size={19} />
                </button>
                <h2 className="text-xl font-bold">设置新密码</h2>
                <p className="mt-1 text-sm text-slate-500">重置码只能使用一次，并在 30 分钟后失效</p>
                <form className="mt-7 space-y-4" onSubmit={confirmReset}>
                  {!initialResetToken && (
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">重置码</span>
                      <input required value={recovery.token} onChange={(event) => setRecovery({ ...recovery, token: event.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600" />
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">新密码</span>
                    <input type="password" required minLength={8} autoComplete="new-password" value={recovery.password} onChange={(event) => setRecovery({ ...recovery, password: event.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">确认新密码</span>
                    <input type="password" required minLength={8} autoComplete="new-password" value={recovery.confirmPassword} onChange={(event) => setRecovery({ ...recovery, confirmPassword: event.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600" />
                  </label>
                  {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
                  {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                  <button type="submit" disabled={isLoggingIn} className="flex h-11 w-full items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50">
                    {isLoggingIn ? <LoaderCircle className="animate-spin" size={19} /> : '确认重置密码'}
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
