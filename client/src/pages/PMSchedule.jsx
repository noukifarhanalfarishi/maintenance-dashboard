import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, X,
  Pencil, Trash2, CheckCircle2, AlertTriangle, Loader2, Save, Clock,
  ChevronUp, ChevronDown, ChevronsUpDown, Wrench,
} from 'lucide-react'
import { pmSchedulesApi, machinesApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { CategoryBadge } from '../components/Badge'

// ══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const PM_TYPES = ['Daily Check', 'Weekly PM', 'Monthly PM', '3-Monthly PM', '6-Monthly PM', 'Yearly PM', 'Overhaul']
const DEFAULT_INTERVAL = {
  'Daily Check': 1, 'Weekly PM': 7, 'Monthly PM': 30,
  '3-Monthly PM': 90, '6-Monthly PM': 180, 'Yearly PM': 365, 'Overhaul': 365,
}
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DOW = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
const SHIFT_CFG = { 1: '06:00–14:00', 2: '14:00–22:00', 3: '22:00–06:00' }

function getActiveShift(date = new Date()) {
  const h = date.getHours()
  if (h >= 6 && h < 14) return 1
  if (h >= 14 && h < 22) return 2
  return 3
}

const pad = (n) => String(n).padStart(2, '0')
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayStr = () => toDateStr(new Date())
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function pmStatus(sched) {
  if (!sched.is_active) return 'Inactive'
  if (!sched.next_due_date) return 'On Track'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(sched.next_due_date)
  const diffDays = Math.round((due - today) / 86400000)
  if (diffDays < 0) return 'Overdue'
  if (diffDays <= 3) return 'Due Soon'
  return 'On Track'
}

const STATUS_STYLE = {
  'On Track':  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'Due Soon':  'bg-amber-100   text-amber-700   border border-amber-200',
  'Overdue':   'bg-red-100     text-red-700     border border-red-200',
  'Inactive':  'bg-slate-100   text-slate-500   border border-slate-200',
}

function PmStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>
      {type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {msg}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PM FORM MODAL (add/edit)
// ══════════════════════════════════════════════════════════════════════════
function PMFormModal({ schedule, machines, onSave, onClose }) {
  const [form, setForm] = useState(schedule ? {
    machine_id: schedule.machine_id, pm_type: schedule.pm_type,
    description: schedule.description || '', interval_days: schedule.interval_days,
    last_done_date: schedule.last_done_date || '', next_due_date: schedule.next_due_date || '',
    assigned_to: schedule.assigned_to || '', is_active: !!schedule.is_active,
  } : {
    machine_id: '', pm_type: PM_TYPES[0], description: '', interval_days: DEFAULT_INTERVAL[PM_TYPES[0]],
    last_done_date: '', next_due_date: todayStr(), assigned_to: '', is_active: true,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const setPmType = (t) => {
    setForm(f => ({ ...f, pm_type: t, interval_days: DEFAULT_INTERVAL[t] ?? f.interval_days }))
  }

  const validate = () => {
    const e = {}
    if (!form.machine_id) e.machine_id = 'Wajib diisi'
    if (!form.pm_type) e.pm_type = 'Wajib diisi'
    if (!form.interval_days || form.interval_days <= 0) e.interval_days = 'Harus > 0'
    if (!form.next_due_date) e.next_due_date = 'Wajib diisi'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({
        machine_id: parseInt(form.machine_id), pm_type: form.pm_type, description: form.description || null,
        interval_days: parseInt(form.interval_days), last_done_date: form.last_done_date || null,
        next_due_date: form.next_due_date, assigned_to: form.assigned_to || null, is_active: form.is_active ? 1 : 0,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <p className="font-bold text-white">{schedule ? 'Edit' : 'Tambah'} PM Schedule</p>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Mesin *</label>
            <select className={`input ${errors.machine_id ? 'border-red-400' : ''}`}
              value={form.machine_id} onChange={e => set('machine_id', e.target.value)}>
              <option value="">— Pilih —</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.machine_name ? `${m.machine_code} — ${m.machine_name}` : m.machine_code}</option>)}
            </select>
            {errors.machine_id && <p className="text-red-500 text-xs mt-1">{errors.machine_id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipe PM *</label>
              <select className="input" value={form.pm_type} onChange={e => setPmType(e.target.value)}>
                {PM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Interval (hari) *</label>
              <input type="number" min={1} className={`input ${errors.interval_days ? 'border-red-400' : ''}`}
                value={form.interval_days} onChange={e => set('interval_days', e.target.value)} />
              {errors.interval_days && <p className="text-red-500 text-xs mt-1">{errors.interval_days}</p>}
            </div>
          </div>
          <div>
            <label className="label">Deskripsi Standar Pekerjaan</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="Standar pekerjaan PM ini..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Last Done Date</label>
              <input type="date" className="input" value={form.last_done_date}
                onChange={e => set('last_done_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Start Date / Next Due *</label>
              <input type="date" className={`input ${errors.next_due_date ? 'border-red-400' : ''}`}
                value={form.next_due_date} onChange={e => set('next_due_date', e.target.value)} />
              {errors.next_due_date && <p className="text-red-500 text-xs mt-1">{errors.next_due_date}</p>}
            </div>
          </div>
          <div>
            <label className="label">Assigned To (teknisi default)</label>
            <input className="input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Nama teknisi" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            <span className="text-sm text-slate-600">Status Aktif</span>
          </label>
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Menyimpan...' : schedule ? 'Simpan Perubahan' : 'Tambah Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// OVERDUE ALERT BANNER
// ══════════════════════════════════════════════════════════════════════════
function OverdueBanner({ items, onMarkDone, marking }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(x => !x)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} /> ⚠️ {items.length} PM overdue — klik untuk lihat detail
        </span>
        {expanded ? <ChevronUp size={14} className="text-red-500" /> : <ChevronDown size={14} className="text-red-500" />}
      </button>
      {expanded && (
        <div className="border-t border-red-100 divide-y divide-red-100">
          {items.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700">{s.machine_code} — {s.machine_name}</p>
                <p className="text-[11px] text-slate-500">{s.pm_type} · jatuh tempo {fmtDate(s.next_due_date)}</p>
              </div>
              <button onClick={() => onMarkDone(s)} disabled={marking === s.id}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shrink-0 ml-3">
                {marking === s.id ? <Loader2 size={11} className="animate-spin inline" /> : 'Mark Done'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// CALENDAR VIEW (custom-built, no external library)
// ══════════════════════════════════════════════════════════════════════════
function CalendarView({ schedules, month, onPrevMonth, onNextMonth, selectedDate, onSelectDate, onMarkDone, marking, canManage }) {
  const year = month.getFullYear(), mon = month.getMonth()
  const firstDow = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const today = todayStr()

  // Map: dateStr -> { done: [...], due: [...] }
  const byDate = useMemo(() => {
    const map = {}
    const ensure = (d) => (map[d] ||= { done: [], due: [] })
    schedules.forEach(s => {
      if (s.last_done_date) ensure(s.last_done_date).done.push(s)
      if (s.next_due_date) ensure(s.next_due_date).due.push(s)
    })
    return map
  }, [schedules])

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedItems = selectedDate ? (byDate[selectedDate] || { done: [], due: [] }) : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="card lg:col-span-2 !p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-navy-900">{MONTH_NAMES[mon]} {year}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={onPrevMonth} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><ChevronLeft size={15} /></button>
            <button onClick={onNextMonth} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DOW.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="aspect-square" />
            const dateStr = `${year}-${pad(mon + 1)}-${pad(d)}`
            const info = byDate[dateStr]
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const doneCount = info?.done.length || 0
            const overdueCount = info ? info.due.filter(s => dateStr < today).length : 0
            const upcomingCount = info ? info.due.filter(s => dateStr >= today).length : 0
            return (
              <button key={i} onClick={() => onSelectDate(dateStr)}
                className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start transition-colors ${
                  isSelected ? 'border-navy-900 bg-navy-900/5' : isToday ? 'border-accent/50 bg-accent/5' : 'border-slate-100 hover:bg-slate-50'
                }`}>
                <span className={`text-[11px] font-semibold ${isToday ? 'text-accent' : 'text-slate-600'}`}>{d}</span>
                <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                  {doneCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${doneCount} selesai`} />}
                  {upcomingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${upcomingCount} dijadwalkan`} />}
                  {overdueCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title={`${overdueCount} overdue`} />}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sudah dikerjakan</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Dijadwalkan / upcoming</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
        </div>
      </div>

      {/* Side panel — detail tanggal terpilih */}
      <div className="card !p-4">
        <p className="font-bold text-navy-900 text-sm mb-3">
          {selectedDate ? fmtDate(selectedDate) : 'Pilih tanggal'}
        </p>
        {!selectedDate ? (
          <p className="text-xs text-slate-400">Klik tanggal pada kalender untuk melihat jadwal PM.</p>
        ) : (selectedItems.done.length === 0 && selectedItems.due.length === 0) ? (
          <p className="text-xs text-slate-400">Tidak ada jadwal PM pada tanggal ini.</p>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {selectedItems.due.map(s => (
              <div key={`due-${s.id}`} className="border border-slate-100 rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">{s.machine_code}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.machine_name}</p>
                  </div>
                  <PmStatusBadge status={pmStatus(s)} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <CategoryBadge category={s.pm_type} />
                  {canManage !== false && selectedDate <= today && (
                    <button onClick={() => onMarkDone(s)} disabled={marking === s.id}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50">
                      {marking === s.id ? <Loader2 size={10} className="animate-spin inline" /> : 'Mark Done'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {selectedItems.done.map(s => (
              <div key={`done-${s.id}`} className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">{s.machine_code}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.machine_name}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><CheckCircle2 size={11} /> Selesai</span>
                </div>
                <div className="mt-1.5"><CategoryBadge category={s.pm_type} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ══════════════════════════════════════════════════════════════════════════
function SortTH({ label, field, sort, onSort }) {
  const active = sort.by === field
  return (
    <th className="table-th cursor-pointer select-none group whitespace-nowrap" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? 'text-navy-900' : 'text-slate-300 group-hover:text-slate-400'}>
          {active ? (sort.order === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
        </span>
      </span>
    </th>
  )
}

function ListView({ schedules, onEdit, onDelete, onMarkDone, marking, canManage }) {
  const [sort, setSort] = useState({ by: 'next_due_date', order: 'asc' })
  const handleSort = (field) => setSort(s => s.by === field ? { by: field, order: s.order === 'asc' ? 'desc' : 'asc' } : { by: field, order: 'asc' })

  const sorted = useMemo(() => {
    const arr = [...schedules]
    arr.sort((a, b) => {
      let av = a[sort.by], bv = b[sort.by]
      if (sort.by === 'status') { av = pmStatus(a); bv = pmStatus(b) }
      if (av == null) av = ''
      if (bv == null) bv = ''
      if (av < bv) return sort.order === 'asc' ? -1 : 1
      if (av > bv) return sort.order === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [schedules, sort])

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <SortTH label="Mesin" field="machine_code" sort={sort} onSort={handleSort} />
              <SortTH label="Tipe PM" field="pm_type" sort={sort} onSort={handleSort} />
              <SortTH label="Interval" field="interval_days" sort={sort} onSort={handleSort} />
              <SortTH label="Last Done" field="last_done_date" sort={sort} onSort={handleSort} />
              <SortTH label="Next Due" field="next_due_date" sort={sort} onSort={handleSort} />
              <SortTH label="Status" field="status" sort={sort} onSort={handleSort} />
              <SortTH label="Assigned To" field="assigned_to" sort={sort} onSort={handleSort} />
              <th className="table-th w-32">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="table-td text-center py-16">
                <Wrench size={30} className="mx-auto mb-2 text-slate-200" />
                <p className="text-slate-400 text-sm">Belum ada jadwal PM. Buat jadwal untuk memulai.</p>
              </td></tr>
            ) : sorted.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="table-td">
                  <p className="text-xs font-bold text-slate-700">{s.machine_code}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{s.machine_name}</p>
                </td>
                <td className="table-td"><CategoryBadge category={s.pm_type} /></td>
                <td className="table-td text-xs text-slate-600">{s.interval_days} hari</td>
                <td className="table-td text-xs text-slate-500">{fmtDate(s.last_done_date)}</td>
                <td className="table-td text-xs text-slate-500">{fmtDate(s.next_due_date)}</td>
                <td className="table-td"><PmStatusBadge status={pmStatus(s)} /></td>
                <td className="table-td text-xs text-slate-600">{s.assigned_to || '—'}</td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onMarkDone(s)} disabled={marking === s.id}
                      className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600 transition-colors disabled:opacity-40" title="Mark as Done">
                      {marking === s.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => onEdit(s)} className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete(s)} className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors" title="Hapus">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function PMSchedule() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const canManage = user?.role === 'Admin' || user?.role === 'Supervisor'

  const [schedules, setSchedules] = useState([])
  const [machines, setMachines]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('calendar') // 'calendar' | 'list'
  const [month, setMonth]         = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate, setSelectedDate] = useState(null)

  const [filters, setFilters] = useState({ machine_id: '', pm_type: '' })
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [marking, setMarking]   = useState(false)
  const [toast, setToast]       = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const load = useCallback(() => {
    setLoading(true)
    const params = {
      ...(filters.machine_id && { machine_id: filters.machine_id }),
      ...(filters.pm_type && { pm_type: filters.pm_type }),
    }
    pmSchedulesApi.getAll(params)
      .then(r => setSchedules(r.data))
      .catch(() => showToast('Gagal memuat data PM schedule', 'error'))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])
  useEffect(() => { machinesApi.getAll().then(r => setMachines(r.data)).catch(() => {}) }, [])

  const overdueItems = useMemo(() => schedules.filter(s => s.is_active && pmStatus(s) === 'Overdue'), [schedules])

  const handleMarkDone = async (sched) => {
    const ok = await confirm({
      title: 'Tandai PM Selesai?',
      message: `Tandai PM selesai untuk ${sched.machine_code} — ${sched.pm_type}?`,
      type: 'info',
    })
    if (!ok) return
    setMarking(sched.id)
    try {
      await pmSchedulesApi.complete(sched.id, {
        shift: getActiveShift(),
        technician: sched.assigned_to || user?.full_name || 'Teknisi',
        reported_by: user?.full_name || '',
      })
      await load()
      showToast(`PM ${sched.pm_type} untuk ${sched.machine_code} ditandai selesai`, 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal update PM schedule', 'error')
    } finally { setMarking(false) }
  }

  const handleSave = async (data) => {
    if (editItem) {
      await pmSchedulesApi.update(editItem.id, data)
      showToast('PM schedule berhasil diperbarui')
    } else {
      await pmSchedulesApi.create(data)
      showToast('PM schedule berhasil ditambahkan')
    }
    setShowForm(false); setEditItem(null)
    load()
  }

  const handleDelete = async (sched) => {
    const ok = await confirm({
      title: `Hapus jadwal PM?`,
      message: `Jadwal ${sched.pm_type} untuk ${sched.machine_code} akan dihapus permanen.`,
      type: 'danger',
    })
    if (!ok) return
    try {
      await pmSchedulesApi.delete(sched.id)
      load()
      showToast('PM schedule berhasil dihapus')
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus jadwal', 'error')
    }
  }

  const openEdit = (s) => { setEditItem(s); setShowForm(true) }
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="card !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">PM Schedule</p>
          <p className="text-xl font-bold text-navy-900 leading-tight mt-0.5">Jadwal Preventive Maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            <button onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'calendar' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'}`}>
              <CalendarIcon size={13} /> Calendar
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'list' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={13} /> List
            </button>
          </div>
          {canManage && (
            <button onClick={() => { setEditItem(null); setShowForm(true) }} className="btn-primary">
              <Plus size={15} /> Add PM Schedule
            </button>
          )}
        </div>
      </div>

      {/* ── Overdue Alert ──────────────────────────────────────────────── */}
      <OverdueBanner items={overdueItems} onMarkDone={handleMarkDone} marking={marking} />

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="card !p-3 flex flex-wrap gap-2 items-center">
        <select className="input w-56 text-sm" value={filters.machine_id} onChange={e => setF('machine_id', e.target.value)}>
          <option value="">Semua Mesin</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.machine_name ? `${m.machine_code} — ${m.machine_name}` : m.machine_code}</option>)}
        </select>
        <select className="input w-44 text-sm" value={filters.pm_type} onChange={e => setF('pm_type', e.target.value)}>
          <option value="">Semua Tipe PM</option>
          {PM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        {(filters.machine_id || filters.pm_type) && (
          <button className="btn-secondary text-xs text-red-500" onClick={() => setFilters({ machine_id: '', pm_type: '' })}>
            <X size={12} /> Reset
          </button>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card h-96 animate-pulse bg-slate-50" />
      ) : view === 'calendar' ? (
        <CalendarView
          schedules={schedules}
          month={month}
          onPrevMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          onNextMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMarkDone={handleMarkDone}
          marking={marking}
          canManage={canManage}
        />
      ) : (
        <ListView schedules={schedules} onEdit={openEdit} onDelete={handleDelete} onMarkDone={handleMarkDone} marking={marking} canManage={canManage} />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showForm && (
        <PMFormModal schedule={editItem} machines={machines} onSave={handleSave} onClose={() => { setShowForm(false); setEditItem(null) }} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
