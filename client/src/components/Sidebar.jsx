import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, AlertTriangle, Cpu, Wrench,
  Package, Users, ChevronLeft, ChevronRight,
  Activity, FileBarChart, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ALL_NAV = [
  { to: '/dashboard',   slug: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/problems',    slug: 'problems',     icon: AlertTriangle,   label: 'Problem Tracking' },
  { to: '/machines',    slug: 'machines',     icon: Cpu,             label: 'Data Mesin' },
  { to: '/repairs',     slug: 'repairs',      icon: Wrench,          label: 'Perbaikan' },
  { to: '/spare-parts', slug: 'spare-parts',  icon: Package,         label: 'Spare Parts' },
  { to: '/reports',     slug: 'reports',      icon: FileBarChart,    label: 'Reports' },
  { to: '/users',       slug: 'users',        icon: Users,           label: 'Users' },
]

export default function Sidebar({ collapsed, onToggle, onClose }) {
  const { can, user } = useAuth()
  const nav = ALL_NAV.filter(item => can(item.slug))

  return (
    <aside
      className={`bg-navy-900 text-white flex flex-col shrink-0 h-full transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
    >
      {/* Logo + mobile close */}
      <div className={`h-14 flex items-center border-b border-white/[0.07] shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
        <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center shrink-0">
          <Activity size={16} strokeWidth={2.5}/>
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-white truncate">MaintTrack</p>
              <p className="text-white/35 text-[10px] truncate">HPPM — PD 3</p>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-white/40 hover:text-white"
              aria-label="Tutup menu"
            >
              <X size={16}/>
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-2 mb-2 mt-1 truncate">
            Menu
          </p>
        )}
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
                collapsed ? 'justify-center h-10 px-0 gap-0' : 'px-3 h-10 gap-3'
              } ${
                isActive
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'text-white/55 hover:bg-white/[0.08] hover:text-white/90'
              }`
            }
          >
            <Icon size={17} className="shrink-0" strokeWidth={2}/>
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User role + toggle */}
      {!collapsed && user && (
        <div className="px-4 py-2 border-t border-white/[0.07]">
          <p className="text-white/30 text-[10px] truncate">Login sebagai</p>
          <p className="text-white/60 text-[11px] font-semibold truncate">{user.full_name}</p>
        </div>
      )}

      <button
        onClick={onToggle}
        className={`hidden lg:flex items-center h-10 border-t border-white/[0.07] hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/80 shrink-0 ${
          collapsed ? 'justify-center' : 'px-4 gap-2'
        }`}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={15}/> : (
          <><ChevronLeft size={15}/><span className="text-xs">Collapse</span></>
        )}
      </button>
    </aside>
  )
}
