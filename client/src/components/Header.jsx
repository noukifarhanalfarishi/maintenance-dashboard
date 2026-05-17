import { useState, useEffect } from 'react'
import { Bell, Menu, LogOut, ChevronDown, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Header({ title, sub, onMenuToggle }) {
  const navigate = useNavigate()
  const { user, logout, roleColor } = useAuth()
  const [now,         setNow]         = useState(new Date())
  const [alertCount,  setAlertCount]  = useState(0)
  const [showUserMenu,setShowUserMenu]= useState(false)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    dashboardApi.getLowStock().then(r => setAlertCount(r.data.length)).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 flex items-center px-4 gap-3 shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-500"
        aria-label="Toggle menu"
      >
        <Menu size={18}/>
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[14px] font-bold text-navy-900 leading-tight truncate">{title}</h1>
        {sub && <p className="text-[10px] text-slate-400 truncate hidden sm:block">{sub}</p>}
      </div>

      {/* Date/time */}
      <div className="hidden md:block text-right shrink-0">
        <p className="text-[10px] font-medium text-slate-600">{dateStr}</p>
        <p className="text-[10px] text-slate-400">{timeStr} WIB</p>
      </div>
      <div className="h-6 w-px bg-slate-200 hidden md:block shrink-0"/>

      {/* Bell */}
      <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
        <Bell size={16} className="text-slate-500"/>
        {alertCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowUserMenu(s => !s)}
          className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-2 ring-slate-200">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[100px]">{user?.full_name || 'User'}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleColor}`}>{user?.role}</span>
          </div>
          <ChevronDown size={12} className="text-slate-400 hidden sm:block"/>
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}/>
            <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{user?.department || 'PD 3 — HPPM'}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${roleColor}`}>{user?.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
              >
                <LogOut size={15}/> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
