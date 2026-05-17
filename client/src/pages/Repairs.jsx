import { useEffect, useState } from 'react'
import { Plus, X, Pencil, Trash2, Clock } from 'lucide-react'
import { repairsApi, problemsApi } from '../api/client'

const ACTION_TYPES = ['Corrective', 'Preventive', 'Predictive']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function RepairForm({ initial, problems, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    problem_id: '', action_type: 'Corrective', action_description: '',
    technician: '', start_time: '', end_time: '', downtime_minutes: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Problem Terkait *</label>
          <select className="input" required value={form.problem_id} onChange={e => set('problem_id', e.target.value)}>
            <option value="">-- Pilih Tiket --</option>
            {problems.map(p => <option key={p.id} value={p.id}>{p.ticket_number} — {p.description?.slice(0, 50)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipe Aksi *</label>
          <select className="input" required value={form.action_type} onChange={e => set('action_type', e.target.value)}>
            {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Teknisi *</label>
          <input className="input" required value={form.technician} onChange={e => set('technician', e.target.value)} placeholder="Nama teknisi" />
        </div>
        <div>
          <label className="label">Mulai *</label>
          <input type="datetime-local" className="input" required value={form.start_time?.slice(0, 16)} onChange={e => set('start_time', e.target.value)} />
        </div>
        <div>
          <label className="label">Selesai</label>
          <input type="datetime-local" className="input" value={form.end_time?.slice(0, 16) || ''} onChange={e => set('end_time', e.target.value)} />
        </div>
        <div>
          <label className="label">Downtime (menit)</label>
          <input type="number" className="input" value={form.downtime_minutes} onChange={e => set('downtime_minutes', e.target.value)} placeholder="0" />
        </div>
      </div>
      <div>
        <label className="label">Deskripsi Tindakan *</label>
        <textarea className="input" rows={3} required value={form.action_description} onChange={e => set('action_description', e.target.value)} placeholder="Jelaskan tindakan perbaikan yang dilakukan..." />
      </div>
      <div>
        <label className="label">Catatan</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Catatan tambahan..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn-primary">Simpan</button>
      </div>
    </form>
  )
}

const ACTION_COLORS = {
  Corrective: 'bg-red-50 text-red-700 border-red-200',
  Preventive: 'bg-green-50 text-green-700 border-green-200',
  Predictive: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function Repairs() {
  const [repairs, setRepairs] = useState([])
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const load = () => {
    setLoading(true)
    repairsApi.getAll(filterType ? { action_type: filterType } : {})
      .then(r => { setRepairs(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { problemsApi.getAll({ limit: 200 }).then(r => setProblems(r.data.data)) }, [])
  useEffect(() => { load() }, [filterType])

  const handleSave = async (form) => {
    if (editItem) await repairsApi.update(editItem.id, form)
    else await repairsApi.create(form)
    setShowForm(false); setEditItem(null); load()
  }

  const handleDelete = async (r) => {
    if (!confirm(`Hapus data perbaikan ini?`)) return
    await repairsApi.delete(r.id)
    load()
  }

  const filtered = repairs.filter(r =>
    !search || r.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.technician?.toLowerCase().includes(search.toLowerCase()) ||
    r.machine_code?.toLowerCase().includes(search.toLowerCase())
  )

  const totalDowntime = repairs.reduce((acc, r) => acc + (r.downtime_minutes || 0), 0)
  const totalH = Math.floor(totalDowntime / 60)
  const totalM = totalDowntime % 60

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catatan Perbaikan</h1>
          <p className="text-sm text-gray-500">{repairs.length} record • Total downtime: {totalH}j {totalM}m</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setEditItem(null); setShowForm(true) }}>
          <Plus size={16} /> Tambah Perbaikan
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {ACTION_TYPES.map(t => {
          const count = repairs.filter(r => r.action_type === t).length
          const dt = repairs.filter(r => r.action_type === t).reduce((a, r) => a + (r.downtime_minutes || 0), 0)
          return (
            <div key={t} className={`rounded-xl p-4 border ${ACTION_COLORS[t]}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs opacity-70">{Math.floor(dt / 60)}j {dt % 60}m downtime</p>
            </div>
          )
        })}
      </div>

      <div className="card !p-4 flex gap-3">
        <input className="input flex-1" placeholder="Cari tiket, mesin, teknisi..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Semua Tipe</option>
          {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Tiket</th>
                <th className="table-th">Mesin</th>
                <th className="table-th">Tipe</th>
                <th className="table-th">Teknisi</th>
                <th className="table-th">Tindakan</th>
                <th className="table-th">Mulai</th>
                <th className="table-th">Downtime</th>
                <th className="table-th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="table-td text-center py-10 text-gray-400">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-td text-center py-10 text-gray-400">Tidak ada data</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="table-td font-mono text-xs text-blue-600">{r.ticket_number}</td>
                  <td className="table-td text-xs">{r.machine_code || '—'}</td>
                  <td className="table-td">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ACTION_COLORS[r.action_type]}`}>{r.action_type}</span>
                  </td>
                  <td className="table-td text-sm">{r.technician}</td>
                  <td className="table-td max-w-xs"><p className="text-xs truncate">{r.action_description}</p></td>
                  <td className="table-td text-xs text-gray-400">{new Date(r.start_time).toLocaleDateString('id-ID')}</td>
                  <td className="table-td">
                    {r.downtime_minutes ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <Clock size={12} />{r.downtime_minutes} mnt
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" onClick={() => { setEditItem(r); setShowForm(true) }}><Pencil size={14} /></button>
                      <button className="p-1.5 hover:bg-red-50 rounded text-red-600" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editItem ? 'Edit Perbaikan' : 'Tambah Catatan Perbaikan'} onClose={() => { setShowForm(false); setEditItem(null) }}>
          <RepairForm initial={editItem} problems={problems} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null) }} />
        </Modal>
      )}
    </div>
  )
}
