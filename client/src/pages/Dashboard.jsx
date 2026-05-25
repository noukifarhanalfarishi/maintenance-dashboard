import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, ComposedChart, Line,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, LabelList,
} from 'recharts'
import {
  AlertTriangle, Clock, Gauge, TrendingUp, TrendingDown,
  Cpu, X, Calendar, ChevronRight, Minus, Wrench, AlertCircle,
  CheckCircle2, Hourglass, Package, RotateCcw,
} from 'lucide-react'
import { dashboardApi, problemsApi } from '../api/client'
import { StatusBadge, CategoryBadge } from '../components/Badge'

// ── Colour constants ────────────────────────────────────────────────────────
const NAVY   = '#1a1a2e'
const ACCENT = '#e94560'

const CAT_COLOR = {
  Mechanical: '#3b82f6',
  Electrical: '#f59e0b',
  Pneumatic:  '#06b6d4',
  Hydraulic:  '#8b5cf6',
  Software:   '#10b981',
  Other:      '#94a3b8',
}
const PALETTE = Object.values(CAT_COLOR)

const LINE_COLOR = {
  Atsuen:      '#e94560',
  Sekisou:     '#3b82f6',
  Suchohosei:  '#f59e0b',
  Waterjet:    '#06b6d4',
  Element:     '#8b5cf6',
  Sucho:       '#10b981',
  Wagiri:      '#f97316',
  Senjouki:    '#ec4899',
  Kansho:      '#84cc16',
  Laser:       '#a855f7',
}

// ── Utility ─────────────────────────────────────────────────────────────────
function getPeriodDates(period, cStart, cEnd) {
  const today = new Date().toISOString().slice(0, 10)
  const daysAgo = n => {
    const d = new Date(); d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  switch (period) {
    case 'today': return { start: today, end: today }
    case '7d':    return { start: daysAgo(6), end: today }
    case '30d':   return { start: daysAgo(29), end: today }
    case '3m':    return { start: daysAgo(89), end: today }
    case 'custom':return { start: cStart || today, end: cEnd || today }
    default:      return { start: daysAgo(29), end: today }
  }
}

function fmtDuration(min) {
  if (!min && min !== 0) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs min-w-[130px]">
      <p className="font-semibold text-slate-600 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-slate-800">{p.value}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  )
}

// ── Period Filter ────────────────────────────────────────────────────────────
const PERIOD_OPTS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d',    label: '7 Hari' },
  { value: '30d',   label: '30 Hari' },
  { value: '3m',    label: '3 Bulan' },
  { value: 'custom',label: 'Custom' },
]

function PeriodFilter({ period, onChange, cStart, cEnd, onCStart, onCEnd }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-card gap-0.5">
        {PERIOD_OPTS.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === o.value
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-card">
          <Calendar size={13} className="text-slate-400 shrink-0" />
          <input type="date" className="border-0 outline-none text-xs text-slate-700 bg-transparent"
            value={cStart} onChange={e => onCStart(e.target.value)} />
          <Minus size={10} className="text-slate-300" />
          <input type="date" className="border-0 outline-none text-xs text-slate-700 bg-transparent"
            value={cEnd} onChange={e => onCEnd(e.target.value)} />
        </div>
      )}
    </div>
  )
}

// ── Summary Card ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, change, lowerIsBetter, accentClass, iconClass }) {
  const isGood = change == null ? null : (lowerIsBetter ? change < 0 : change > 0)
  const neutral = change === 0 || change == null

  return (
    <div className={`card ${accentClass} hover:shadow-card-hover transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon size={18} className="text-white" strokeWidth={2.2} />
        </div>
        {change != null ? (
          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
            neutral    ? 'bg-slate-100 text-slate-500' :
            isGood     ? 'bg-emerald-50 text-emerald-600' :
                         'bg-red-50 text-red-500'
          }`}>
            {neutral ? <Minus size={10} /> : change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(change)}%
          </span>
        ) : (
          <span className="w-8" />
        )}
      </div>
      <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{sub}</p>}
    </div>
  )
}

// ── Open Problems status bar ──────────────────────────────────────────────────
function OpenStatusRow({ critical }) {
  return critical > 0
    ? <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1 mt-1">
        <AlertCircle size={11} /> {critical} Critical belum selesai
      </p>
    : <p className="text-[11px] text-emerald-500 flex items-center gap-1 mt-1">
        <CheckCircle2 size={11} /> Tidak ada Critical aktif
      </p>
}

// ── Donut Center Label ────────────────────────────────────────────────────────
function DonutCenter({ total }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-800 leading-none">{total}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Total</p>
      </div>
    </div>
  )
}

// ── Problem Detail Drawer ─────────────────────────────────────────────────────
function DetailDrawer({ problem, onClose }) {
  if (!problem) return null
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-navy-900">
          <div>
            <p className="font-mono text-xs text-white/60 mb-0.5">{problem.ticket_number}</p>
            <p className="font-bold text-white text-sm leading-snug">{problem.description}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white ml-3 shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-5">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={problem.status} />
            <CategoryBadge category={problem.problem_category} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Mesin', `${problem.machine_code || '—'} ${problem.machine_name || ''}`],
              ['Lokasi', problem.location || '—'],
              ['Dilaporkan', problem.reported_by],
              ['Waktu Lapor', new Date(problem.reported_at).toLocaleString('id-ID')],
              ...(problem.closed_at ? [['Waktu Selesai', new Date(problem.closed_at).toLocaleString('id-ID')]] : []),
              ...(problem.technician ? [['Teknisi', problem.technician]] : []),
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">{k}</p>
                <p className="text-xs font-medium text-slate-700 truncate">{v}</p>
              </div>
            ))}
          </div>

          {/* Description / Root Cause */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">Deskripsi Problem</p>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg leading-relaxed">{problem.description}</p>
            </div>
            {problem.root_cause && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">Root Cause</p>
                <p className="text-xs text-slate-700 bg-orange-50 border border-orange-100 p-3 rounded-lg leading-relaxed">{problem.root_cause}</p>
              </div>
            )}
          </div>

          {/* Repairs */}
          {problem.repairs?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-2">
                Riwayat Perbaikan ({problem.repairs.length})
              </p>
              <div className="space-y-2">
                {problem.repairs.map(r => (
                  <div key={r.id} className="border border-slate-100 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-navy-900">{r.technician}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.action_type === 'Corrective' ? 'bg-red-50 text-red-600' :
                        r.action_type === 'Preventive' ? 'bg-green-50 text-green-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>{r.action_type}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{r.action_description}</p>
                    {r.downtime_minutes > 0 && (
                      <p className="text-[10px] text-orange-500 font-semibold mt-1.5 flex items-center gap-1">
                        <Clock size={10} /> {r.downtime_minutes} menit downtime
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-1">{r.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ h = 'h-32', className = '' }) {
  return <div className={`${h} ${className} bg-slate-100 rounded-xl animate-pulse`} />
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [period, setPeriod]       = useState('30d')
  const [cStart, setCStart]       = useState('')
  const [cEnd,   setCEnd]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [detail, setDetail]       = useState(null)

  // Data state
  const [summary,    setSummary]    = useState(null)
  const [weekly,     setWeekly]     = useState([])
  const [byCategory, setByCategory] = useState([])
  const [topDT,      setTopDT]      = useState([])
  const [pareto,     setPareto]     = useState([])
  const [recent,     setRecent]     = useState([])
  const [lowStock,   setLowStock]   = useState([])
  const [paretoLine,    setParetoLine]    = useState([])
  const [paretoMachine, setParetoMachine] = useState([])
  const [newRepeat,     setNewRepeat]     = useState(null)
  const [machineMode,   setMachineMode]   = useState('count') // 'count' | 'dt'

  const { start, end } = useMemo(() => getPeriodDates(period, cStart, cEnd), [period, cStart, cEnd])

  const fetchAll = useCallback(() => {
    if (!start || !end) return
    setLoading(true)
    Promise.all([
      dashboardApi.getSummaryV2({ start, end }),
      dashboardApi.getWeeklyTrend(),
      dashboardApi.getByCategory({ start, end }),
      dashboardApi.getTopDowntime({ start, end }),
      dashboardApi.getPareto({ start, end }),
      dashboardApi.getRecentProblems({ start, end, limit: 10 }),
      dashboardApi.getLowStock(),
      dashboardApi.getParetoLine({ start, end }),
      dashboardApi.getParetoMachine({ start, end }),
      dashboardApi.getNewRepeat({ start, end }),
    ]).then(([s, w, cat, td, par, rec, ls, pl, pm, nr]) => {
      setSummary(s.data)
      setWeekly(w.data)
      setByCategory(cat.data)
      setTopDT(td.data)
      setPareto(par.data)
      setRecent(rec.data)
      setLowStock(ls.data)
      setParetoLine(pl.data)
      setParetoMachine(pm.data)
      setNewRepeat(nr.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openDetail = async (row) => {
    const r = await problemsApi.getById(row.id)
    setDetail(r.data)
  }

  // Derived
  const totalCat = byCategory.reduce((s, d) => s + d.value, 0)

  // ── Status distribution (for mini bar inside open card)
  const statusData = useMemo(() => {
    if (!summary) return []
    return [
      { label: 'Open',         count: 0, color: '#e94560' },
      { label: 'In Progress',  count: 0, color: '#f59e0b' },
      { label: 'Pending Part', count: 0, color: '#f97316' },
    ]
  }, [summary])

  // ── Period label for sub-text
  const periodLabel = period === 'today' ? 'hari ini' :
    period === '7d' ? '7 hari terakhir' :
    period === '30d' ? '30 hari terakhir' :
    period === '3m' ? '3 bulan terakhir' :
    `${start} – ${end}`

  return (
    <div className="space-y-5">

      {/* ── Page Title + Period Filter ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Overview</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Menampilkan data: <span className="font-semibold text-slate-700">{periodLabel}</span>
          </p>
        </div>
        <PeriodFilter
          period={period} onChange={p => { setPeriod(p) }}
          cStart={cStart} cEnd={cEnd}
          onCStart={setCStart} onCEnd={setCEnd}
        />
      </div>

      {/* ── ROW 1: KPI Cards ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} h="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Total Problem */}
          <KpiCard
            icon={AlertTriangle}
            label="Total Problem"
            value={summary?.totalProblems.value ?? '—'}
            sub={`vs ${summary?.totalProblems.prev ?? '?'} periode sebelumnya`}
            change={summary?.totalProblems.change}
            lowerIsBetter={true}
            accentClass="kpi-blue"
            iconClass="bg-blue-500"
          />
          {/* 2. Open Problems */}
          <div className="card kpi-red hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent shrink-0">
                <AlertCircle size={18} className="text-white" strokeWidth={2.2} />
              </div>
              {/* mini status pills */}
              <div className="flex flex-col items-end gap-0.5">
                {[
                  { label: 'Open',    bg: 'bg-red-100   text-red-600' },
                  { label: 'In Prog', bg: 'bg-amber-100 text-amber-600' },
                  { label: 'Pending', bg: 'bg-orange-100 text-orange-600' },
                ].map(s => <span key={s.label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.bg}`}>{s.label}</span>)}
              </div>
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">
              {summary?.openProblems.value ?? '—'}
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Open Problems</p>
            <OpenStatusRow critical={summary?.openProblems.critical ?? 0} />
          </div>
          {/* 3. Downtime */}
          <KpiCard
            icon={Clock}
            label="Total Downtime"
            value={summary ? `${(summary.downtime.value / 60).toFixed(1)}j` : '—'}
            sub={`vs ${summary ? (summary.downtime.prev / 60).toFixed(1) : '?'}j periode sebelumnya`}
            change={summary?.downtime.change}
            lowerIsBetter={true}
            accentClass="kpi-orange"
            iconClass="bg-orange-400"
          />
          {/* 4. MTTR */}
          <KpiCard
            icon={Gauge}
            label="MTTR"
            value={summary ? fmtDuration(summary.mttr.value) : '—'}
            sub={`Mean Time to Repair • sebelumnya: ${summary ? fmtDuration(summary.mttr.prev) : '?'}`}
            change={summary?.mttr.change}
            lowerIsBetter={true}
            accentClass="kpi-purple"
            iconClass="bg-violet-500"
          />
          {/* 5. Repeat Rate */}
          <div className="card kpi-orange hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500 shrink-0">
                <RotateCcw size={18} className="text-white" strokeWidth={2.2} />
              </div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                newRepeat?.summary?.total && (newRepeat.summary.repeat_count / newRepeat.summary.total) > 0.8
                  ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'
              }`}>
                {newRepeat?.summary?.total
                  ? `${Math.round(newRepeat.summary.repeat_count / newRepeat.summary.total * 100)}%`
                  : '—'
                }
              </span>
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">
              {newRepeat?.summary?.repeat_count ?? '—'}
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Repeat Problem</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Baru: {newRepeat?.summary?.new_count ?? '—'} · Total: {newRepeat?.summary?.total ?? '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── ROW 2: Weekly Trend + Donut ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Weekly Trend — 3/5 */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Tren Problem per Minggu</p>
            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">12 Minggu Terakhir</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Problem baru vs diselesaikan</p>

          {loading ? <Skeleton h="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weekly} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Legend
                  iconType="circle" iconSize={7}
                  formatter={v => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
                />
                <Area type="monotone" dataKey="new"    stroke="#3b82f6" fill="url(#gNew)"    strokeWidth={2} name="Problem Baru" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="closed" stroke="#10b981" fill="url(#gClosed)" strokeWidth={2} name="Closed"       dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut — 2/5 */}
        <div className="card lg:col-span-2 flex flex-col">
          <p className="card-title">Distribusi Kategori</p>

          {loading ? <Skeleton h="h-48" /> : (
            <>
              <div className="relative flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      cx="50%" cy="50%"
                      innerRadius="52%" outerRadius="76%"
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {byCategory.map((d, i) => (
                        <Cell key={i} fill={CAT_COLOR[d.name] || PALETTE[i % PALETTE.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`${v} (${Math.round(v/totalCat*100)}%)`, n]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <DonutCenter total={totalCat} />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {byCategory.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CAT_COLOR[d.name] || PALETTE[i % PALETTE.length] }} />
                    <span className="text-[11px] text-slate-600 truncate">{d.name}</span>
                    <span className="text-[11px] font-bold text-slate-700 ml-auto shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 3: Top Downtime + Pareto ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Top 5 Mesin Downtime */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Top Mesin — Downtime Tertinggi</p>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Total jam berhenti per mesin dalam periode</p>

          {loading ? <Skeleton h="h-52" /> : topDT.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <Cpu size={32} className="mb-2" />
              <p className="text-sm">Tidak ada data downtime</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topDT} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}j`} />
                <YAxis dataKey="machine_code" type="category" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="total_hours" name="Downtime (jam)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {topDT.map((_, i) => (
                    <Cell key={i} fill={
                      i === 0 ? ACCENT :
                      i === 1 ? '#f97316' :
                      i === 2 ? '#f59e0b' :
                      i === 3 ? '#3b82f6' : '#06b6d4'
                    } />
                  ))}
                  <LabelList dataKey="total_hours" position="right"
                    style={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    formatter={v => `${v}j`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pareto Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Pareto Problem per Kategori</p>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Bar = jumlah • Garis = kumulatif %</p>

          {loading ? <Skeleton h="h-52" /> : pareto.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <AlertTriangle size={32} className="mb-2" />
              <p className="text-sm">Tidak ada data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={pareto} margin={{ left: -16, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine yAxisId="r" y={80} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: '80%', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b', dy: -4 }} />
                <Bar yAxisId="l" dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {pareto.map((d, i) => (
                    <Cell key={i} fill={CAT_COLOR[d.name] || PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
                <Line yAxisId="r" type="monotone" dataKey="cumulative_pct" name="Kumulatif %"
                  stroke={ACCENT} strokeWidth={2.5} dot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── ROW 3B: Pareto per Line + New vs Repeat ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Pareto per Line — 3/5 */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Pareto Problem per Line</p>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Bar = jumlah problem · Garis = kumulatif %</p>

          {loading ? <Skeleton h="h-52" /> : paretoLine.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <AlertTriangle size={32} className="mb-2" />
              <p className="text-sm">Belum ada data line</p>
              <p className="text-xs mt-1 text-slate-400">Isi kolom "Line" pada data Mesin</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={paretoLine} margin={{ left: -16, right: 20, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine yAxisId="r" y={80} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: '80%', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b', dy: -4 }} />
                <Bar yAxisId="l" dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {paretoLine.map((d, i) => (
                    <Cell key={i} fill={LINE_COLOR[d.name] || PALETTE[i % PALETTE.length]} />
                  ))}
                  <LabelList dataKey="count" position="top"
                    style={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                </Bar>
                <Line yAxisId="r" type="monotone" dataKey="cumulative_pct" name="Kumulatif %"
                  stroke={ACCENT} strokeWidth={2.5} dot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* New vs Repeat — 2/5 */}
        <div className="card lg:col-span-2 flex flex-col">
          <p className="card-title">New vs Repeat Problem</p>

          {loading ? <Skeleton h="h-48" /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-3xl font-bold text-blue-600 leading-none">{newRepeat?.summary?.new_count ?? 0}</p>
                  <p className="text-xs font-semibold text-blue-500 mt-1.5 uppercase tracking-wide">Problem Baru</p>
                  <p className="text-[11px] text-blue-400 mt-0.5">
                    {newRepeat?.summary?.total ? Math.round(newRepeat.summary.new_count / newRepeat.summary.total * 100) : 0}%
                  </p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-3xl font-bold text-red-500 leading-none">{newRepeat?.summary?.repeat_count ?? 0}</p>
                  <p className="text-xs font-semibold text-red-500 mt-1.5 uppercase tracking-wide">Repeat Problem</p>
                  <p className="text-[11px] text-red-400 mt-0.5">
                    {newRepeat?.summary?.total ? Math.round(newRepeat.summary.repeat_count / newRepeat.summary.total * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Repeat rate bar */}
              <div className="mb-4 px-1">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                  <span className="font-semibold uppercase tracking-wide">Repeat Rate</span>
                  <span className={`font-bold ${
                    newRepeat?.summary?.total && (newRepeat.summary.repeat_count / newRepeat.summary.total) > 0.8
                      ? 'text-red-500' : 'text-slate-600'
                  }`}>
                    {newRepeat?.summary?.total ? Math.round(newRepeat.summary.repeat_count / newRepeat.summary.total * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-red-400 h-2 rounded-full transition-all"
                    style={{ width: `${newRepeat?.summary?.total ? Math.round(newRepeat.summary.repeat_count / newRepeat.summary.total * 100) : 0}%` }} />
                </div>
              </div>

              {/* Monthly trend */}
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Tren 6 Bulan</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={newRepeat?.monthly || []} margin={{ left: -20, right: 4, top: 4, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="new_count"    name="Baru"   fill="#3b82f6" radius={[2,2,0,0]} maxBarSize={14} stackId="s" />
                    <Bar dataKey="repeat_count" name="Repeat" fill="#f87171" radius={[2,2,0,0]} maxBarSize={14} stackId="s" />
                    <Legend iconType="circle" iconSize={6} formatter={v => <span style={{fontSize:10,color:'#64748b'}}>{v}</span>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 3C: Pareto per Mesin ────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <p className="card-title !mb-0">Pareto Problem per Mesin (Top 15)</p>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {[{ v: 'count', label: 'Jumlah' }, { v: 'dt', label: 'Downtime' }].map(opt => (
              <button key={opt.v} onClick={() => setMachineMode(opt.v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  machineMode === opt.v ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          {machineMode === 'count' ? 'Diurutkan berdasarkan jumlah problem' : 'Diurutkan berdasarkan total downtime (menit)'}
        </p>

        {loading ? <Skeleton h="h-72" /> : paretoMachine.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-300">
            <Cpu size={32} className="mb-2" />
            <p className="text-sm">Tidak ada data mesin</p>
          </div>
        ) : (() => {
          const sorted = machineMode === 'count'
            ? [...paretoMachine].sort((a, b) => b.count - a.count)
            : [...paretoMachine].sort((a, b) => b.total_dt - a.total_dt)
          const maxVal = machineMode === 'count'
            ? Math.max(...sorted.map(d => d.count))
            : Math.max(...sorted.map(d => d.total_dt))
          return (
            <div className="space-y-1.5">
              {sorted.map((d, i) => {
                const val = machineMode === 'count' ? d.count : d.total_dt
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                const color = i === 0 ? ACCENT : i === 1 ? '#f97316' : i === 2 ? '#f59e0b' : '#3b82f6'
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-slate-400 w-5 text-right shrink-0">{i+1}</span>
                    <span className="text-[11px] font-semibold text-slate-700 w-32 shrink-0 truncate" title={d.machine_code}>{d.machine_code}</span>
                    {d.line && <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">{d.line}</span>}
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${pct}%`, background: color, minWidth: 24 }}>
                        <span className="text-[10px] font-bold text-white leading-none">
                          {machineMode === 'count' ? val : `${val}m`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ── ROW 4: Recent Problems Table ────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">Recent Problems</p>
            <p className="text-[11px] text-slate-400">10 problem terbaru dalam periode · klik baris untuk detail</p>
          </div>
          {lowStock.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
              <Package size={12} />
              {lowStock.length} spare part stok rendah
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Ticket #', 'Mesin', 'Kategori', 'Status', 'Dilaporkan', 'Teknisi', ''].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (j * 7) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center py-12 text-slate-400">
                    <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                    Tidak ada problem dalam periode ini
                  </td>
                </tr>
              ) : recent.map(p => (
                <tr
                  key={p.id}
                  className="table-row-hover"
                  onClick={() => openDetail(p)}
                >
                  <td className="table-td">
                    <span className="font-mono text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {p.ticket_number}
                    </span>
                  </td>
                  <td className="table-td">
                    <p className="font-semibold text-[12px] text-slate-800">{p.machine_code || '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{p.machine_name}</p>
                  </td>
                  <td className="table-td"><CategoryBadge category={p.problem_category} /></td>
                  <td className="table-td"><StatusBadge status={p.status} /></td>
                  <td className="table-td text-[11px] text-slate-400">
                    <p>{new Date(p.reported_at).toLocaleDateString('id-ID')}</p>
                    <p>{p.reported_by}</p>
                  </td>
                  <td className="table-td text-[12px] text-slate-600">{p.technician || <span className="text-slate-300">—</span>}</td>
                  <td className="table-td">
                    <ChevronRight size={14} className="text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {detail && <DetailDrawer problem={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
