import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const PAGE_META = {
  '/dashboard':   { title: 'Dashboard Overview',   sub: 'Ringkasan performa maintenance secara real-time' },
  '/problems':    { title: 'Problem Tracking',      sub: 'Pencatatan dan manajemen problem mesin' },
  '/machines':    { title: 'Data Mesin',            sub: 'Master data mesin dan riwayat problem' },
  '/repairs':     { title: 'Catatan Perbaikan',     sub: 'Log tindakan perbaikan & downtime' },
  '/spare-parts': { title: 'Spare Parts',           sub: 'Manajemen stok spare part' },
  '/reports':     { title: 'Reports',               sub: 'Generate laporan dan export data maintenance' },
  '/users':       { title: 'Manajemen User',        sub: 'Pengaturan akses dan peran pengguna' },
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)
  const location = useLocation()
  const page = PAGE_META[location.pathname] || { title: 'Dashboard', sub: '' }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={page.title}
          sub={page.sub}
          onMenuToggle={() => setMobileOpen(s => !s)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  )
}
