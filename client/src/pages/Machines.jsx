import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, X, LayoutGrid, Table2, Cpu, MapPin, Building2,
  Wrench, Clock, TrendingUp, TrendingDown, Minus, Loader2, Pencil,
  Trash2, AlertTriangle, CheckCircle2, ChevronRight, BarChart3,
  AlertCircle, Save,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { machinesApi } from '../api/client'
import { StatusBadge, CategoryBadge } from '../components/Badge'

// ── Constants ────────────────────────────────────────────────────────────
const MACHINE_TYPES = [
  'CNC Turning', 'CNC Milling', 'Grinding Machine', 'Honing Machine',
  'Lapping Machine', 'Chamfering Machine', 'Washing Machine', 'Assembly Machine',
  'Conveyor', 'Compressor', 'Hydraulic Press', 'Robot', 'Cooling Tower', 'Generator',
]
const DEPARTMENTS = [
  'Element Ring Dept', 'Belt Assy Dept', 'Maintenance', 'Engineering',
  'Quality Control', 'Utility', 'Warehouse', 'Production Control',
]

const CAT_COLOR = {
  Mechanical: '#3b82f6', Electrical: '#f59e0b', Pneumatic: '#06b6d4',
  Hydraulic: '#8b5cf6', Software: '#10b981', Other: '#94a3b8',
}
const PALETTE = Object.values(CAT_COLOR)

// ── Utilities ────────────────────────────────────────────────────────────
const fmtDur  = (m) => { if (!m) return '—'; const h = Math.floor(m/60); return h>0 ? `${h}j ${m%60}m` : `${m}m` }
const fmtHrs  = (h) => h == null ? '—' : `${h}j`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const pctColor = (v, lower) => v == null ? 'text-slate-400' : (lower ? v<0 : v>0) ? 'text-emerald-600' : v===0 ? 'text-slate-400' : 'text-red-500'

// ── Health dot ───────────────────────────────────────────────────────────
function HealthDot({ open, status }) {
  if (status === 'inactive') return <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Inactive" />
  if (open === 0)  return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Normal" />
  if (open <= 2)   return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" title={`${open} masalah aktif`} />
  return               <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title={`${open} masalah aktif`} />
}

// ── Toast ────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>
      {type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>} {msg}
    </div>
  )
}

// ── Machine Form Modal ───────────────────────────────────────────────────
function MachineFormModal({ machine, onSave, onClose }) {
  const [form, setForm] = useState(machine ? {
    machine_code: machine.machine_code, machine_name: machine.machine_name,
    machine_type: machine.machine_type||'', line: machine.line||'',
    location: machine.location||'', department: machine.department||'', status: machine.status,
  } : { machine_code:'', machine_name:'', machine_type:'', line:'', location:'', department:'', status:'active' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})) }

  const validate = () => {
    const e = {}
    if (!form.machine_code.trim()) e.machine_code = 'Wajib diisi'
    if (!form.machine_name.trim()) e.machine_name = 'Wajib diisi'
    setErrors(e); return !Object.keys(e).length
  }

  const submit = async (e) => {
    e.preventDefault(); if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">{machine ? 'Edit Mesin' : 'Tambah Mesin Baru'}</p>
            {machine && <p className="text-white/50 text-xs font-mono mt-0.5">{machine.machine_code}</p>}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kode Mesin *</label>
              <input className={`input ${errors.machine_code?'border-red-400':''}`}
                value={form.machine_code} onChange={e=>set('machine_code',e.target.value)} placeholder="MC-016" />
              {errors.machine_code && <p className="text-red-500 text-xs mt-1">{errors.machine_code}</p>}
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nama Mesin *</label>
            <input className={`input ${errors.machine_name?'border-red-400':''}`}
              value={form.machine_name} onChange={e=>set('machine_name',e.target.value)} placeholder="CNC Milling Machine C" />
            {errors.machine_name && <p className="text-red-500 text-xs mt-1">{errors.machine_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipe Mesin</label>
              <input className="input" list="types-list" value={form.machine_type}
                onChange={e=>set('machine_type',e.target.value)} placeholder="CNC, Conveyor..." />
              <datalist id="types-list">{MACHINE_TYPES.map(t=><option key={t} value={t}/>)}</datalist>
            </div>
            <div>
              <label className="label">Line / Grup Mesin</label>
              <input className="input" value={form.line}
                onChange={e=>set('line',e.target.value)} placeholder="Atsuen, Sekisou..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Departemen</label>
              <input className="input" list="dept-list" value={form.department}
                onChange={e=>set('department',e.target.value)} placeholder="Belt Assy, Element Ring..." />
              <datalist id="dept-list">{DEPARTMENTS.map(d=><option key={d} value={d}/>)}</datalist>
            </div>
            <div>
              <label className="label">Lokasi</label>
              <input className="input" value={form.location} onChange={e=>set('location',e.target.value)}
                placeholder="Line 1, Utility Room..." />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {saving ? 'Menyimpan...' : machine ? 'Simpan Perubahan' : 'Tambah Mesin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── KPI Card (inside drawer) ──────────────────────────────────────────────
function KpiMini({ icon: Icon, label, value, sub, change, lowerIsBetter, color }) {
  const good = change == null ? null : (lowerIsBetter ? change < 0 : change > 0)
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={14} className="text-white"/>
        </div>
        {change != null && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${pctColor(change, lowerIsBetter)}`}>
            {change > 0 ? <TrendingUp size={9}/> : change < 0 ? <TrendingDown size={9}/> : <Minus size={9}/>}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-lg font-bold text-slate-800 leading-none">{value}</p>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Machine Detail Drawer ─────────────────────────────────────────────────
function MachineDetailDrawer({ id, onClose, onEdit }) {
  const [machine, setMachine]       = useState(null)
  const [stats, setStats]           = useState(null)
  const [chartData, setChartData]   = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      machinesApi.getById(id),
      machinesApi.getStats(id),
      machinesApi.getChartData(id),
    ]).then(([m, s, c]) => {
      setMachine(m.data)
      setStats(s.data)
      setChartData(c.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading || !machine) return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose}/>
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-300"/>
      </div>
    </>
  )

  const totalCat = chartData?.byCategory?.reduce((s,d)=>s+d.value,0) || 0

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose}/>
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-white/50 text-xs font-mono">{machine.machine_code}</p>
              <p className="font-bold text-white text-base mt-0.5">{machine.machine_name}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {machine.machine_type && (
                  <span className="text-[11px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">{machine.machine_type}</span>
                )}
                {machine.line && (
                  <span className="text-[11px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">Line: {machine.line}</span>
                )}
                {machine.location && (
                  <span className="flex items-center gap-1 text-[11px] text-white/60">
                    <MapPin size={10}/>{machine.location}
                  </span>
                )}
                {machine.department && (
                  <span className="flex items-center gap-1 text-[11px] text-white/60">
                    <Building2 size={10}/>{machine.department}
                  </span>
                )}
                <StatusBadge status={machine.status}/>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button onClick={() => onEdit(machine)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors">
                <Pencil size={14}/>
              </button>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X size={18}/>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* KPI row — 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiMini
              icon={AlertTriangle} label="Problem Bulan Ini"
              value={stats?.currentMonth.problems ?? '—'}
              sub={`vs ${stats?.previousMonth.problems ?? '?'} bulan lalu`}
              change={stats?.probChange} lowerIsBetter={true}
              color="bg-blue-500"
            />
            <KpiMini
              icon={Clock} label="Downtime Bulan Ini"
              value={fmtDur(stats?.currentMonth.downtime)}
              sub={`vs ${fmtDur(stats?.previousMonth.downtime)} bulan lalu`}
              change={stats?.dtChange} lowerIsBetter={true}
              color="bg-orange-400"
            />
            <KpiMini
              icon={Wrench} label="MTTR"
              value={fmtDur(stats?.mttr_minutes)}
              sub="Mean Time to Repair"
              change={null} color="bg-violet-500"
            />
            <KpiMini
              icon={BarChart3} label="MTBF"
              value={fmtHrs(stats?.mtbf_hours)}
              sub="Mean Time Between Failures"
              change={null} color="bg-emerald-500"
            />
          </div>

          {/* Charts row */}
          {chartData && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {/* 6-month bar chart */}
              <div className="sm:col-span-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-3">Trend Problem 6 Bulan</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData.monthly} margin={{ left: -20, right: 4, top: 4, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
                    <Bar dataKey="total"  name="Total"  fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={16}/>
                    <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[3,3,0,0]} maxBarSize={16}/>
                    <Legend iconType="circle" iconSize={6} formatter={v=><span style={{fontSize:10,color:'#64748b'}}>{v}</span>}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category pie chart */}
              <div className="sm:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-3">By Kategori</p>
                {totalCat === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-300">
                    <BarChart3 size={24} className="mb-1"/><p className="text-xs">No data</p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={100}>
                        <PieChart>
                          <Pie data={chartData.byCategory} cx="50%" cy="50%"
                            innerRadius="45%" outerRadius="70%" paddingAngle={3} dataKey="value">
                            {chartData.byCategory.map((d,i)=>(
                              <Cell key={i} fill={CAT_COLOR[d.name]||PALETTE[i%PALETTE.length]} stroke="none"/>
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize:10, borderRadius:8, border:'1px solid #e2e8f0' }}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1 mt-2">
                      {chartData.byCategory.slice(0,4).map((d,i)=>(
                        <div key={d.name} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0"
                            style={{background: CAT_COLOR[d.name]||PALETTE[i%PALETTE.length]}}/>
                          <span className="text-[10px] text-slate-600 truncate flex-1">{d.name}</span>
                          <span className="text-[10px] font-bold text-slate-700">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Problem History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Problem History ({machine.total_problems})
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">{machine.open_problems} aktif</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{fmtDur(machine.total_downtime)} total downtime</span>
              </div>
            </div>

            {machine.problems?.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-300">
                <CheckCircle2 size={28} className="mb-2"/>
                <p className="text-sm">Belum ada problem tercatat</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Tiket','Kategori','Status','Tanggal','Downtime','Teknisi'].map(h=>(
                        <th key={h} className="table-th text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {machine.problems.map(p=>(
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="table-td">
                          <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {p.ticket_number}
                          </span>
                        </td>
                        <td className="table-td"><CategoryBadge category={p.problem_category}/></td>
                        <td className="table-td"><StatusBadge status={p.status}/></td>
                        <td className="table-td text-[10px] text-slate-400">{fmtDate(p.reported_at)}</td>
                        <td className="table-td text-xs text-orange-600 font-medium">{fmtDur(p.downtime)}</td>
                        <td className="table-td text-[11px] text-slate-500">{p.technician||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Machine Card (card view) ──────────────────────────────────────────────
function MachineCard({ m, onClick, onEdit, onDelete }) {
  return (
    <div className="card hover:shadow-card-hover transition-all cursor-pointer group" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <HealthDot open={m.open_problems} status={m.status}/>
          <div className="min-w-0">
            <p className="font-bold text-blue-600 text-sm">{m.machine_code}</p>
            <p className="font-semibold text-slate-800 text-xs truncate">{m.machine_name}</p>
          </div>
        </div>
        <StatusBadge status={m.status}/>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {m.machine_type && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{m.machine_type}</span>}
        {m.line && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{m.line}</span>}
        {m.location && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <MapPin size={9}/>{m.location}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-base font-bold text-slate-800">{m.total_problems}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Problem</p>
        </div>
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className={`text-base font-bold ${m.open_problems > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{m.open_problems}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Aktif</p>
        </div>
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-base font-bold text-orange-500">{Math.round(m.total_downtime/60)}j</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Downtime</p>
        </div>
      </div>

      {m.last_problem_at && (
        <p className="text-[10px] text-slate-400 mb-3">
          Terakhir: {fmtDate(m.last_problem_at)}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button className="p-1.5 hover:bg-amber-50 rounded text-amber-500" onClick={() => onEdit(m)}><Pencil size={13}/></button>
          <button className="p-1.5 hover:bg-red-50 rounded text-red-400" onClick={() => onDelete(m)}><Trash2 size={13}/></button>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">Detail <ChevronRight size={12}/></span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN MACHINES PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function Machines() {
  const [machines, setMachines]   = useState([])
  const [meta, setMeta]           = useState({ types: [], locations: [], depts: [] })
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('card')   // 'card' | 'table'

  const [search, setSearch]       = useState('')
  const [filters, setFilters]     = useState({ type: '', location: '', status: '' })

  const [drawerID, setDrawerID]   = useState(null)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      ...filters.type     && { type:     filters.type },
      ...filters.location && { location: filters.location },
      ...filters.status   && { status:   filters.status },
      ...search           && { search },
    }
    machinesApi.getAll(params)
      .then(r => { setMachines(r.data); setLoading(false) })
      .catch(() => { showToast('Gagal memuat data', 'error'); setLoading(false) })
  }, [filters, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    machinesApi.getMeta().then(r => setMeta(r.data)).catch(() => {})
  }, [])

  const handleSave = async (data) => {
    if (editItem) {
      await machinesApi.update(editItem.id, data)
      showToast('Mesin berhasil diperbarui')
    } else {
      await machinesApi.create(data)
      showToast('Mesin berhasil ditambahkan')
    }
    setShowForm(false); setEditItem(null)
    load()
    // Also refresh drawer if it's the edited machine
    if (editItem && drawerID === editItem.id) setDrawerID(null)
  }

  const handleDelete = async (m) => {
    const hasProblems = m.total_problems > 0
    const msg = hasProblems
      ? `Hapus mesin ${m.machine_code} — ${m.machine_name}?\n\n⚠ Mesin ini memiliki ${m.total_problems} histori problem.\nHistori problem akan tetap tersimpan, namun tidak terhubung ke mesin ini.`
      : `Hapus mesin ${m.machine_code} — ${m.machine_name}?`
    if (!window.confirm(msg)) return
    try {
      const res = await machinesApi.delete(m.id)
      if (drawerID === m.id) setDrawerID(null)
      load()
      const info = res.data?.problems_detached > 0 ? ` (${res.data.problems_detached} histori problem dipertahankan)` : ''
      showToast(`Mesin ${m.machine_code} berhasil dihapus${info}`)
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus mesin', 'error')
    }
  }

  const openEdit = (m) => { setEditItem(m); setShowForm(true) }
  const hasFilters = search || filters.type || filters.location || filters.status

  // Stats
  const active   = machines.filter(m => m.status === 'active').length
  const withOpen = machines.filter(m => m.open_problems > 0).length
  const totalDT  = machines.reduce((s, m) => s + m.total_downtime, 0)

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Total Mesin', val: machines.length, color: 'text-slate-700' },
            { label: 'Aktif',       val: active,          color: 'text-emerald-600' },
            { label: 'Bermasalah',  val: withOpen,        color: 'text-red-500' },
            { label: 'Total Downtime', val: `${Math.round(totalDT/60)}j`, color: 'text-orange-500' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-card">
              <p className={`text-xl font-bold ${color}`}>{val}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
            <button onClick={() => setView('card')}
              className={`p-2.5 transition-colors ${view==='card' ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutGrid size={15}/>
            </button>
            <button onClick={() => setView('table')}
              className={`p-2.5 transition-colors ${view==='table' ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Table2 size={15}/>
            </button>
          </div>
          <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
            <Plus size={15}/> Tambah Mesin
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="card !p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input !pl-8 text-sm" placeholder="Cari kode atau nama mesin..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input w-40 text-sm" value={filters.type} onChange={e => setF('type', e.target.value)}>
          <option value="">Semua Tipe</option>
          {meta.types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-40 text-sm" value={filters.location} onChange={e => setF('location', e.target.value)}>
          <option value="">Semua Lokasi</option>
          {meta.locations.map(l => <option key={l}>{l}</option>)}
        </select>
        <select className="input w-32 text-sm" value={filters.status} onChange={e => setF('status', e.target.value)}>
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {hasFilters && (
          <button className="btn-secondary text-xs text-red-500" onClick={() => { setSearch(''); setFilters({ type:'', location:'', status:'' }) }}>
            <X size={12}/> Reset
          </button>
        )}
      </div>

      {/* ── Card View ───────────────────────────────────────────────── */}
      {view === 'card' && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i) => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="h-4 bg-slate-100 rounded w-2/3"/>
                <div className="h-3 bg-slate-100 rounded w-full"/>
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(3)].map((_,j) => <div key={j} className="h-10 bg-slate-100 rounded-lg"/>)}
                </div>
              </div>
            ))}
          </div>
        ) : machines.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-300">
            <Cpu size={40} className="mb-3"/><p className="text-slate-400 text-sm">Tidak ada mesin ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {machines.map(m => (
              <MachineCard key={m.id} m={m}
                onClick={() => setDrawerID(m.id)}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      )}

      {/* ── Table View ──────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Kode','Nama Mesin','Tipe','Line','Lokasi','Dept','Status','Problem','Aktif','Downtime','Aksi'].map(h=>(
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? [...Array(6)].map((_,i)=>(
                  <tr key={i}>{[...Array(11)].map((_,j)=>(
                    <td key={j} className="table-td"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>
                  ))}</tr>
                )) : machines.map(m=>(
                  <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>setDrawerID(m.id)}>
                    <td className="table-td font-bold text-blue-600 text-xs">{m.machine_code}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <HealthDot open={m.open_problems} status={m.status}/>
                        <span className="text-sm font-medium">{m.machine_name}</span>
                      </div>
                    </td>
                    <td className="table-td text-xs text-slate-500">{m.machine_type||'—'}</td>
                    <td className="table-td text-xs text-slate-500">{m.line||'—'}</td>
                    <td className="table-td text-xs text-slate-500">{m.location||'—'}</td>
                    <td className="table-td text-xs text-slate-500">{m.department||'—'}</td>
                    <td className="table-td"><StatusBadge status={m.status}/></td>
                    <td className="table-td text-sm font-semibold text-slate-700">{m.total_problems}</td>
                    <td className="table-td">
                      <span className={`text-sm font-bold ${m.open_problems > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {m.open_problems}
                      </span>
                    </td>
                    <td className="table-td text-xs text-orange-600 font-medium">{fmtDur(m.total_downtime)}</td>
                    <td className="table-td" onClick={e=>e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button className="p-1.5 hover:bg-amber-50 rounded text-amber-500" onClick={()=>openEdit(m)}><Pencil size={13}/></button>
                        <button className="p-1.5 hover:bg-red-50 rounded text-red-400" onClick={()=>handleDelete(m)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals/Drawer ─────────────────────────────────────────────────── */}
      {showForm && (
        <MachineFormModal machine={editItem} onSave={handleSave} onClose={() => { setShowForm(false); setEditItem(null) }}/>
      )}
      {drawerID && (
        <MachineDetailDrawer
          id={drawerID}
          onClose={() => setDrawerID(null)}
          onEdit={(m) => { setDrawerID(null); openEdit(m) }}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  )
}
