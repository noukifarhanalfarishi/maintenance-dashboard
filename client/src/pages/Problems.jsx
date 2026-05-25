import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, X, Filter, ChevronUp, ChevronDown, ChevronsUpDown,
  Pencil, Trash2, Eye, AlertCircle, CheckCircle2, Clock, Wrench,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, Package,
  ChevronDown as ChevDown, Save, RotateCcw,
} from 'lucide-react'
import { problemsApi, machinesApi, sparePartsApi } from '../api/client'
import { StatusBadge, CategoryBadge, ActionBadge } from '../components/Badge'

// ══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const STATUSES   = ['Open', 'In Progress', 'Pending Part', 'Closed']
const CATEGORIES = ['Mechanical', 'Electrical', 'Pneumatic', 'Hydraulic', 'Software', 'Other']
const ACTION_TYPES = ['Corrective', 'Preventive', 'Predictive']
const IS_REPEAT_OPTS = [{ v: 'R', label: 'Repeat' }, { v: 'N', label: 'Baru' }]
const PAGE_SIZE  = 20

const STATUS_CFG = {
  'Open':         { dot: 'bg-red-500',    ring: 'ring-red-200'    },
  'In Progress':  { dot: 'bg-amber-400',  ring: 'ring-amber-200'  },
  'Pending Part': { dot: 'bg-sky-400',    ring: 'ring-sky-200'    },
  'Closed':       { dot: 'bg-emerald-500',ring: 'ring-emerald-200'},
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDt   = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDur  = (m) => { if (!m) return '—'; const h = Math.floor(m/60); return h > 0 ? `${h}j ${m%60}m` : `${m}m` }
const calcDT  = (s, e) => {
  if (!s || !e) return null
  const diff = Math.floor((new Date(e) - new Date(s)) / 60000)
  return diff > 0 ? diff : null
}

// ══════════════════════════════════════════════════════════════════════════
// SORT HEADER
// ══════════════════════════════════════════════════════════════════════════
function SortTH({ label, field, sort, onSort, className = '' }) {
  const active = sort.by === field
  return (
    <th
      className={`table-th cursor-pointer select-none group whitespace-nowrap ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-colors ${active ? 'text-navy-900' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {active
            ? sort.order === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
            : <ChevronsUpDown size={12} />
          }
        </span>
      </span>
    </th>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// SPARE PARTS MULTI-SELECT
// ══════════════════════════════════════════════════════════════════════════
function SparePartsSelect({ parts, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = parts.filter(p =>
    p.part_name.toLowerCase().includes(q.toLowerCase()) ||
    p.part_code.toLowerCase().includes(q.toLowerCase())
  )

  const toggle = (code) =>
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input text-left flex items-center justify-between"
      >
        <span className={selected.length ? 'text-slate-700' : 'text-slate-400'}>
          {selected.length ? `${selected.length} part dipilih` : 'Pilih spare parts yang digunakan...'}
        </span>
        <ChevDown size={14} className="text-slate-400 shrink-0 ml-2" />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(code => {
            const p = parts.find(x => x.part_code === code)
            return p ? (
              <span key={code} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                {p.part_name}
                <button type="button" onClick={() => toggle(code)} className="hover:text-blue-900"><X size={10} /></button>
              </span>
            ) : null
          })}
        </div>
      )}

      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <input
              className="input !py-1.5 text-xs"
              placeholder="Cari part..."
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-slate-400 text-center py-4">Tidak ada spare part</p>
              : filtered.map(p => (
                  <label key={p.part_code} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.part_code)}
                      onChange={() => toggle(p.part_code)}
                      className="rounded"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700">{p.part_name}</p>
                      <p className="text-[10px] text-slate-400">{p.part_code} — Stok: {p.stock_quantity} {p.unit}</p>
                    </div>
                  </label>
                ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white animate-[fadeIn_.2s_ease] ${
      type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
    }`}>
      {type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      {msg}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// NEW PROBLEM MODAL
// ══════════════════════════════════════════════════════════════════════════
function NewProblemModal({ machines, onSave, onClose }) {
  const nowLocal = () => {
    const d = new Date()
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
  }
  const INIT = { machine_id: '', problem_category: 'Mechanical', is_repeat: 'R', description: '', reported_by: '', reported_at: nowLocal() }
  const [form, setForm] = useState(INIT)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!form.problem_category) e.problem_category = 'Wajib diisi'
    if (!form.description.trim()) e.description = 'Wajib diisi'
    if (!form.reported_by.trim()) e.reported_by = 'Wajib diisi'
    if (!form.reported_at) e.reported_at = 'Wajib diisi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      // Convert datetime-local value (YYYY-MM-DDTHH:MM) to DB-compatible string
      const reported_at = form.reported_at ? form.reported_at.replace('T', ' ') + ':00' : null
      await onSave({ ...form, machine_id: form.machine_id || null, reported_at })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Lapor Problem Baru</p>
            <p className="text-white/50 text-xs mt-0.5">Tiket akan di-generate otomatis</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Machine */}
          <div>
            <label className="label">Mesin</label>
            <select className="input" value={form.machine_id} onChange={e => set('machine_id', e.target.value)}>
              <option value="">— Tanpa mesin spesifik —</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.machine_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kategori *</label>
              <select className={`input ${errors.problem_category ? 'border-red-400' : ''}`}
                value={form.problem_category} onChange={e => set('problem_category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              {errors.problem_category && <p className="text-red-500 text-xs mt-1">{errors.problem_category}</p>}
            </div>
            <div>
              <label className="label">Jenis</label>
              <select className="input" value={form.is_repeat} onChange={e => set('is_repeat', e.target.value)}>
                {IS_REPEAT_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="label">Tanggal &amp; Waktu Lapor *</label>
            <input
              type="datetime-local"
              className={`input ${errors.reported_at ? 'border-red-400' : ''}`}
              value={form.reported_at}
              onChange={e => set('reported_at', e.target.value)}
            />
            {errors.reported_at && <p className="text-red-500 text-xs mt-1">{errors.reported_at}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Deskripsi Problem *</label>
            <textarea
              className={`input resize-none ${errors.description ? 'border-red-400' : ''}`}
              rows={3} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Jelaskan masalah yang terjadi secara ringkas..."
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Reported by */}
          <div>
            <label className="label">Dilaporkan Oleh *</label>
            <input
              className={`input ${errors.reported_by ? 'border-red-400' : ''}`}
              value={form.reported_by}
              onChange={e => set('reported_by', e.target.value)}
              placeholder="Nama pelapor"
            />
            {errors.reported_by && <p className="text-red-500 text-xs mt-1">{errors.reported_by}</p>}
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Menyimpan...' : 'Buat Tiket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// REPAIR FORM PANEL (inside drawer)
// ══════════════════════════════════════════════════════════════════════════
function RepairFormPanel({ spareParts, onSave, onCancel }) {
  const INIT = {
    action_type: 'Corrective', action_description: '', technician: '',
    start_time: '', end_time: '', downtime_minutes: '', notes: '',
    spare_parts_used: [], update_status: '',
  }
  const [form, setForm] = useState(INIT)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  // Auto-calc downtime
  useEffect(() => {
    const dt = calcDT(form.start_time, form.end_time)
    if (dt !== null) setForm(f => ({ ...f, downtime_minutes: String(dt) }))
  }, [form.start_time, form.end_time])

  const validate = () => {
    const e = {}
    if (!form.action_type)          e.action_type = 'Wajib diisi'
    if (!form.action_description.trim()) e.action_description = 'Wajib diisi'
    if (!form.technician.trim())    e.technician = 'Wajib diisi'
    if (!form.start_time)           e.start_time = 'Wajib diisi'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        downtime_minutes: form.downtime_minutes ? parseInt(form.downtime_minutes) : null,
        spare_parts_used: form.spare_parts_used,
        update_status: form.update_status || undefined,
      })
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-navy-900 uppercase tracking-wide flex items-center gap-1.5">
        <Wrench size={13} /> Tambah Repair Action
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tipe Tindakan *</label>
          <select className={`input text-xs ${errors.action_type ? 'border-red-400' : ''}`}
            value={form.action_type} onChange={e => set('action_type', e.target.value)}>
            {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Teknisi *</label>
          <input className={`input text-xs ${errors.technician ? 'border-red-400' : ''}`}
            value={form.technician} onChange={e => set('technician', e.target.value)}
            placeholder="Nama teknisi" />
          {errors.technician && <p className="text-red-500 text-[10px] mt-0.5">{errors.technician}</p>}
        </div>
      </div>

      <div>
        <label className="label">Deskripsi Tindakan *</label>
        <textarea
          className={`input text-xs resize-none ${errors.action_description ? 'border-red-400' : ''}`}
          rows={2} value={form.action_description}
          onChange={e => set('action_description', e.target.value)}
          placeholder="Tindakan yang dilakukan..."
        />
        {errors.action_description && <p className="text-red-500 text-[10px] mt-0.5">{errors.action_description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Waktu Mulai *</label>
          <input type="datetime-local" className={`input text-xs ${errors.start_time ? 'border-red-400' : ''}`}
            value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          {errors.start_time && <p className="text-red-500 text-[10px] mt-0.5">{errors.start_time}</p>}
        </div>
        <div>
          <label className="label">Waktu Selesai</label>
          <input type="datetime-local" className="input text-xs"
            value={form.end_time} onChange={e => set('end_time', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label flex items-center gap-1">
            Downtime (menit)
            {form.start_time && form.end_time && (
              <span className="text-emerald-600 font-normal normal-case tracking-normal">(auto)</span>
            )}
          </label>
          <input type="number" className="input text-xs" min="0"
            value={form.downtime_minutes}
            onChange={e => set('downtime_minutes', e.target.value)}
            placeholder="0" />
        </div>
        <div>
          <label className="label">Update Status Problem</label>
          <select className="input text-xs" value={form.update_status} onChange={e => set('update_status', e.target.value)}>
            <option value="">— Tidak update —</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Spare Parts Digunakan</label>
        <SparePartsSelect parts={spareParts} selected={form.spare_parts_used}
          onChange={v => set('spare_parts_used', v)} />
      </div>

      <div>
        <label className="label">Catatan</label>
        <textarea className="input text-xs resize-none" rows={2}
          value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Temuan atau catatan tambahan..." />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-secondary flex-1 text-xs justify-center" onClick={onCancel}>Batal</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 text-xs justify-center">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Menyimpan...' : 'Simpan Repair'}
        </button>
      </div>
    </form>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════════════════════════════════════════
function Timeline({ problem, repairs }) {
  const events = [
    { time: problem.reported_at, icon: AlertCircle,  color: 'bg-blue-100  text-blue-600',   title: 'Problem Dilaporkan',   sub: `oleh ${problem.reported_by}` },
    ...repairs.flatMap((r, i) => {
      const evts = [{ time: r.start_time, icon: Wrench, color: 'bg-orange-100 text-orange-600', title: `Perbaikan #${i+1} Dimulai`, sub: `${r.technician} — ${r.action_type}` }]
      if (r.end_time) evts.push({ time: r.end_time, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', title: `Perbaikan #${i+1} Selesai`, sub: r.downtime_minutes ? `Downtime: ${r.downtime_minutes} menit` : 'Selesai' })
      return evts
    }),
    ...(problem.closed_at ? [{ time: problem.closed_at, icon: CheckCircle2, color: 'bg-emerald-200 text-emerald-700', title: 'Problem Ditutup', sub: '' }] : []),
  ].filter(e => e.time).sort((a, b) => new Date(a.time) - new Date(b.time))

  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${e.color}`}>
              <e.icon size={13} />
            </div>
            {i < events.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" style={{ minHeight: 16 }} />}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-xs font-semibold text-slate-700">{e.title}</p>
            {e.sub && <p className="text-[11px] text-slate-500">{e.sub}</p>}
            <p className="text-[10px] text-slate-400 mt-0.5">{fmtDt(e.time)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PROBLEM DETAIL DRAWER
// ══════════════════════════════════════════════════════════════════════════
function ProblemDrawer({ id, spareParts, onClose, onRefresh, showToast }) {
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showRepairForm, setShowRepairForm] = useState(false)
  const [editRC, setEditRC] = useState(false)
  const [rcValue, setRcValue] = useState('')
  const [savingRC, setSavingRC] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await problemsApi.getById(id)
      setProblem(r.data)
      setRcValue(r.data.root_cause || '')
    } catch { showToast('Gagal memuat detail problem', 'error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (status) => {
    setSavingStatus(status)
    try {
      await problemsApi.patch(id, { status })
      await load()
      onRefresh()
      showToast(`Status diubah ke "${status}"`, 'success')
    } catch { showToast('Gagal update status', 'error') }
    finally { setSavingStatus(false) }
  }

  const handleSaveRC = async () => {
    setSavingRC(true)
    try {
      await problemsApi.patch(id, { root_cause: rcValue })
      await load()
      setEditRC(false)
      showToast('Root cause disimpan', 'success')
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSavingRC(false) }
  }

  const handleAddRepair = async (data) => {
    await problemsApi.addRepair(id, data)
    await load()
    onRefresh()
    setShowRepairForm(false)
    showToast('Repair action berhasil ditambahkan', 'success')
  }

  if (!problem && loading) return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-slate-300" />
    </div>
  )
  if (!problem) return null

  const cfg = STATUS_CFG[problem.status] || {}
  const totalDT = problem.repairs.reduce((s, r) => s + (r.downtime_minutes || 0), 0)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="bg-navy-900 px-6 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-white/50">{problem.ticket_number}</p>
              <p className="text-white font-bold text-sm mt-0.5 leading-snug line-clamp-2">{problem.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <CategoryBadge category={problem.problem_category} />
                {problem.machine_code && (
                  <span className="text-[11px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    {problem.machine_code} — {problem.machine_name}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white ml-3 shrink-0 mt-0.5">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Status Bar ─────────────────────────────────────── */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-semibold text-slate-700">Status:</span>
              <StatusBadge status={problem.status} />
              {totalDT > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-orange-600 font-medium ml-2">
                  <Clock size={11} /> {fmtDur(totalDT)} downtime
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Ubah ke:</span>
              {STATUSES.filter(s => s !== problem.status).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  disabled={!!savingStatus}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50">
                  {savingStatus === s ? <Loader2 size={10} className="animate-spin inline" /> : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['Lokasi',      problem.location || '—'],
                ['Departemen',  problem.department || '—'],
                ['Dilaporkan',  problem.reported_by],
                ['Tgl Lapor',   fmtDate(problem.reported_at)],
                ['Repair Count', `${problem.repairs.length}x tindakan`],
                ...(problem.closed_at ? [['Ditutup', fmtDate(problem.closed_at)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{k}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-1.5">Deskripsi Problem</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{problem.description}</p>
            </div>

            {/* Root Cause */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Root Cause</p>
                {!editRC && (
                  <button onClick={() => setEditRC(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Pencil size={11} /> {problem.root_cause ? 'Edit' : 'Tambah'}
                  </button>
                )}
              </div>
              {editRC ? (
                <div className="space-y-2">
                  <textarea
                    className="input text-sm resize-none" rows={3}
                    value={rcValue} onChange={e => setRcValue(e.target.value)}
                    placeholder="Tuliskan akar penyebab masalah..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs" onClick={() => { setEditRC(false); setRcValue(problem.root_cause || '') }}>
                      <RotateCcw size={11} /> Batal
                    </button>
                    <button className="btn-primary text-xs" onClick={handleSaveRC} disabled={savingRC}>
                      {savingRC ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Simpan
                    </button>
                  </div>
                </div>
              ) : problem.root_cause ? (
                <p className="text-sm text-slate-700 bg-orange-50 border border-orange-100 rounded-xl p-3 leading-relaxed">
                  {problem.root_cause}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">Belum ada root cause. Klik "Tambah" untuk mengisi.</p>
              )}
            </div>

            {/* Repair Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">
                  Repair Actions ({problem.repairs.length})
                </p>
                {!showRepairForm && (
                  <button onClick={() => setShowRepairForm(true)} className="btn-primary text-xs">
                    <Plus size={12} /> Add Repair
                  </button>
                )}
              </div>

              {showRepairForm && (
                <div className="mb-4">
                  <RepairFormPanel spareParts={spareParts} onSave={handleAddRepair} onCancel={() => setShowRepairForm(false)} />
                </div>
              )}

              {problem.repairs.length === 0 && !showRepairForm ? (
                <div className="flex flex-col items-center py-8 text-slate-300">
                  <Wrench size={28} className="mb-2" />
                  <p className="text-sm">Belum ada repair action</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {problem.repairs.map((r, i) => (
                    <div key={r.id} className="border border-slate-100 rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                          <ActionBadge type={r.action_type} />
                          <span className="text-xs font-semibold text-slate-700">{r.technician}</span>
                        </div>
                        {r.downtime_minutes > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-orange-500 font-semibold shrink-0">
                            <Clock size={11} /> {fmtDur(r.downtime_minutes)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{r.action_description}</p>
                      {r.notes && <p className="text-[11px] text-slate-400 italic mt-1">{r.notes}</p>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                        <p className="text-[10px] text-slate-400">
                          {fmtDt(r.start_time)} {r.end_time ? `— ${fmtDt(r.end_time)}` : '(belum selesai)'}
                        </p>
                        {r.spare_parts_used?.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-500">
                            <Package size={10} /> {r.spare_parts_used.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-4">Timeline Aktivitas</p>
              <Timeline problem={problem} repairs={problem.repairs} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// EDIT PROBLEM MODAL
// ══════════════════════════════════════════════════════════════════════════
function EditProblemModal({ problem, machines, onSave, onClose }) {
  // Convert stored datetime to datetime-local format (YYYY-MM-DDTHH:MM)
  const toLocalInput = (dt) => dt ? dt.slice(0, 16).replace(' ', 'T') : ''

  const [form, setForm] = useState({
    machine_id: problem.machine_id || '',
    problem_category: problem.problem_category,
    is_repeat: problem.is_repeat || 'R',
    description: problem.description,
    root_cause: problem.root_cause || '',
    reported_by: problem.reported_by,
    status: problem.status,
    reported_at: toLocalInput(problem.reported_at),
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const reported_at = form.reported_at ? form.reported_at.replace('T', ' ') + ':00' : null
      await onSave({ ...form, reported_at })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Edit Problem</p>
            <p className="text-white/50 text-xs font-mono mt-0.5">{problem.ticket_number}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Mesin</label>
            <select className="input" value={form.machine_id} onChange={e => set('machine_id', e.target.value)}>
              <option value="">— Tanpa mesin —</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.machine_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.problem_category} onChange={e => set('problem_category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jenis</label>
              <select className="input" value={form.is_repeat} onChange={e => set('is_repeat', e.target.value)}>
                {IS_REPEAT_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Tanggal &amp; Waktu Lapor</label>
            <input type="datetime-local" className="input" value={form.reported_at}
              onChange={e => set('reported_at', e.target.value)} />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} required />
          </div>
          <div>
            <label className="label">Root Cause</label>
            <textarea className="input resize-none" rows={2} value={form.root_cause}
              onChange={e => set('root_cause', e.target.value)} />
          </div>
          <div>
            <label className="label">Dilaporkan Oleh</label>
            <input className="input" value={form.reported_by}
              onChange={e => set('reported_by', e.target.value)} required />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PROBLEMS PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function Problems() {
  // ── Data state
  const [problems, setProblems]   = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [machines, setMachines]   = useState([])
  const [spareParts, setSpareParts] = useState([])

  // ── UI state
  const [page, setPage]           = useState(0)
  const [sort, setSort]           = useState({ by: 'reported_at', order: 'desc' })
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [filters, setFilters]     = useState({ search: '', status: '', category: '', machine_id: '', is_repeat: '', start_date: '', end_date: '' })

  // ── Modal/drawer state
  const [showNew, setShowNew]     = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [drawerID, setDrawerID]   = useState(null)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })
  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(0) }

  // ── Fetch problems
  const load = useCallback(() => {
    setLoading(true)
    const params = {
      ...filters.status     && { status:     filters.status },
      ...filters.category   && { category:   filters.category },
      ...filters.machine_id && { machine_id: filters.machine_id },
      ...filters.is_repeat  && { is_repeat:  filters.is_repeat },
      ...filters.search     && { search:     filters.search },
      ...filters.start_date && { start_date: filters.start_date },
      ...filters.end_date   && { end_date:   filters.end_date },
      sort_by:    sort.by,
      sort_order: sort.order,
      limit:  PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }
    problemsApi.getAll(params)
      .then(r => { setProblems(r.data.data); setTotal(r.data.total) })
      .catch(() => showToast('Gagal memuat data', 'error'))
      .finally(() => setLoading(false))
  }, [filters, sort, page])

  useEffect(() => { load() }, [load])

  // Fetch masters once
  useEffect(() => {
    machinesApi.getAll().then(r => setMachines(r.data)).catch(() => {})
    sparePartsApi.getAll().then(r => setSpareParts(r.data)).catch(() => {})
  }, [])

  const handleSort = (field) => {
    setSort(s => s.by === field ? { by: field, order: s.order === 'asc' ? 'desc' : 'asc' } : { by: field, order: 'asc' })
    setPage(0)
  }

  const handleNew = async (data) => {
    await problemsApi.create(data)
    setShowNew(false); load()
    showToast('Problem berhasil dilaporkan', 'success')
  }

  const handleEdit = async (data) => {
    await problemsApi.update(editItem.id, data)
    setEditItem(null); load()
    showToast('Problem berhasil diperbarui', 'success')
  }

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus tiket ${p.ticket_number}?\nSemua repair action terkait juga akan dihapus.`)) return
    await problemsApi.delete(p.id)
    load(); showToast('Problem dihapus', 'success')
  }

  const hasFilters = Object.values(filters).some(v => v !== '')

  // ── Status summary bar
  const statusSummary = [
    { s: 'Open',         color: 'text-red-600   bg-red-50   border-red-200'   },
    { s: 'In Progress',  color: 'text-amber-600  bg-amber-50  border-amber-200'  },
    { s: 'Pending Part', color: 'text-sky-600   bg-sky-50   border-sky-200'   },
    { s: 'Closed',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  ]

  return (
    <div className="space-y-4">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-slate-500 text-sm">
            Total <span className="font-bold text-slate-800">{total}</span> problem tercatat
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={15} /> New Problem
        </button>
      </div>

      {/* ── Status summary chips ────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {statusSummary.map(({ s, color }) => {
          const cnt = problems.filter(p => p.status === s).length
          return (
            <button key={s} onClick={() => setF('status', filters.status === s ? '' : s)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                filters.status === s ? color + ' ring-2 ring-offset-1 ring-current/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${filters.status === s ? '' : 'bg-slate-400'} ${filters.status === s ? STATUS_CFG[s]?.dot : ''}`} />
              {s}
            </button>
          )
        })}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="card !p-3 space-y-3">
        {/* Row 1: search + quick filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-8 text-sm" placeholder="Cari ticket#, mesin, deskripsi, pelapor..."
              value={filters.search} onChange={e => setF('search', e.target.value)} />
          </div>
          <select className="input w-36 text-sm" value={filters.status} onChange={e => setF('status', e.target.value)}>
            <option value="">Semua Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input w-32 text-sm" value={filters.is_repeat} onChange={e => setF('is_repeat', e.target.value)}>
            <option value="">Semua Jenis</option>
            <option value="N">Baru</option>
            <option value="R">Repeat</option>
          </select>
          <button
            onClick={() => setShowMoreFilters(m => !m)}
            className={`btn-secondary text-xs gap-1.5 ${showMoreFilters ? 'bg-navy-900 text-white hover:bg-navy-800' : ''}`}
          >
            <Filter size={13} />
            Filter Lanjut
            {(filters.category || filters.machine_id || filters.is_repeat || filters.start_date || filters.end_date) && (
              <span className="w-1.5 h-1.5 bg-accent rounded-full ml-0.5" />
            )}
          </button>
          {hasFilters && (
            <button className="btn-secondary text-xs text-red-500 hover:text-red-700 gap-1"
              onClick={() => { setFilters({ search: '', status: '', category: '', machine_id: '', is_repeat: '', start_date: '', end_date: '' }); setPage(0) }}>
              <X size={12} /> Reset
            </button>
          )}
        </div>

        {/* Row 2: more filters */}
        {showMoreFilters && (
          <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
            <select className="input w-40 text-sm" value={filters.category} onChange={e => setF('category', e.target.value)}>
              <option value="">Semua Kategori</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="input w-52 text-sm" value={filters.machine_id} onChange={e => setF('machine_id', e.target.value)}>
              <option value="">Semua Mesin</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.machine_name}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 shrink-0">Tgl:</span>
              <input type="date" className="input w-36 text-xs" value={filters.start_date} onChange={e => setF('start_date', e.target.value)} />
              <span className="text-slate-300">—</span>
              <input type="date" className="input w-36 text-xs" value={filters.end_date} onChange={e => setF('end_date', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <SortTH label="Ticket #"    field="ticket_number"    sort={sort} onSort={handleSort} />
                <SortTH label="Mesin"       field="machine_code"     sort={sort} onSort={handleSort} />
                <SortTH label="Kategori"    field="problem_category" sort={sort} onSort={handleSort} />
                <SortTH label="Jenis"       field="is_repeat"        sort={sort} onSort={handleSort} />
                <SortTH label="Status"      field="status"           sort={sort} onSort={handleSort} />
                <SortTH label="Reported By" field="reported_by"      sort={sort} onSort={handleSort} />
                <SortTH label="Tanggal"     field="reported_at"      sort={sort} onSort={handleSort} />
                <SortTH label="Downtime"    field="total_downtime"   sort={sort} onSort={handleSort} />
                <th className="table-th w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${50 + (j*11)%45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : problems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-td text-center py-16">
                    <AlertTriangle size={30} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm">Tidak ada problem ditemukan</p>
                    {hasFilters && <p className="text-xs text-slate-400 mt-1">Coba reset filter</p>}
                  </td>
                </tr>
              ) : problems.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  onClick={() => setDrawerID(p.id)}
                >
                  <td className="table-td">
                    <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {p.ticket_number}
                    </span>
                  </td>
                  <td className="table-td">
                    {p.machine_code ? (
                      <>
                        <p className="text-xs font-bold text-slate-700">{p.machine_code}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{p.machine_name}</p>
                      </>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="table-td"><CategoryBadge category={p.problem_category} /></td>
                  <td className="table-td">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.is_repeat === 'N' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {p.is_repeat === 'N' ? 'Baru' : 'Repeat'}
                    </span>
                  </td>
                  <td className="table-td"><StatusBadge status={p.status} /></td>
                  <td className="table-td text-xs text-slate-600">{p.reported_by}</td>
                  <td className="table-td text-[11px] text-slate-500">{fmtDate(p.reported_at)}</td>
                  <td className="table-td">
                    {p.total_downtime > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                        <Clock size={11} /> {fmtDur(p.total_downtime)}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors"
                        onClick={() => setEditItem(p)} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
                        onClick={() => handleDelete(p)} title="Hapus">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            {total === 0 ? 'Tidak ada data' : `Menampilkan ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} dari ${total} problem`}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
              const totalPages = Math.ceil(total / PAGE_SIZE)
              let pageNum = i
              if (totalPages > 5) {
                if (page <= 2) pageNum = i
                else if (page >= totalPages - 3) pageNum = totalPages - 5 + i
                else pageNum = page - 2 + i
              }
              return (
                <button key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                    page === pageNum
                      ? 'bg-navy-900 text-white border-navy-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modals & Drawer ─────────────────────────────────────────────── */}
      {showNew && (
        <NewProblemModal machines={machines} onSave={handleNew} onClose={() => setShowNew(false)} />
      )}
      {editItem && (
        <EditProblemModal problem={editItem} machines={machines} onSave={handleEdit} onClose={() => setEditItem(null)} />
      )}
      {drawerID && (
        <ProblemDrawer
          id={drawerID}
          spareParts={spareParts}
          onClose={() => setDrawerID(null)}
          onRefresh={load}
          showToast={showToast}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
