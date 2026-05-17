import { useEffect, useState } from 'react'
import { Plus, X, Pencil, UserCheck, UserX } from 'lucide-react'
import { usersApi } from '../api/client'

const ROLES = ['Admin', 'Supervisor', 'Technician', 'Operator']
const DEPARTMENTS = [
  'Element Ring Dept', 'Belt Assy Dept', 'Maintenance', 'Engineering',
  'Quality Control', 'Utility', 'Warehouse', 'Production Control', 'IT',
]
const ROLE_COLORS = {
  Admin: 'bg-red-100 text-red-700',
  Supervisor: 'bg-purple-100 text-purple-700',
  Technician: 'bg-blue-100 text-blue-700',
  Operator: 'bg-green-100 text-green-700',
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function UserForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { username: '', password: '', full_name: '', role: 'Technician', department: 'Element Ring Dept', is_active: 1 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Nama Lengkap *</label>
        <input className="input" required value={form.full_name} onChange={e => set('full_name', e.target.value)} />
      </div>
      <div>
        <label className="label">Username *</label>
        <input className="input" required value={form.username} onChange={e => set('username', e.target.value)} />
      </div>
      {!initial && (
        <div>
          <label className="label">Password *</label>
          <input type="password" className="input" required value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Role *</label>
          <select className="input" required value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Departemen</label>
          <select className="input" value={form.department || ''} onChange={e => set('department', e.target.value)}>
            <option value="">—</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {initial && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={form.is_active === 1} onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
          <label htmlFor="active" className="text-sm">User Aktif</label>
        </div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn-primary">Simpan</button>
      </div>
    </form>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const load = () => {
    setLoading(true)
    usersApi.getAll().then(r => { setUsers(r.data); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form) => {
    if (editItem) await usersApi.update(editItem.id, form)
    else await usersApi.create(form)
    setShowForm(false); setEditItem(null); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen User</h1>
          <p className="text-sm text-gray-500">{users.filter(u => u.is_active).length} aktif dari {users.length} user</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setEditItem(null); setShowForm(true) }}>
          <Plus size={16} /> Tambah User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-16 text-gray-400">Memuat...</div>
        ) : users.map(u => (
          <div key={u.id} className={`card hover:shadow-md transition-shadow ${!u.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                  {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{u.full_name}</p>
                  <p className="text-xs text-gray-400">@{u.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {u.is_active ? <UserCheck size={16} className="text-green-500" /> : <UserX size={16} className="text-gray-400" />}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>{u.role}</span>
              {u.department && <span className="text-xs text-gray-400">{u.department}</span>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs" onClick={() => { setEditItem(u); setShowForm(true) }}>
                <Pencil size={13} /> Edit User
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title={editItem ? `Edit: ${editItem.full_name}` : 'Tambah User Baru'} onClose={() => { setShowForm(false); setEditItem(null) }}>
          <UserForm initial={editItem} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null) }} />
        </Modal>
      )}
    </div>
  )
}
