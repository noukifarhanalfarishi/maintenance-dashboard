import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, X, Filter, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Pencil, Trash2, Eye, Loader2, Save,
  Clock, Calendar, AlertCircle, CheckCircle2, AlertTriangle,
  ClipboardList, Wrench, Package, Sun, Sunset, Moon, RotateCcw,
} from 'lucide-react'
import { dailyLogsApi, machinesApi, sparePartsApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { StatusBadge, CategoryBadge, LogTypeBadge } from '../components/Badge'

// ══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const PLANNING_CATEGORIES = ['Daily Check', 'Weekly PM', 'Monthly PM', '3-Monthly PM', '6-Monthly PM', 'Yearly PM', 'Overhaul']
const TROUBLE_CATEGORIES  = ['Mechanical', 'Electrical', 'Pneumatic', 'Hydraulic', 'Software', 'Other']
const PRIORITIES          = ['Low', 'Medium', 'High', 'Critical']
const PLANNING_STATUSES   = ['Completed', 'Carry Over']
const TROUBLE_STATUSES    = ['Completed', 'In Progress', 'Pending Part', 'Carry Over']
const FILTER_STATUSES     = ['Completed', 'In Progress', 'Pending Part', 'Carry Over']
const PAGE_SIZE = 20

const SHIFT_CFG = {
  1: { label: 'Shift 1', time: '06:00–14:00', icon: Sun,    color: 'text-amber-500' },
  2: { label: 'Shift 2', time: '14:00–22:00', icon: Sunset, color: 'text-orange-500' },
  3: { label: 'Shift 3', time: '22:00–06:00', icon: Moon,   color: 'text-indigo-400' },
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════
const pad = (n) => String(n).padStart(2, '0')
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const toDatetimeLocalStr = (d) => `${toDateStr(d)}T${toTimeStr(d)}`
const todayStr = () => toDateStr(new Date())

function getActiveShift(date = new Date()) {
  const h = date.getHours()
  if (h >= 6 && h < 14) return 1
  if (h >= 14 && h < 22) return 2
  return 3
}

// String stored di DB sudah "wall-clock" lokal (bukan UTC), jadi cukup
// slice string-nya langsung — jangan lewat Date/toISOString (bisa geser zona waktu).
const dbToTimeInput = (dt) => dt ? dt.slice(11, 16) : ''
const dbToDatetimeLocalInput = (dt) => dt ? dt.slice(0, 16).replace(' ', 'T') : ''
const fmtTimeOnly = (dt) => dt ? dt.slice(11, 16) : '—'
const fmtDateID = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTimeID = (dt) => dt ? new Date(dt.replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDur = (m) => (m === null || m === undefined) ? '—' : `${m} mnt`
const truncate = (s, n = 50) => !s ? '—' : (s.length > n ? s.slice(0, n - 1) + '…' : s)

function calcDowntime(startLocal, endLocal) {
  if (!startLocal || !endLocal) return null
  const s = new Date(startLocal.replace('T', ' '))
  const e = new Date(endLocal.replace('T', ' '))
  const diff = Math.floor((e - s) / 60000)
  return diff >= 0 ? diff : null
}

// ══════════════════════════════════════════════════════════════════════════
// SORT HEADER
// ══════════════════════════════════════════════════════════════════════════
function SortTH({ label, field, sort, onSort, className = '' }) {
  const active = sort.by === field
  return (
    <th className={`table-th cursor-pointer select-none group whitespace-nowrap ${className}`} onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-colors ${active ? 'text-navy-900' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {active ? (sort.order === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} />}
        </span>
      </span>
    </th>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white animate-[fadeIn_.2s_ease] ${type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>
      {type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      {msg}
    </div>
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
    p.part_name.toLowerCase().includes(q.toLowerCase()) || p.part_code.toLowerCase().includes(q.toLowerCase())
  )
  const toggle = (code) => onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="input text-left flex items-center justify-between">
        <span className={selected.length ? 'text-slate-700' : 'text-slate-400'}>
          {selected.length ? `${selected.length} part dipilih` : 'Pilih spare parts yang digunakan (opsional)...'}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-2" />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(code => {
            const p = parts.find(x => x.part_code === code)
            return (
              <span key={code} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                {p ? p.part_name : code}
                <button type="button" onClick={() => toggle(code)} className="hover:text-blue-900"><X size={10} /></button>
              </span>
            )
          })}
        </div>
      )}

      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <input className="input !py-1.5 text-xs" placeholder="Cari part..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ada spare part</p>
            ) : filtered.map(p => (
              <label key={p.part_code} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(p.part_code)} onChange={() => toggle(p.part_code)} className="rounded" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{p.part_name}</p>
                  <p className="text-[10px] text-slate-400">{p.part_code} — Stok: {p.stock_quantity} {p.unit}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// LOG FORM MODAL (Planning & Trouble, create & edit)
// ══════════════════════════════════════════════════════════════════════════
function LogFormModal({ logType, editingLog, machines, spareParts, defaultShift, defaultReporter, onSave, onClose }) {
  const isTrouble = logType === 'Trouble'
  const categories = isTrouble ? TROUBLE_CATEGORIES : PLANNING_CATEGORIES
  const statuses   = isTrouble ? TROUBLE_STATUSES : PLANNING_STATUSES

  const buildInit = () => {
    if (editingLog) {
      return {
        log_date: editingLog.log_date,
        shift: editingLog.shift,
        machine_id: editingLog.machine_id || '',
        category: editingLog.category || categories[0],
        priority: editingLog.priority || 'Medium',
        description: editingLog.description || '',
        findings: editingLog.findings || '',
        action_taken: editingLog.action_taken || '',
        technician: editingLog.technician || '',
        start_time_only: dbToTimeInput(editingLog.start_time),
        end_time_only:   dbToTimeInput(editingLog.end_time),
        start_time: dbToDatetimeLocalInput(editingLog.start_time),
        end_time:   dbToDatetimeLocalInput(editingLog.end_time),
        status: editingLog.status || statuses[0],
        spare_parts_used: editingLog.spare_parts_used || [],
        notes: editingLog.notes || '',
        reported_by: editingLog.reported_by || defaultReporter,
      }
    }
    const now = new Date()
    return {
      log_date: todayStr(),
      shift: defaultShift,
      machine_id: '',
      category: categories[0],
      priority: 'Medium',
      description: '',
      findings: '',
      action_taken: '',
      technician: '',
      start_time_only: toTimeStr(now),
      end_time_only: '',
      start_time: toDatetimeLocalStr(now),
      end_time: '',
      status: 'Completed',
      spare_parts_used: [],
      notes: '',
      reported_by: defaultReporter,
    }
  }

  const [form, setForm] = useState(buildInit)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const previewDowntime = isTrouble ? calcDowntime(form.start_time, form.end_time) : 0

  const validate = () => {
    const e = {}
    if (!form.log_date)              e.log_date = 'Wajib diisi'
    if (!form.shift)                 e.shift = 'Wajib diisi'
    if (!form.machine_id)            e.machine_id = 'Wajib diisi'
    if (!form.category)              e.category = 'Wajib diisi'
    if (!form.description.trim())    e.description = 'Wajib diisi'
    if (!form.technician.trim())     e.technician = 'Wajib diisi'
    if (!form.reported_by.trim())    e.reported_by = 'Wajib diisi'
    if (isTrouble) {
      if (!form.action_taken.trim()) e.action_taken = 'Wajib diisi'
      if (!form.start_time)          e.start_time = 'Wajib diisi'
    } else {
      if (!form.start_time_only)     e.start_time_only = 'Wajib diisi'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        log_date: form.log_date,
        shift: parseInt(form.shift),
        log_type: logType,
        machine_id: form.machine_id,
        description: form.description,
        category: form.category,
        findings: form.findings || null,
        action_taken: form.action_taken || null,
        technician: form.technician,
        status: form.status,
        spare_parts_used: form.spare_parts_used,
        notes: form.notes || null,
        reported_by: form.reported_by,
        ...(isTrouble ? {
          priority: form.priority,
          start_time: form.start_time ? form.start_time.replace('T', ' ') + ':00' : null,
          end_time:   form.end_time   ? form.end_time.replace('T', ' ') + ':00'   : null,
        } : {
          start_time: form.start_time_only ? `${form.log_date} ${form.start_time_only}:00` : null,
          end_time:   form.end_time_only   ? `${form.log_date} ${form.end_time_only}:00`   : null,
        }),
      }
      await onSave(payload)
    } finally { setSaving(false) }
  }

  const accent = isTrouble ? 'bg-orange-500' : 'bg-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center shrink-0`}>
              {isTrouble ? <AlertTriangle size={17} className="text-white" /> : <ClipboardList size={17} className="text-white" />}
            </div>
            <div>
              <p className="font-bold text-white">{editingLog ? 'Edit' : 'Tambah'} Log {logType}</p>
              {editingLog && <p className="text-white/50 text-xs font-mono mt-0.5">{editingLog.log_number}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Tanggal, Shift, Mesin */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Tanggal *</label>
              <input type="date" className={`input ${errors.log_date ? 'border-red-400' : ''}`}
                value={form.log_date} onChange={e => set('log_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Shift *</label>
              <select className={`input ${errors.shift ? 'border-red-400' : ''}`}
                value={form.shift} onChange={e => set('shift', e.target.value)}>
                {[1, 2, 3].map(s => <option key={s} value={s}>Shift {s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mesin *</label>
              <select className={`input ${errors.machine_id ? 'border-red-400' : ''}`}
                value={form.machine_id} onChange={e => set('machine_id', e.target.value)}>
                <option value="">— Pilih —</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code}</option>)}
              </select>
            </div>
          </div>

          {/* Kategori + Priority */}
          <div className={`grid gap-4 ${isTrouble ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="label">Kategori {isTrouble ? 'Problem' : 'PM'} *</label>
              <select className={`input ${errors.category ? 'border-red-400' : ''}`}
                value={form.category} onChange={e => set('category', e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {isTrouble && (
              <div>
                <label className="label">Priority *</label>
                <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Deskripsi */}
          <div>
            <label className="label">Deskripsi {isTrouble ? 'Trouble' : 'Pekerjaan'} *</label>
            <textarea className={`input resize-none ${errors.description ? 'border-red-400' : ''}`} rows={2}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder={isTrouble ? 'Jelaskan trouble yang terjadi...' : 'Jelaskan pekerjaan PM yang dilakukan...'} />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Tindakan */}
          <div>
            <label className="label">Tindakan {isTrouble ? 'Perbaikan *' : '(opsional)'}</label>
            <textarea className={`input resize-none ${errors.action_taken ? 'border-red-400' : ''}`} rows={2}
              value={form.action_taken} onChange={e => set('action_taken', e.target.value)}
              placeholder="Tindakan yang dilakukan..." />
            {errors.action_taken && <p className="text-red-500 text-xs mt-1">{errors.action_taken}</p>}
          </div>

          {/* Findings / Root Cause */}
          <div>
            <label className="label">{isTrouble ? 'Root Cause / Penyebab (opsional)' : 'Temuan / Findings (opsional) — abnormality?'}</label>
            <textarea className="input resize-none" rows={2}
              value={form.findings} onChange={e => set('findings', e.target.value)}
              placeholder={isTrouble ? 'Penyebab masalah, bisa diisi belakangan...' : 'Apakah ada abnormality yang ditemukan?'} />
          </div>

          {/* Teknisi + Reported By */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teknisi *</label>
              <input className={`input ${errors.technician ? 'border-red-400' : ''}`}
                value={form.technician} onChange={e => set('technician', e.target.value)} placeholder="Nama teknisi" />
              {errors.technician && <p className="text-red-500 text-xs mt-1">{errors.technician}</p>}
            </div>
            <div>
              <label className="label">Reported By *</label>
              <input className={`input ${errors.reported_by ? 'border-red-400' : ''}`}
                value={form.reported_by} onChange={e => set('reported_by', e.target.value)} />
              {errors.reported_by && <p className="text-red-500 text-xs mt-1">{errors.reported_by}</p>}
            </div>
          </div>

          {/* Waktu */}
          {isTrouble ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Waktu Mesin Stop *</label>
                <input type="datetime-local" className={`input ${errors.start_time ? 'border-red-400' : ''}`}
                  value={form.start_time} onChange={e => set('start_time', e.target.value)} />
                {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time}</p>}
              </div>
              <div>
                <label className="label">Waktu Mesin Start</label>
                <input type="datetime-local" className="input"
                  value={form.end_time} onChange={e => set('end_time', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Waktu Mulai *</label>
                <input type="time" className={`input ${errors.start_time_only ? 'border-red-400' : ''}`}
                  value={form.start_time_only} onChange={e => set('start_time_only', e.target.value)} />
                {errors.start_time_only && <p className="text-red-500 text-xs mt-1">{errors.start_time_only}</p>}
              </div>
              <div>
                <label className="label">Waktu Selesai</label>
                <input type="time" className="input"
                  value={form.end_time_only} onChange={e => set('end_time_only', e.target.value)} />
              </div>
            </div>
          )}

          {isTrouble && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
              <Clock size={14} className="text-orange-500 shrink-0" />
              <p className="text-xs text-orange-700">
                Downtime: <span className="font-bold">{previewDowntime !== null ? `${previewDowntime} menit` : '— (isi waktu stop & start)'}</span>
                <span className="text-orange-400 font-normal"> (dihitung otomatis)</span>
              </p>
            </div>
          )}

          {/* Spare parts */}
          <div>
            <label className="label">Spare Parts Digunakan</label>
            <SparePartsSelect parts={spareParts} selected={form.spare_parts_used} onChange={v => set('spare_parts_used', v)} />
          </div>

          {/* Status */}
          <div>
            <label className="label">Status *</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Catatan */}
          <div>
            <label className="label">Catatan (opsional)</label>
            <textarea className="input resize-none" rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Catatan tambahan..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Menyimpan...' : editingLog ? 'Simpan Perubahan' : 'Simpan Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// LOG DETAIL DRAWER
// ══════════════════════════════════════════════════════════════════════════
function LogDetailDrawer({ id, onClose, onRefresh, onEdit, onDelete, showToast, canEdit, canDelete }) {
  const [log, setLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [editFindings, setEditFindings] = useState(false)
  const [findingsValue, setFindingsValue] = useState('')
  const [savingFindings, setSavingFindings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await dailyLogsApi.getById(id)
      setLog(r.data)
      setFindingsValue(r.data.findings || '')
    } catch { showToast('Gagal memuat detail log', 'error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const statuses = log?.log_type === 'Trouble' ? TROUBLE_STATUSES : PLANNING_STATUSES

  const handleStatusChange = async (status) => {
    setSavingStatus(status)
    try {
      await dailyLogsApi.patch(id, { status })
      await load(); onRefresh()
      showToast(`Status diubah ke "${status}"`, 'success')
    } catch { showToast('Gagal update status', 'error') }
    finally { setSavingStatus(false) }
  }

  const handleSaveFindings = async () => {
    setSavingFindings(true)
    try {
      await dailyLogsApi.patch(id, { findings: findingsValue })
      await load()
      setEditFindings(false)
      showToast('Findings / root cause disimpan', 'success')
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSavingFindings(false) }
  }

  if (loading && !log) return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-300" />
      </div>
    </>
  )
  if (!log) return null

  const isTrouble = log.log_type === 'Trouble'

  // Timeline sederhana berdasarkan created_at / waktu kerja / updated_at
  const timeline = [
    { time: log.created_at, icon: ClipboardList, color: 'bg-blue-100 text-blue-600', title: 'Log Dibuat', sub: `oleh ${log.reported_by}` },
    ...(log.start_time ? [{ time: log.start_time, icon: isTrouble ? AlertTriangle : Wrench, color: isTrouble ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600', title: isTrouble ? 'Mesin Stop' : 'Pekerjaan Dimulai', sub: log.technician }] : []),
    ...(log.end_time ? [{ time: log.end_time, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', title: isTrouble ? 'Mesin Start Kembali' : 'Pekerjaan Selesai', sub: isTrouble && log.downtime_minutes ? `Downtime: ${log.downtime_minutes} menit` : '' }] : []),
    ...(log.updated_at && log.updated_at !== log.created_at ? [{ time: log.updated_at, icon: Pencil, color: 'bg-slate-100 text-slate-500', title: 'Terakhir Diperbarui', sub: `Status saat ini: ${log.status}` }] : []),
  ].filter(e => e.time).sort((a, b) => new Date(a.time.replace(' ', 'T')) - new Date(b.time.replace(' ', 'T')))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-white/50">{log.log_number}</p>
              <p className="text-white font-bold text-sm mt-0.5 leading-snug line-clamp-2">{log.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <LogTypeBadge type={log.log_type} />
                <CategoryBadge category={log.category} />
                {log.machine_code && (
                  <span className="text-[11px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    {log.machine_code} — {log.machine_name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {canEdit(log) && (
                <button onClick={() => onEdit(log)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors" title="Edit">
                  <Pencil size={14} />
                </button>
              )}
              {canDelete(log) && (
                <button onClick={() => onDelete(log)} className="p-1.5 bg-white/10 hover:bg-red-500/80 rounded-lg text-white/70 hover:text-white transition-colors" title="Hapus">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={onClose} className="text-white/50 hover:text-white ml-1"><X size={18} /></button>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Status:</span>
              <StatusBadge status={log.status} />
              {isTrouble && log.downtime_minutes > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-orange-600 font-medium ml-2">
                  <Clock size={11} /> {fmtDur(log.downtime_minutes)} downtime
                </span>
              )}
            </div>
            {canEdit(log) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Ubah ke:</span>
                {statuses.filter(s => s !== log.status).map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)} disabled={!!savingStatus}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50">
                    {savingStatus === s ? <Loader2 size={10} className="animate-spin inline" /> : s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['Tanggal', fmtDateID(log.log_date)],
                ['Shift', `Shift ${log.shift} (${SHIFT_CFG[log.shift]?.time || '—'})`],
                ['Lokasi', log.location || '—'],
                ['Departemen', log.department || '—'],
                ['Teknisi', log.technician],
                ['Reported By', log.reported_by],
                ...(isTrouble ? [['Priority', log.priority]] : []),
                ['Waktu', `${fmtTimeOnly(log.start_time)} – ${fmtTimeOnly(log.end_time)}`],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{k}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-1.5">Deskripsi {isTrouble ? 'Trouble' : 'Pekerjaan'}</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{log.description}</p>
            </div>

            {/* Action taken */}
            {log.action_taken && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-1.5">Tindakan</p>
                <p className="text-sm text-slate-700 bg-blue-50/60 border border-blue-100 rounded-xl p-3 leading-relaxed">{log.action_taken}</p>
              </div>
            )}

            {/* Findings / Root cause — inline editable */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">
                  {isTrouble ? 'Root Cause' : 'Findings / Temuan'}
                </p>
                {!editFindings && canEdit(log) && (
                  <button onClick={() => setEditFindings(true)} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Pencil size={11} /> {log.findings ? 'Edit' : 'Tambah'}
                  </button>
                )}
              </div>
              {editFindings ? (
                <div className="space-y-2">
                  <textarea className="input text-sm resize-none" rows={3} value={findingsValue}
                    onChange={e => setFindingsValue(e.target.value)}
                    placeholder={isTrouble ? 'Tuliskan akar penyebab masalah...' : 'Apakah ada abnormality yang ditemukan?'} autoFocus />
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs" onClick={() => { setEditFindings(false); setFindingsValue(log.findings || '') }}>
                      <RotateCcw size={11} /> Batal
                    </button>
                    <button className="btn-primary text-xs" onClick={handleSaveFindings} disabled={savingFindings}>
                      {savingFindings ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Simpan
                    </button>
                  </div>
                </div>
              ) : log.findings ? (
                <p className="text-sm text-slate-700 bg-orange-50 border border-orange-100 rounded-xl p-3 leading-relaxed">{log.findings}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Belum diisi. Klik "Tambah" untuk mengisi.</p>
              )}
            </div>

            {/* Spare parts */}
            {log.spare_parts_used?.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1">
                  <Package size={12} /> Spare Parts Digunakan
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {log.spare_parts_used.map(code => (
                    <span key={code} className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{code}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {log.notes && (
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-1.5">Catatan</p>
                <p className="text-sm text-slate-500 italic bg-slate-50 rounded-xl p-3">{log.notes}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold mb-4">Timeline Perubahan</p>
              <div className="space-y-0">
                {timeline.map((e, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${e.color}`}>
                        <e.icon size={13} />
                      </div>
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" style={{ minHeight: 16 }} />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{e.title}</p>
                      {e.sub && <p className="text-[11px] text-slate-500">{e.sub}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTimeID(e.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DAILY LOG PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function DailyLog() {
  const { user } = useAuth()
  const confirm = useConfirm()

  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  const activeShift = getActiveShift(now)

  // ── Data state
  const [logs, setLogs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [counts, setCounts]   = useState({ all: 0, Planning: 0, Trouble: 0 })
  const [loading, setLoading] = useState(true)
  const [machines, setMachines]     = useState([])
  const [spareParts, setSpareParts] = useState([])

  // ── UI state
  const [tab, setTab]   = useState('all') // 'all' | 'Planning' | 'Trouble'
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState({ by: 'log_date', order: 'desc' })
  const [filters, setFilters] = useState({ log_date: todayStr(), shift: '', machine_id: '', status: '', search: '' })

  // ── Modal/drawer state
  const [showForm, setShowForm]     = useState(null) // 'Planning' | 'Trouble' | null
  const [editingLog, setEditingLog] = useState(null)
  const [drawerID, setDrawerID]     = useState(null)
  const [toast, setToast]           = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })
  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(0) }

  // ── Role gating (Prompt 7): Admin/Supervisor manage semua log, Technician
  // hanya boleh edit log miliknya sendiri (technician === nama user) dan tidak
  // bisa delete, Operator hanya bisa create (view-only untuk log yang sudah ada).
  const canEditLog = useCallback((log) => {
    if (!user) return false
    if (user.role === 'Admin' || user.role === 'Supervisor') return true
    if (user.role === 'Technician') return log.technician === user.full_name
    return false
  }, [user])
  const canDeleteLog = useCallback(() => user?.role === 'Admin' || user?.role === 'Supervisor', [user])
  const canCreatePlanning = user?.role === 'Admin' || user?.role === 'Supervisor' || user?.role === 'Technician'

  const baseParams = useCallback(() => ({
    ...(filters.log_date && { start_date: filters.log_date, end_date: filters.log_date }),
    ...(filters.shift && { shift: filters.shift }),
    ...(filters.machine_id && { machine_id: filters.machine_id }),
    ...(filters.status && { status: filters.status }),
    ...(filters.search && { search: filters.search }),
  }), [filters])

  // ── Fetch table
  const load = useCallback(() => {
    setLoading(true)
    dailyLogsApi.getAll({
      ...baseParams(),
      ...(tab !== 'all' && { log_type: tab }),
      sort_by: sort.by, sort_order: sort.order,
      limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    }).then(r => { setLogs(r.data.data); setTotal(r.data.total) })
      .catch(() => showToast('Gagal memuat data log', 'error'))
      .finally(() => setLoading(false))
  }, [baseParams, tab, sort, page])

  useEffect(() => { load() }, [load])

  // ── Fetch tab counts (independent of `tab` itself)
  const loadCounts = useCallback(() => {
    const params = { ...baseParams(), limit: 1 }
    Promise.all([
      dailyLogsApi.getAll(params),
      dailyLogsApi.getAll({ ...params, log_type: 'Planning' }),
      dailyLogsApi.getAll({ ...params, log_type: 'Trouble' }),
    ]).then(([all, pl, tr]) => setCounts({ all: all.data.total, Planning: pl.data.total, Trouble: tr.data.total }))
      .catch(() => {})
  }, [baseParams])

  useEffect(() => { loadCounts() }, [loadCounts])

  // Fetch masters once
  useEffect(() => {
    machinesApi.getAll().then(r => setMachines(r.data)).catch(() => {})
    sparePartsApi.getAll().then(r => setSpareParts(r.data)).catch(() => {})
  }, [])

  const handleSort = (field) => {
    setSort(s => s.by === field ? { by: field, order: s.order === 'asc' ? 'desc' : 'asc' } : { by: field, order: 'asc' })
    setPage(0)
  }

  const refreshAll = () => { load(); loadCounts() }

  const handleNew = async (payload) => {
    await dailyLogsApi.create(payload)
    setShowForm(null); refreshAll()
    showToast(`Log ${payload.log_type} berhasil disimpan`, 'success')
  }

  const handleEditSave = async (payload) => {
    await dailyLogsApi.update(editingLog.id, payload)
    setEditingLog(null); refreshAll()
    showToast('Log berhasil diperbarui', 'success')
  }

  const handleDelete = async (log) => {
    const ok = await confirm({
      title: `Hapus ${log.log_number}?`,
      message: 'Log ini akan dihapus permanen dan tidak bisa dikembalikan.',
      type: 'danger',
    })
    if (!ok) return
    await dailyLogsApi.delete(log.id)
    if (drawerID === log.id) setDrawerID(null)
    refreshAll()
    showToast('Log berhasil dihapus', 'success')
  }

  const hasFilters = filters.shift || filters.machine_id || filters.status || filters.search || filters.log_date !== todayStr()
  const resetFilters = () => { setFilters({ log_date: todayStr(), shift: '', machine_id: '', status: '', search: '' }); setPage(0) }

  const openEdit = (log) => { setDrawerID(null); setEditingLog(log) }

  const ShiftIcon = SHIFT_CFG[activeShift].icon

  return (
    <div className="space-y-4">

      {/* ── Header Section ──────────────────────────────────────────────── */}
      <div className="card !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Daily Activity Log</p>
            <p className="text-xl font-bold text-navy-900 leading-tight mt-0.5">
              {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className={`hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2`}>
            <ShiftIcon size={16} className={SHIFT_CFG[activeShift].color} />
            <div className="leading-tight">
              <p className="text-xs font-bold text-slate-700">{SHIFT_CFG[activeShift].label}</p>
              <p className="text-[10px] text-slate-400">{SHIFT_CFG[activeShift].time}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCreatePlanning && (
            <button onClick={() => setShowForm('Planning')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5">
              <Plus size={15} /> Planning
            </button>
          )}
          <button onClick={() => setShowForm('Trouble')} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5">
            <Plus size={15} /> Trouble
          </button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { v: 'all', label: 'Semua', count: counts.all },
          { v: 'Planning', label: 'Planning', count: counts.Planning },
          { v: 'Trouble', label: 'Trouble', count: counts.Trouble },
        ].map(t => (
          <button key={t.v} onClick={() => { setTab(t.v); setPage(0) }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.v ? 'border-navy-900 text-navy-900' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {t.label} <span className="text-xs font-normal text-slate-400">({t.count})</span>
          </button>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="card !p-3 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-slate-400 shrink-0" />
          <input type="date" className="input w-40 text-sm" value={filters.log_date} onChange={e => setF('log_date', e.target.value)} />
        </div>
        <select className="input w-28 text-sm" value={filters.shift} onChange={e => setF('shift', e.target.value)}>
          <option value="">Semua Shift</option>
          {[1, 2, 3].map(s => <option key={s} value={s}>Shift {s}</option>)}
        </select>
        <select className="input w-48 text-sm" value={filters.machine_id} onChange={e => setF('machine_id', e.target.value)}>
          <option value="">Semua Mesin</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.machine_code} — {m.machine_name}</option>)}
        </select>
        <select className="input w-40 text-sm" value={filters.status} onChange={e => setF('status', e.target.value)}>
          <option value="">Semua Status</option>
          {FILTER_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-8 text-sm" placeholder="Cari log#, mesin, deskripsi, teknisi..."
            value={filters.search} onChange={e => setF('search', e.target.value)} />
        </div>
        {hasFilters && (
          <button className="btn-secondary text-xs text-red-500 hover:text-red-700 gap-1" onClick={resetFilters}>
            <X size={12} /> Reset Filter
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <SortTH label="Log #" field="log_number" sort={sort} onSort={handleSort} />
                <SortTH label="Tipe" field="log_type" sort={sort} onSort={handleSort} />
                <SortTH label="Shift" field="shift" sort={sort} onSort={handleSort} />
                <SortTH label="Mesin" field="machine_code" sort={sort} onSort={handleSort} />
                <SortTH label="Kategori" field="category" sort={sort} onSort={handleSort} />
                <th className="table-th">Deskripsi</th>
                <SortTH label="Teknisi" field="technician" sort={sort} onSort={handleSort} />
                <th className="table-th">Waktu</th>
                <SortTH label="Downtime" field="downtime_minutes" sort={sort} onSort={handleSort} />
                <SortTH label="Status" field="status" sort={sort} onSort={handleSort} />
                <th className="table-th w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${50 + (j * 9) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="table-td text-center py-16">
                    <ClipboardList size={30} className="mx-auto mb-2 text-slate-200" />
                    {hasFilters ? (
                      <>
                        <p className="text-slate-400 text-sm">Tidak ada log ditemukan</p>
                        <p className="text-xs text-slate-400 mt-1">Coba reset filter</p>
                      </>
                    ) : (
                      <p className="text-slate-400 text-sm">Belum ada aktivitas hari ini. Mulai catat dengan tombol di atas.</p>
                    )}
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 cursor-pointer transition-colors group" onClick={() => setDrawerID(log.id)}>
                  <td className="table-td">
                    <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{log.log_number}</span>
                  </td>
                  <td className="table-td"><LogTypeBadge type={log.log_type} /></td>
                  <td className="table-td text-xs font-semibold text-slate-600">Shift {log.shift}</td>
                  <td className="table-td">
                    {log.machine_code ? (
                      <>
                        <p className="text-xs font-bold text-slate-700">{log.machine_code}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{log.machine_name}</p>
                      </>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="table-td"><CategoryBadge category={log.category} /></td>
                  <td className="table-td text-xs text-slate-600 max-w-[220px]">{truncate(log.description, 50)}</td>
                  <td className="table-td text-xs text-slate-600">{log.technician}</td>
                  <td className="table-td text-[11px] text-slate-500 font-mono">{fmtTimeOnly(log.start_time)}–{fmtTimeOnly(log.end_time)}</td>
                  <td className="table-td">
                    {log.log_type === 'Trouble' ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                        <Clock size={11} /> {log.downtime_minutes}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="table-td"><StatusBadge status={log.status} /></td>
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-blue-50 rounded text-blue-500 transition-colors" onClick={() => setDrawerID(log.id)} title="Lihat">
                        <Eye size={13} />
                      </button>
                      {canEditLog(log) && (
                        <button className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors" onClick={() => setEditingLog(log)} title="Edit">
                          <Pencil size={13} />
                        </button>
                      )}
                      {canDeleteLog(log) && (
                        <button className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors" onClick={() => handleDelete(log)} title="Hapus">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            {total === 0 ? 'Tidak ada data' : `Menampilkan ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} dari ${total} log`}
          </p>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={13} /> Prev
            </button>
            {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
              const totalPages = Math.ceil(total / PAGE_SIZE)
              let pageNum = i
              if (totalPages > 5) {
                if (page <= 2) pageNum = i
                else if (page >= totalPages - 3) pageNum = totalPages - 5 + i
                else pageNum = page - 2 + i
              }
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                    page === pageNum ? 'bg-navy-900 text-white border-navy-900 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {pageNum + 1}
                </button>
              )
            })}
            <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modals & Drawer ──────────────────────────────────────────────── */}
      {showForm && (
        <LogFormModal
          logType={showForm}
          machines={machines}
          spareParts={spareParts}
          defaultShift={activeShift}
          defaultReporter={user?.full_name || ''}
          onSave={handleNew}
          onClose={() => setShowForm(null)}
        />
      )}
      {editingLog && (
        <LogFormModal
          logType={editingLog.log_type}
          editingLog={editingLog}
          machines={machines}
          spareParts={spareParts}
          defaultShift={activeShift}
          defaultReporter={user?.full_name || ''}
          onSave={handleEditSave}
          onClose={() => setEditingLog(null)}
        />
      )}
      {drawerID && (
        <LogDetailDrawer
          id={drawerID}
          onClose={() => setDrawerID(null)}
          onRefresh={refreshAll}
          onEdit={openEdit}
          onDelete={handleDelete}
          showToast={showToast}
          canEdit={canEditLog}
          canDelete={canDeleteLog}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
