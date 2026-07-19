import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  ClipboardList, Clock, Gauge, TrendingUp, TrendingDown,
  Cpu, Calendar, ChevronRight, Minus, AlertCircle,
  CheckCircle2, AlertTriangle, Wrench,
} from 'lucide-react'
import { dashboardApi } from '../api/client'
import { LogTypeBadge, StatusBadge } from '../components/Badge'

// ── Colour constants ────────────────────────────────────────────────────────
const ACCENT = '#e94560'
const CAT_COLOR = {
  Mechanical: '#3b82f6', Electrical: '#f59e0b', Pneumatic: '#06b6d4',
  Hydraulic: '#8b5cf6', Software: '#10b981', Other: '#94a3b8',
}
const PALETTE = Object.values(CAT_COLOR)

// ── Utility ─────────────────────────────────────────────────────────────────
function getPeriodDates(period, cStart, cEnd) {
  const today = new Date().toISOString().slice(0, 10)
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
  switch (period) {
    case 'today':  return { start: today, end: today }
    case '7d':     return { start: daysAgo(6), end: today }
    case '30d':    return { start: daysAgo(29), end: today }
    case '3m':     return { start: daysAgo(89), end: today }
    case 'custom': return { start: cStart || today, end: cEnd || today }
    default:       return { start: daysAgo(29), end: today }
  }
}

function fmtDuration(min) {
  if (!min && min !== 0) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

function fmtDT(dt) { return dt ? dt.slice(11, 16) : '—' }
function fmtLogDate(d) { return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '—' }
function truncate(s, n = 50) { if (!s) return '—'; return s.length > n ? s.slice(0, n - 1) + '…' : s }

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
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === o.value ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-card">
          <Calendar size={13} className="text-slate-400 shrink-0" />
          <input type="date" className="border-0 outline-none text-xs text-slate-700 bg-transparent" value={cStart} onChange={e => onCStart(e.target.value)} />
          <Minus size={10} className="text-slate-300" />
          <input type="date" className="border-0 outline-none text-xs text-slate-700 bg-transparent" value={cEnd} onChange={e => onCEnd(e.target.value)} />
        </div>
      )}
    </div>
  )
}

// ── Department Tabs — PD2 BELT terbagi 2 departemen: Element Ring & Belt Assy ─
const DEPT_OPTS = [
  { value: 'element-ring', label: 'Element Ring',      sub: 'Departemen Element Ring' },
  { value: 'belt-assy',    label: 'Belt Assy',          sub: 'Departemen Belt Assy' },
  { value: 'all',          label: 'Semua (PD2 BELT)',   sub: 'Element Ring + Belt Assy' },
]

function DeptTabs({ dept, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {DEPT_OPTS.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`text-left px-4 py-3 rounded-2xl border-2 transition-all ${
            dept === o.value ? 'border-navy-900 bg-navy-900 shadow-lg shadow-navy-900/20' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}>
          <p className={`text-sm font-bold ${dept === o.value ? 'text-white' : 'text-slate-700'}`}>{o.label}</p>
          <p className={`text-[11px] mt-0.5 ${dept === o.value ? 'text-white/60' : 'text-slate-400'}`}>{o.sub}</p>
        </button>
      ))}
    </div>
  )
}

// ── Progress ring (PM Completion Rate) ──────────────────────────────────────
function ProgressRing({ pct, size = 60, stroke = 6, color }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
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
  const navigate = useNavigate()
  const [dept, setDept] = useState('all') // 'element-ring' | 'belt-assy' | 'all' (PD2 BELT total)
  const [period, setPeriod] = useState('30d')
  const [cStart, setCStart] = useState('')
  const [cEnd,   setCEnd]   = useState('')
  const [loading, setLoading] = useState(true)

  const [kpi,       setKpi]       = useState(null)
  const [weekly,    setWeekly]    = useState([])
  const [byCategory,setByCategory]= useState([])
  const [topDT,     setTopDT]     = useState([])
  const [recent,    setRecent]    = useState([])
  const [pmSummary, setPmSummary] = useState([])
  const [yearlyDT,  setYearlyDT]  = useState([])

  const { start, end } = useMemo(() => getPeriodDates(period, cStart, cEnd), [period, cStart, cEnd])

  const fetchAll = useCallback(() => {
    if (!start || !end) return
    setLoading(true)
    Promise.all([
      dashboardApi.getSummaryV2({ start, end, dept }),
      dashboardApi.getWeeklyTrend({ dept }),
      dashboardApi.getByCategory({ start, end, dept }),
      dashboardApi.getTopDowntime({ start, end, dept }),
      dashboardApi.getRecentActivity({ limit: 10, dept }),
      dashboardApi.getPmSummary({ dept }),
      dashboardApi.getYearlyDowntime({ dept }),
    ]).then(([k, w, cat, td, rec, pm, yr]) => {
      setKpi(k.data); setWeekly(w.data); setByCategory(cat.data)
      setTopDT(td.data); setRecent(rec.data); setPmSummary(pm.data)
      setYearlyDT(yr.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end, dept])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh setiap 30 detik supaya dashboard tetap up-to-date tanpa reload manual
  useEffect(() => {
    const t = setInterval(fetchAll, 30000)
    return () => clearInterval(t)
  }, [fetchAll])

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const totalCat = byCategory.reduce((s, d) => s + d.value, 0)
  const pmRingColor = !kpi ? '#94a3b8' : kpi.pmCompletion.rate > 90 ? '#10b981' : kpi.pmCompletion.rate >= 70 ? '#f59e0b' : '#ef4444'

  const periodLabel = period === 'today' ? 'hari ini' :
    period === '7d' ? '7 hari terakhir' :
    period === '30d' ? '30 hari terakhir' :
    period === '3m'  ? '3 bulan terakhir' :
    `${start} – ${end}`

  // Trend downtime: bandingkan rata-rata 6 minggu pertama vs 6 minggu terakhir
  const downtimeTrend = useMemo(() => {
    if (weekly.length < 12) return null
    const firstHalf = weekly.slice(0, 6).reduce((s, w) => s + w.downtime_hours, 0) / 6
    const secondHalf = weekly.slice(6).reduce((s, w) => s + w.downtime_hours, 0) / 6
    if (firstHalf === 0) return null
    return Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
  }, [weekly])

  return (
    <div className="space-y-5">

      {/* ── Department Tabs ──────────────────────────────────────────────── */}
      <DeptTabs dept={dept} onChange={setDept} />

      {/* ── Page Title + Period Filter ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">Overview</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Downtime, MTTR, kategori & top mesin: <span className="font-semibold text-slate-700">{periodLabel}</span>
          </p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} cStart={cStart} cEnd={cEnd} onCStart={setCStart} onCEnd={setCEnd} />
      </div>

      {/* ── ROW 1: KPI Cards ──────────────────────────────────────────────── */}
      {loading || !kpi ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} h="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

          {/* 1. Aktivitas Hari Ini */}
          <div className="card kpi-blue hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 mb-4">
              <ClipboardList size={18} className="text-white" strokeWidth={2.2} />
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{kpi.todayActivity.total}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Aktivitas Hari Ini</p>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="text-blue-600 font-semibold">P: {kpi.todayActivity.planning}</span>
              {' | '}
              <span className="text-orange-500 font-semibold">T: {kpi.todayActivity.trouble}</span>
            </p>
          </div>

          {/* 2. PM Completion Rate */}
          <div className="card hover:shadow-card-hover transition-shadow flex items-center gap-3">
            <ProgressRing pct={kpi.pmCompletion.rate} color={pmRingColor} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PM Completion</p>
              <p className="text-[11px] text-slate-400 mt-1">{kpi.pmCompletion.onTrack}/{kpi.pmCompletion.total} on track</p>
            </div>
          </div>

          {/* 3. Total Downtime */}
          <div className="card kpi-orange hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-400"><Clock size={18} className="text-white" strokeWidth={2.2} /></div>
              {kpi.downtime.change != null && (
                <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
                  kpi.downtime.change === 0 ? 'bg-slate-100 text-slate-500' : kpi.downtime.change < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {kpi.downtime.change === 0 ? <Minus size={10} /> : kpi.downtime.change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(kpi.downtime.change)}%
                </span>
              )}
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{(kpi.downtime.value / 60).toFixed(1)}j</p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Total Downtime</p>
            <p className="text-[11px] text-slate-400 mt-1">vs {(kpi.downtime.prev / 60).toFixed(1)}j periode sebelumnya</p>
          </div>

          {/* 4. MTTR */}
          <div className="card kpi-purple hover:shadow-card-hover transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500"><Gauge size={18} className="text-white" strokeWidth={2.2} /></div>
              {kpi.mttr.change != null && (
                <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
                  kpi.mttr.change === 0 ? 'bg-slate-100 text-slate-500' : kpi.mttr.change < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {kpi.mttr.change === 0 ? <Minus size={10} /> : kpi.mttr.change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(kpi.mttr.change)}%
                </span>
              )}
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{fmtDuration(kpi.mttr.value)}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">MTTR</p>
            <p className="text-[11px] text-slate-400 mt-1">sebelumnya: {fmtDuration(kpi.mttr.prev)}</p>
          </div>

          {/* 5. Open Items */}
          <div className="card kpi-red hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent mb-4"><AlertCircle size={18} className="text-white" strokeWidth={2.2} /></div>
            <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight">{kpi.openItems.count}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Open Items</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Carry Over: {kpi.openItems.carryOver} · Pending: {kpi.openItems.pendingPart} · Progress: {kpi.openItems.inProgress}
            </p>
          </div>
        </div>
      )}

      {/* ── ROW 2: Stacked Bar (Planning vs Trouble) + Donut Kategori ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Planning vs Trouble per minggu — 3/5 */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Planning vs Trouble per Minggu</p>
            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">12 Minggu Terakhir</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Idealnya trouble menurun seiring planning (PM) yang konsisten</p>

          {loading ? <Skeleton h="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekly} margin={{ left: -20, right: 4, top: 4, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                <Bar dataKey="planning" name="Planning" stackId="s" fill="#3b82f6" radius={[0, 0, 0, 0]} maxBarSize={26} />
                <Bar dataKey="trouble"  name="Trouble"  stackId="s" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut kategori trouble bulan ini — 2/5 */}
        <div className="card lg:col-span-2 flex flex-col">
          <p className="card-title">Distribusi Kategori Trouble</p>

          {loading ? <Skeleton h="h-48" /> : totalCat === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <AlertTriangle size={28} className="mb-2" /><p className="text-sm">Tidak ada data trouble</p>
            </div>
          ) : (
            <>
              <div className="relative flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byCategory} cx="50%" cy="50%" innerRadius="52%" outerRadius="76%" paddingAngle={3} dataKey="value">
                      {byCategory.map((d, i) => <Cell key={i} fill={CAT_COLOR[d.name] || PALETTE[i % PALETTE.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} (${Math.round(v / totalCat * 100)}%)`, n]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800 leading-none">{totalCat}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Total</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {byCategory.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLOR[d.name] || PALETTE[i % PALETTE.length] }} />
                    <span className="text-[11px] text-slate-600 truncate">{d.name}</span>
                    <span className="text-[11px] font-bold text-slate-700 ml-auto shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 3: Top 5 Mesin + Trend Downtime ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Top 5 Mesin Trouble Terbanyak */}
        <div className="card">
          <p className="card-title !mb-1">Top 5 Mesin — Trouble Terbanyak</p>
          <p className="text-[11px] text-slate-400 mb-4">Jumlah trouble & total downtime dalam periode</p>

          {loading ? <Skeleton h="h-52" /> : topDT.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <Cpu size={32} className="mb-2" /><p className="text-sm">Tidak ada data trouble</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topDT} layout="vertical" margin={{ left: 0, right: 44, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="machine_code" type="category" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="problem_count" name="Jumlah Trouble" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {topDT.map((_, i) => <Cell key={i} fill={i === 0 ? ACCENT : i === 1 ? '#f97316' : i === 2 ? '#f59e0b' : '#3b82f6'} />)}
                  <LabelList dataKey="total_hours" position="right" style={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} formatter={v => `${v}j`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trend Downtime per Minggu */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <p className="card-title !mb-0">Trend Downtime per Minggu</p>
            {downtimeTrend != null && (
              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${downtimeTrend <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {downtimeTrend <= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                {downtimeTrend <= 0 ? 'Menurun' : 'Naik'} {Math.abs(downtimeTrend)}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-4">Total downtime (jam) · 12 minggu terakhir</p>

          {loading ? <Skeleton h="h-52" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekly} margin={{ left: -16, right: 12, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}j`} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="downtime_hours" name="Downtime (jam)" stroke={ACCENT} strokeWidth={2.5}
                  dot={{ r: 3, fill: ACCENT, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── ROW 3.5: Trend Downtime Tahunan — full width, 12 bulan penuh ────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <p className="card-title !mb-0">Trend Downtime Tahunan {currentYear}</p>
          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">Jan – Des {currentYear}</span>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">Total downtime trouble (menit) per bulan sepanjang tahun berjalan</p>

        {loading ? <Skeleton h="h-56" /> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={yearlyDT} margin={{ left: -8, right: 12, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="yearlyDowntimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={v => v.toLocaleString('id-ID')} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="downtime_minutes" name="Downtime" unit=" menit" stroke={ACCENT} strokeWidth={2.5}
                fill="url(#yearlyDowntimeGradient)" dot={{ r: 3, fill: ACCENT, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── ROW 4: PM Compliance Summary + Recent Activity ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* PM Compliance Summary — 2/5 */}
        <div className="card lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="card-title !mb-0">PM Compliance Summary</p>
            <button onClick={() => navigate('/pm-schedule')} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
              Lihat semua <ChevronRight size={12} />
            </button>
          </div>

          {loading ? <Skeleton h="h-48" /> : pmSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-300 py-8">
              <Wrench size={28} className="mb-2" /><p className="text-sm">Belum ada jadwal PM</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pmSummary.map(p => (
                <div key={p.pm_type} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${p.overdue > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{p.pm_type}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.on_track}/{p.total} on track</p>
                  </div>
                  {p.overdue > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 shrink-0 ml-2">
                      <AlertTriangle size={11} /> {p.overdue} overdue
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0 ml-2">
                      <CheckCircle2 size={11} /> Aman
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity — 3/5 */}
        <div className="card !p-0 overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-700">Recent Activity</p>
            <p className="text-[11px] text-slate-400">10 log terbaru · klik baris untuk buka Daily Log</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Tipe', 'Mesin', 'Deskripsi', 'Teknisi', 'Status', 'Waktu', ''].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>{[...Array(7)].map((_, j) => (
                      <td key={j} className="table-td"><div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (j * 7) % 40}%` }} /></td>
                    ))}</tr>
                  ))
                ) : recent.length === 0 ? (
                  <tr><td colSpan={7} className="table-td text-center py-12 text-slate-400">
                    <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                    Belum ada aktivitas hari ini. Mulai catat dengan tombol di halaman Daily Log.
                  </td></tr>
                ) : recent.map(r => (
                  <tr key={r.id} className="table-row-hover" onClick={() => navigate('/daily-log')}>
                    <td className="table-td"><LogTypeBadge type={r.log_type} /></td>
                    <td className="table-td">
                      <p className="font-semibold text-[12px] text-slate-800">{r.machine_code || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{r.machine_name}</p>
                    </td>
                    <td className="table-td text-[12px] text-slate-600 max-w-[180px]">{truncate(r.description, 40)}</td>
                    <td className="table-td text-[12px] text-slate-600">{r.technician || <span className="text-slate-300">—</span>}</td>
                    <td className="table-td"><StatusBadge status={r.status} /></td>
                    <td className="table-td text-[11px] text-slate-400">
                      <p>{fmtLogDate(r.log_date)}</p>
                      <p className="font-mono">{fmtDT(r.start_time)}</p>
                    </td>
                    <td className="table-td"><ChevronRight size={14} className="text-slate-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
