import { create } from 'zustand'
import api from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'dba' | 'viewer'
  clientId?: string
  profileId?: string
  features?: string[]
  timezone?: string
  language?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  features: string[]
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  hasFeature: (code: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('dba_token'),
  isAuthenticated: !!localStorage.getItem('dba_token'),
  isLoading: false,
  features: JSON.parse(localStorage.getItem('dba_features') || '[]'),

  login: async (username, password) => {
    const { data } = await api.post('/api/auth/login', { username, password })
    const { token, user } = data.data
    localStorage.setItem('dba_token', token)
    localStorage.setItem('dba_features', JSON.stringify(user.features || []))
    if (user.timezone) localStorage.setItem('dba-timezone', user.timezone)
    if (user.language) localStorage.setItem('dba-language', user.language)
    set({ user, token, isAuthenticated: true, features: user.features || [] })
  },

  logout: () => {
    localStorage.removeItem('dba_token')
    localStorage.removeItem('dba_features')
    localStorage.removeItem('dba-timezone')
    localStorage.removeItem('dba-language')
    set({ user: null, token: null, isAuthenticated: false, features: [] })
  },

  loadUser: async () => {
    try {
      set({ isLoading: true })
      const { data } = await api.get('/api/auth/me')
      const user = data.data
      const features = user.features || JSON.parse(localStorage.getItem('dba_features') || '[]')
      set({ user, isAuthenticated: true, isLoading: false, features })
    } catch {
      localStorage.removeItem('dba_token')
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, features: [] })
    }
  },

  hasFeature: (code: string) => {
    const state = get()
    // Admin role bypasses (backwards compat)
    if (state.user?.role === 'admin') return true
    return state.features.includes(code)
  },
}))
