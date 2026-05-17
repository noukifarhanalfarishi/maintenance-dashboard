import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Pencil, Trash2, Search, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Package, Loader2, Save, AlertCircle,
} from 'lucide-react'
import { sparePartsApi } from '../api/client'

// ── Constants ────────────────────────────────────────────────────────────
const CATEGORIES = ['Bearing', 'Belt', 'Lubricant', 'Filter', 'Sensor', 'Pneumatic', 'Electrical', 'Seal', 'Chain', 'Other']
const UNITS = ['pcs', 'set', 'meter', 'liter', 'kg', 'roll']

// ── Utilities ────────────────────────────────────────────────────────────
function stockLevel(qty, min) {
  if (qty === 0)      return 'empty'
  if (qty <= min)     return 'low'
  if (qty <= min * 2) return 'medium'
  return 'ok'
}

const LEVEL_CFG = {
  empty:  { bar: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50',    label: 'Habis',   border: 'border-red-200' },
  low:    { bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50', label: 'Rendah',  border: 'border-orange-200' },
  medium: { bar: 'bg-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Cukup',   border: 'border-amber-200' },
  ok:     { bar: 'bg-emerald-500',text: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Normal',  border: 'border-emerald-200' },
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

// ── Stock Level Bar ───────────────────────────────────────────────────────
function StockBar({ qty, min }) {
  const level = stockLevel(qty, min)
  const cfg = LEVEL_CFG[level]
  const maxDisplay = Math.max(qty, min * 3, 1)
  const pct = Math.min(100, (qty / maxDisplay) * 100)

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${cfg.bar}`} style={{ width: `${pct}%` }}/>
      </div>
      <span className={`text-sm font-bold w-6 text-right shrink-0 ${cfg.text}`}>{qty}</span>
    </div>
  )
}

// ── Category badge ────────────────────────────────────────────────────────
function CatBadge({ cat }) {
  const colors = {
    Bearing:    'bg-blue-50    text-blue-700',
    Belt:       'bg-purple-50  text-purple-700',
    Lubricant:  'bg-yellow-50  text-yellow-700',
    Filter:     'bg-sky-50     text-sky-700',
    Sensor:     'bg-indigo-50  text-indigo-700',
    Pneumatic:  'bg-cyan-50    text-cyan-700',
    Electrical: 'bg-amber-50   text-amber-700',
    Seal:       'bg-rose-50    text-rose-700',
    Chain:      'bg-slate-100  text-slate-600',
    Other:      'bg-slate-50   text-slate-500',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[cat]||'bg-slate-50 text-slate-500'}`}>
      {cat || '—'}
    </span>
  )
}

// ── Part Form Modal ───────────────────────────────────────────────────────
function PartFormModal({ part, onSave, onClose }) {
  const [form, setForm] = useState(part ? {
    part_code: part.part_code, part_name: part.part_name,
    category: part.category||'', stock_quantity: part.stock_quantity,
    minimum_stock: part.minimum_stock, unit: part.unit||'pcs', location: part.location||'',
  } : { part_code:'', part_name:'', category:'', stock_quantity:0, minimum_stock:0, unit:'pcs', location:'' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})) }

  const validate = () => {
    const e = {}
    if (!form.part_code.trim()) e.part_code = 'Wajib diisi'
    if (!form.part_name.trim()) e.part_name = 'Wajib diisi'
    setErrors(e); return !Object.keys(e).length
  }

  const submit = async (e) => {
    e.preventDefault(); if (!validate()) return
    setSaving(true)
    try { await onSave({ ...form, stock_quantity: parseInt(form.stock_quantity)||0, minimum_stock: parseInt(form.minimum_stock)||0 }) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
          <p className="font-bold text-white">{part ? 'Edit Spare Part' : 'Tambah Spare Part'}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kode Part *</label>
              <input className={`input ${errors.part_code?'border-red-400':''}`}
                value={form.part_code} onChange={e=>set('part_code',e.target.value)} placeholder="SP-021"/>
              {errors.part_code && <p className="text-red-500 text-xs mt-1">{errors.part_code}</p>}
            </div>
            <div>
              <label className="label">Satuan</label>
              <select className="input" value={form.unit} onChange={e=>set('unit',e.target.value)}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nama Part *</label>
            <input className={`input ${errors.part_name?'border-red-400':''}`}
              value={form.part_name} onChange={e=>set('part_name',e.target.value)} placeholder="Bearing 6205 SKF"/>
            {errors.part_name && <p className="text-red-500 text-xs mt-1">{errors.part_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                <option value="">— Pilih —</option>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Lokasi Rak</label>
              <input className="input" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Rack A-1"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Stok Saat Ini</label>
              <input type="number" className="input" min="0" value={form.stock_quantity}
                onChange={e=>set('stock_quantity',e.target.value)}/>
            </div>
            <div>
              <label className="label">Stok Minimum</label>
              <input type="number" className="input" min="0" value={form.minimum_stock}
                onChange={e=>set('minimum_stock',e.target.value)}/>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {saving ? 'Menyimpan...' : part ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stock Adjust Modal ────────────────────────────────────────────────────
function StockModal({ part, onClose, onAdjust }) {
  const [adj, setAdj]     = useState('')
  const [type, setType]   = useState('in')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const delta = parseInt(adj) || 0
  const newQty = type === 'in' ? part.stock_quantity + delta : part.stock_quantity - delta
  const level  = stockLevel(newQty < 0 ? 0 : newQty, part.minimum_stock)

  const submit = async () => {
    if (!adj || delta <= 0) return
    setSaving(true)
    try { await onAdjust(type === 'in' ? delta : -delta) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy-900 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">{part.part_name}</p>
            <p className="text-white/50 text-xs font-mono">{part.part_code}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current stock */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Stok Saat Ini</p>
              <p className="text-3xl font-bold text-slate-800 mt-0.5">
                {part.stock_quantity} <span className="text-base font-normal text-slate-400">{part.unit}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Min:</p>
              <p className="text-lg font-bold text-slate-600">{part.minimum_stock}</p>
            </div>
          </div>

          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType('in')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${type === 'in' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <TrendingUp size={16} className={type === 'in' ? 'text-emerald-600' : 'text-slate-400'}/>
              <span className={`text-sm font-semibold ${type === 'in' ? 'text-emerald-700' : 'text-slate-500'}`}>Stok Masuk</span>
            </button>
            <button
              onClick={() => setType('out')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${type === 'out' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <TrendingDown size={16} className={type === 'out' ? 'text-red-500' : 'text-slate-400'}/>
              <span className={`text-sm font-semibold ${type === 'out' ? 'text-red-600' : 'text-slate-500'}`}>Stok Keluar</span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Jumlah ({part.unit})</label>
            <input type="number" className="input text-lg font-bold" min="1"
              value={adj} onChange={e => setAdj(e.target.value)} placeholder="0" autoFocus/>
          </div>

          <div>
            <label className="label">Keterangan</label>
            <input className="input text-sm" value={reason} onChange={e=>setReason(e.target.value)}
              placeholder="Penerimaan PO, pemakaian repair, dll."/>
          </div>

          {/* Preview */}
          {adj && (
            <div className={`p-3 rounded-xl ${LEVEL_CFG[level].bg} border ${LEVEL_CFG[level].border}`}>
              <p className={`text-sm font-semibold ${LEVEL_CFG[level].text}`}>
                Stok setelah: <strong>{Math.max(0, newQty)} {part.unit}</strong>
                {' '}— {LEVEL_CFG[level].label}
              </p>
              {newQty < 0 && <p className="text-red-500 text-xs mt-0.5">⚠ Jumlah melebihi stok tersedia</p>}
              {newQty >= 0 && newQty < part.minimum_stock && (
                <p className="text-xs mt-0.5 opacity-80">⚠ Di bawah stok minimum</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={onClose}>Batal</button>
            <button
              className={`flex-1 justify-center font-semibold rounded-lg py-2 text-sm flex items-center gap-1.5 transition-colors ${
                type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              } disabled:opacity-40`}
              disabled={!adj || delta <= 0 || newQty < 0 || saving}
              onClick={submit}
            >
              {saving ? <Loader2 size={14} className="animate-spin"/> : (type === 'in' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>)}
              {saving ? 'Menyimpan...' : type === 'in' ? 'Tambah Stok' : 'Kurangi Stok'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN SPARE PARTS PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function SpareParts() {
  const [parts, setParts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [activecat, setActiveCat] = useState('')   // category filter

  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [stockItem, setStockItem] = useState(null)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const load = useCallback(() => {
    setLoading(true)
    sparePartsApi.getAll()
      .then(r => { setParts(r.data); setLoading(false) })
      .catch(() => { showToast('Gagal memuat data', 'error'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    if (editItem) await sparePartsApi.update(editItem.id, data)
    else          await sparePartsApi.create(data)
    setShowForm(false); setEditItem(null); load()
    showToast(editItem ? 'Spare part diperbarui' : 'Spare part ditambahkan')
  }

  const handleAdjust = async (adj) => {
    await sparePartsApi.adjustStock(stockItem.id, adj)
    setStockItem(null); load()
    showToast(`Stok ${adj > 0 ? 'ditambah' : 'dikurangi'} ${Math.abs(adj)} ${stockItem.unit}`)
  }

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus spare part ${p.part_code} — ${p.part_name}?`)) return
    await sparePartsApi.delete(p.id); load()
    showToast('Spare part dihapus')
  }

  // Derived
  const categories  = [...new Set(parts.map(p => p.category).filter(Boolean))].sort()
  const lowStock    = parts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock)
  const emptyStock  = parts.filter(p => p.stock_quantity === 0)
  const normalStock = parts.filter(p => p.stock_quantity > p.minimum_stock)

  const filtered = parts.filter(p =>
    (!activecat || p.category === activecat) &&
    (!search || p.part_code.toLowerCase().includes(search.toLowerCase()) ||
               p.part_name.toLowerCase().includes(search.toLowerCase()) ||
               (p.location||'').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-4">

      {/* ── Stats header ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Item',   val: parts.length,    color: 'text-slate-700',   bg: 'bg-white',        icon: Package },
          { label: 'Stok Normal',  val: normalStock.length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
          { label: 'Stok Rendah',  val: lowStock.length, color: 'text-orange-500',  bg: 'bg-orange-50',    icon: AlertTriangle },
          { label: 'Stok Habis',   val: emptyStock.length, color: 'text-red-600',   bg: 'bg-red-50',       icon: X },
        ].map(({ label, val, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-xl border border-slate-100 p-4 shadow-card ${bg}`}>
            <div className="flex items-center justify-between mb-1">
              <Icon size={16} className={color}/>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Alert banner ─────────────────────────────────────────────── */}
      {(lowStock.length > 0 || emptyStock.length > 0) && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5"/>
          <div className="flex-1 text-sm text-orange-700">
            <span className="font-bold">Perhatian Stok: </span>
            {emptyStock.length > 0 && <span className="text-red-600 font-semibold">{emptyStock.length} item habis</span>}
            {emptyStock.length > 0 && lowStock.length > 0 && <span className="mx-1">·</span>}
            {lowStock.length > 0 && <span>{lowStock.length} item di bawah minimum</span>}
            <span className="ml-2 text-orange-600">— Segera lakukan pengadaan.</span>
          </div>
          {activecat !== '' || search ? null : (
            <button onClick={() => setActiveCat('')}
              className="text-xs text-orange-600 font-semibold underline shrink-0 hover:text-orange-800">
              Lihat Semua
            </button>
          )}
        </div>
      )}

      {/* ── Category chips + search ───────────────────────────────────── */}
      <div className="card !p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCat('')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              activecat === '' ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Semua ({parts.length})
          </button>
          {categories.map(cat => {
            const cnt = parts.filter(p => p.category === cat).length
            const hasAlert = parts.filter(p => p.category === cat && p.stock_quantity <= p.minimum_stock).length > 0
            return (
              <button key={cat} onClick={() => setActiveCat(cat === activecat ? '' : cat)}
                className={`relative text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  activecat === cat ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat} ({cnt})
                {hasAlert && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full"/>}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input !pl-8 text-sm" placeholder="Cari kode, nama, atau lokasi penyimpanan..."
            value={search} onChange={e => setSearch(e.target.value)}/>
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}><X size={13}/></button>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500 font-medium">
            {filtered.length === parts.length ? `${parts.length} spare part` : `${filtered.length} dari ${parts.length} spare part`}
          </p>
          <button className="btn-primary text-xs" onClick={() => { setEditItem(null); setShowForm(true) }}>
            <Plus size={13}/> Tambah Part
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Kode','Nama Part','Kategori','Stok Level','Min','Satuan','Lokasi','Status','Aksi'].map(h=>(
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_,i)=>(
                  <tr key={i}>{[...Array(9)].map((_,j)=>(
                    <td key={j} className="table-td"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-td text-center py-14">
                    <Package size={30} className="mx-auto mb-2 text-slate-200"/>
                    <p className="text-slate-400 text-sm">Tidak ada spare part ditemukan</p>
                  </td>
                </tr>
              ) : filtered.map(p => {
                const level = stockLevel(p.stock_quantity, p.minimum_stock)
                const cfg = LEVEL_CFG[level]
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${level === 'empty' ? 'bg-red-50/30' : level === 'low' ? 'bg-orange-50/20' : ''}`}>
                    <td className="table-td">
                      <span className="font-mono text-[11px] font-bold text-slate-600">{p.part_code}</span>
                    </td>
                    <td className="table-td">
                      <p className="text-sm font-medium text-slate-700">{p.part_name}</p>
                    </td>
                    <td className="table-td"><CatBadge cat={p.category}/></td>
                    <td className="table-td w-36">
                      <StockBar qty={p.stock_quantity} min={p.minimum_stock}/>
                    </td>
                    <td className="table-td text-xs text-slate-500 font-medium">{p.minimum_stock}</td>
                    <td className="table-td text-xs text-slate-500">{p.unit}</td>
                    <td className="table-td text-xs text-slate-400">{p.location||'—'}</td>
                    <td className="table-td">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                            level === 'empty' || level === 'low'
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                          }`}
                          onClick={() => setStockItem(p)}
                        >
                          Stok
                        </button>
                        <button className="p-1.5 hover:bg-amber-50 rounded text-amber-500"
                          onClick={() => { setEditItem(p); setShowForm(true) }}><Pencil size={13}/></button>
                        <button className="p-1.5 hover:bg-red-50 rounded text-red-400"
                          onClick={() => handleDelete(p)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex gap-4 flex-wrap">
            {[
              { label: 'Normal', cnt: normalStock.length, cls: 'text-emerald-600' },
              { label: 'Rendah', cnt: lowStock.length,    cls: 'text-orange-500' },
              { label: 'Habis',  cnt: emptyStock.length,  cls: 'text-red-600' },
            ].map(({ label, cnt, cls }) => (
              <span key={label} className={`text-xs font-semibold ${cls}`}>
                {cnt} {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Terfilter: {filtered.length} item
          </p>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showForm  && <PartFormModal   part={editItem}  onSave={handleSave}   onClose={() => { setShowForm(false); setEditItem(null) }}/>}
      {stockItem && <StockModal      part={stockItem} onAdjust={handleAdjust} onClose={() => setStockItem(null)}/>}
      {toast     && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  )
}
