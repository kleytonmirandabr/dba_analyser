import { create } from 'zustand'
import api from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'dba' | 'viewer'
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('dba_token'),
  isAuthenticated: !!localStorage.getItem('dba_token'),
  isLoading: false,

  login: async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('dba_token', data.data.token)
    set({ user: data.data.user, token: data.data.token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('dba_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadUser: async () => {
    try {
      set({ isLoading: true })
      const { data } = await api.get('/api/auth/me')
      set({ user: data.data, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('dba_token')
      set({ user: null, token: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
