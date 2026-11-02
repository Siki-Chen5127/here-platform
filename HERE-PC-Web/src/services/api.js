import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '')
const TOKEN_KEY = 'here.staff.accessToken'
const USER_KEY = 'here.staff.user'

export const sessionStore = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY)
  },

  getUser() {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      sessionStorage.removeItem(USER_KEY)
      return null
    }
  },

  save(session) {
    sessionStorage.setItem(TOKEN_KEY, session.access_token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(session.user))
  },

  updateUser(user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  clear() {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  },
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
})

export function getApiErrorMessage(error, fallback = '请求处理失败') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const fieldLabels = {
      name: '姓名',
      email: '邮箱',
      password: '密码',
      requested_role: '申请角色',
      real_name: '真实姓名',
      display_name: '显示名称',
      phone: '手机号',
      organization: '学校或机构',
      department: '所属部门',
      employee_number: '工号',
      id_number: '身份证号',
      file: '文件',
      proofs: '证明文件',
    }
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item
        const field = Array.isArray(item?.loc) ? item.loc.at(-1) : null
        const label = fieldLabels[field] || field
        if (item?.type === 'missing') return `${label || '必填项'}不能为空`
        if (item?.type === 'string_too_short') {
          return `${label || '内容'}至少需要 ${item.ctx?.min_length || 1} 个字符`
        }
        if (item?.type === 'string_too_long') {
          return `${label || '内容'}最多允许 ${item.ctx?.max_length || ''} 个字符`
        }
        const message = typeof item?.msg === 'string'
          ? item.msg.replace(/^Value error,\s*/i, '')
          : ''
        return [label, message].filter(Boolean).join('：')
      })
      .filter(Boolean)
    if (messages.length) return messages.join('；')
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message
  }
  return fallback
}

api.interceptors.request.use((config) => {
  const token = sessionStore.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data && typeof error.response.data.detail !== 'string') {
      error.response.data.detail = getApiErrorMessage(error)
    }
    if (error.response?.status === 401 && sessionStore.getToken()) {
      sessionStore.clear()
      window.dispatchEvent(new Event('here:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  async login(email, password) {
    const response = await api.post('/auth/staff/login', { email, password })
    sessionStore.save(response.data)
    return response.data
  },

  async register(payload) {
    const response = await api.post('/auth/staff/register', payload)
    sessionStore.save(response.data)
    return response.data
  },

  async requestPasswordReset(email) {
    const response = await api.post('/auth/staff/password-reset/request', { email })
    return response.data
  },

  async confirmPasswordReset(token, newPassword) {
    const response = await api.post('/auth/staff/password-reset/confirm', {
      token,
      new_password: newPassword,
    })
    return response.data
  },
}

export async function downloadStaffProof(applicationId, credential) {
  const response = await api.get(
    `/staff/applications/${applicationId}/proofs/${credential.id}`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(response.data)
  const link = window.document.createElement('a')
  link.href = url
  link.download = credential.name
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadKnowledgeFile(document) {
  const response = await api.get(`/knowledge/documents/${document.id}/file`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const link = window.document.createElement('a')
  link.href = url
  link.download = document.name
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
