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
