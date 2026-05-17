import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Activity, Loader2, AlertCircle, Wrench, BarChart3, Shield, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'

const DEMO_ACCOUNTS = [
  { role: 'Admin',      username: 'admin',      password: 'admin123',  color: 'bg-red-100 text-red-700' },
  { role: 'Supervisor', username: 'supervisor', password: 'super123',  color: 'bg-purple-100 text-purple-700' },
  { role: 'Technician', username: 'teknisi1',   password: 'teknis123', color: 'bg-blue-100 text-blue-700' },
  { role: 'Operator',   username: 'operator1',  password: 'oper123',   color: 'bg-green-100 text-green-700' },
]

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form,      setForm]      = useState({ username: '', password: '' })
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Username dan password wajib diisi'); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/login', form)
      login(res.data.token, res.data.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Login gagal. Coba lagi.')
    } finally { setLoading(false) }
  }

  const fillDemo = (account) => {
    setForm({ username: account.username, password: account.password })
    setError('')
  }

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Left branding panel ────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] bg-navy-900 flex-col justify-between p-10 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/3"/>

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-white"/>
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">MaintTrack</p>
            <p className="text-white/40 text-xs">PT. Honda Precision Parts Mfg. Indonesia</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">
              Maintenance Problem<br/>Tracking Dashboard
            </h1>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mt-2">
              PD 3 — Element Ring Dept &amp; Belt Assy Dept
            </p>
            <p className="text-white/60 text-sm mt-3 leading-relaxed">
              Kelola, track, dan analisis problem maintenance mesin secara terpusat dan real-time.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: AlertCircle,  label: 'Problem tracking dengan priority & status' },
              { icon: Wrench,       label: 'Repair action management & downtime tracking' },
              { icon: BarChart3,    label: 'Dashboard analytics & laporan otomatis' },
              { icon: Shield,       label: 'Role-based access control' },
              { icon: Users,        label: 'Multi-user dengan 4 level role' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-white/70"/>
                </div>
                <p className="text-white/70 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs relative">
          © {new Date().getFullYear()} PT. Honda Precision Parts Mfg. Indonesia — PD 3
        </p>
      </div>

      {/* ── Right login panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-6">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-9 h-9 bg-navy-900 rounded-xl flex items-center justify-center">
              <Activity size={17} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-navy-900 text-sm">MaintTrack</p>
              <p className="text-slate-400 text-xs">HPPM — PD 3</p>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Selamat Datang</h2>
            <p className="text-slate-500 text-sm mt-1">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="shrink-0"/>
                {error}
              </div>
            )}

            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="Masukkan username"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Masukkan password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-navy-900/20 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin"/> : null}
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              Akun Demo
            </p>
            <div className="divide-y divide-slate-100">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.color}`}>{acc.role}</span>
                    <span className="text-xs font-mono text-slate-700">{acc.username}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{acc.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
