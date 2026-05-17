import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute({ children, route }) {
  const { token, loading, can } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-navy-900"/>
          <p className="text-sm">Memuat sesi...</p>
        </div>
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace/>

  if (route && !can(route)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <p className="text-lg font-bold text-slate-700">Akses Ditolak</p>
        <p className="text-sm mt-1">Role Anda tidak memiliki izin untuk halaman ini.</p>
        <Navigate to="/dashboard" replace/>
      </div>
    )
  }

  return children
}
