import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

// Role → allowed route slugs
const ROLE_PERMISSIONS = {
  Admin:      ['dashboard', 'daily-log', 'pm-schedule', 'machines', 'spare-parts', 'reports', 'users'],
  Supervisor: ['dashboard', 'daily-log', 'pm-schedule', 'machines', 'spare-parts', 'reports'],
  Technician: ['dashboard', 'daily-log', 'pm-schedule', 'machines', 'spare-parts'],
  Operator:   ['dashboard', 'daily-log'],
}

const ROLE_COLOR = {
  Admin:      'bg-red-100 text-red-700',
  Supervisor: 'bg-purple-100 text-purple-700',
  Technician: 'bg-blue-100 text-blue-700',
  Operator:   'bg-green-100 text-green-700',
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Session dipertahankan lewat sessionStorage (bukan localStorage) supaya
  // otomatis hilang saat tab/browser ditutup — user wajib login ulang tiap
  // kali membuka web dari awal, tapi F5/refresh biasa tidak logout karena
  // sessionStorage bertahan selama tab masih hidup.
  useEffect(() => {
    // Bersihkan token lama yang mungkin masih tersisa di localStorage dari
    // versi sebelum perubahan ini (supaya tidak ada JWT plaintext yang
    // tertinggal permanen di browser).
    localStorage.removeItem('maint_token')
    localStorage.removeItem('maint_user')

    const storedToken = sessionStorage.getItem('maint_token')
    const storedUser  = sessionStorage.getItem('maint_user')
    if (storedToken && storedUser) {
      try {
        const u = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(u)
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      } catch { /* invalid stored data */ }
    }
    setLoading(false)
  }, [])

  const login = useCallback((token, userData) => {
    setToken(token)
    setUser(userData)
    sessionStorage.setItem('maint_token', token)
    sessionStorage.setItem('maint_user', JSON.stringify(userData))
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    sessionStorage.removeItem('maint_token')
    sessionStorage.removeItem('maint_user')
    delete api.defaults.headers.common['Authorization']
  }, [])

  const can = useCallback((route) => {
    if (!user) return false
    return (ROLE_PERMISSIONS[user.role] || []).includes(route)
  }, [user])

  const roleColor = user ? (ROLE_COLOR[user.role] || 'bg-slate-100 text-slate-600') : ''

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, can, roleColor, ROLE_PERMISSIONS }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
