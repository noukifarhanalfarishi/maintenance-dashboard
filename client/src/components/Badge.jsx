// ── Status Badge ────────────────────────────────────────────────────────────
// Open=red  In Progress=yellow  Pending Part=blue  Closed/Completed=green  Carry Over=red
export function StatusBadge({ status }) {
  const MAP = {
    'Open':         'bg-red-100    text-red-700    border border-red-200',
    'In Progress':  'bg-amber-100  text-amber-700  border border-amber-200',
    'Pending Part': 'bg-sky-100    text-sky-700    border border-sky-200',
    'Closed':       'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Completed':    'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Carry Over':   'bg-red-100    text-red-700    border border-red-200',
    'active':       'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'inactive':     'bg-slate-100  text-slate-500  border border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${MAP[status] || 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
      {status}
    </span>
  )
}

// ── Log Type Badge — Planning=biru  Trouble=orange ─────────────────────────
export function LogTypeBadge({ type }) {
  const MAP = {
    'Planning': 'bg-blue-100   text-blue-700   border border-blue-200',
    'Trouble':  'bg-orange-100 text-orange-700 border border-orange-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${MAP[type] || 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
      {type}
    </span>
  )
}

// ── Priority Badge ──────────────────────────────────────────────────────────
// Critical=red  High=orange  Medium=yellow  Low=green
export function PriorityBadge({ priority }) {
  const MAP = {
    'Critical': 'bg-red-600    text-white',
    'High':     'bg-orange-500 text-white',
    'Medium':   'bg-amber-400  text-white',
    'Low':      'bg-emerald-500 text-white',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${MAP[priority] || 'bg-slate-400 text-white'}`}>
      {priority}
    </span>
  )
}

// ── Category Badge ──────────────────────────────────────────────────────────
// Kategori Trouble (Mechanical..Other) + Kategori PM (Daily Check..Overhaul)
export function CategoryBadge({ category }) {
  const MAP = {
    'Mechanical': 'bg-blue-50    text-blue-700',
    'Electrical': 'bg-yellow-50  text-yellow-700',
    'Pneumatic':  'bg-sky-50     text-sky-700',
    'Hydraulic':  'bg-indigo-50  text-indigo-700',
    'Software':   'bg-purple-50  text-purple-700',
    'Other':      'bg-slate-50   text-slate-600',
    'Daily Check':    'bg-teal-50    text-teal-700',
    'Weekly PM':      'bg-cyan-50    text-cyan-700',
    'Monthly PM':     'bg-blue-50    text-blue-700',
    '3-Monthly PM':   'bg-indigo-50  text-indigo-700',
    '6-Monthly PM':   'bg-violet-50  text-violet-700',
    'Yearly PM':      'bg-fuchsia-50 text-fuchsia-700',
    'Overhaul':       'bg-rose-50    text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${MAP[category] || 'bg-slate-50 text-slate-600'}`}>
      {category}
    </span>
  )
}

// ── Action Type Badge ───────────────────────────────────────────────────────
export function ActionBadge({ type }) {
  const MAP = {
    'Corrective': 'bg-red-50   text-red-600   border border-red-200',
    'Preventive': 'bg-green-50 text-green-600 border border-green-200',
    'Predictive': 'bg-blue-50  text-blue-600  border border-blue-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${MAP[type] || 'bg-slate-50 text-slate-600'}`}>
      {type}
    </span>
  )
}
