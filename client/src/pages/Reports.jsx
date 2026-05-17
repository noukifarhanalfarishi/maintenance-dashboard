import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FileText, Download, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Calendar, Cpu, TrendingUp, TrendingDown, Minus,
  Clock, Wrench, AlertTriangle, Package, RefreshCw, ChevronRight,
  BarChart2, Printer,
} from 'lucide-react'
import { reportsApi, machinesApi } from '../api/client'
import { PriorityBadge, StatusBadge, CategoryBadge } from '../components/Badge'

// ══════════════════════════════════════════════════════════════════════════
// CONSTANTS & UTILITIES
// ══════════════════════════════════════════════════════════════════════════
const CAT_COLOR = {
  Mechanical: '#3b82f6', Electrical: '#f59e0b', Pneumatic: '#06b6d4',
  Hydraulic: '#8b5cf6', Software: '#10b981', Other: '#94a3b8',
}
const PALETTE = Object.values(CAT_COLOR)
const PRIO_COLOR = { Critical:'#dc2626', High:'#f97316', Medium:'#f59e0b', Low:'#22c55e' }

const today    = new Date().toISOString().slice(0, 10)
const day30ago = (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })()

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtDT    = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const fmtDur   = (m) => { if (!m) return '—'; const h=Math.floor(m/60); return h>0?`${h}j ${m%60}m`:`${m}m` }
const fmtHrs   = (h) => h==null ? '—' : `${h} jam`
const nowStr   = () => new Date().toLocaleString('id-ID')

// ── Preset buttons ────────────────────────────────────────────────────────
const PRESETS = [
  { label: '7 Hari',   days: 7  },
  { label: '30 Hari',  days: 30 },
  { label: '3 Bulan',  days: 90 },
  { label: '6 Bulan',  days: 180},
]

// ══════════════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ══════════════════════════════════════════════════════════════════════════
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${type==='error'?'bg-red-500':'bg-emerald-600'}`}>
      {type==='error'?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>} {msg}
    </div>
  )
}

function ReportSection({ title, icon: Icon, children, className='' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 pb-2 border-b-2 border-navy-900/10">
        {Icon && <Icon size={15} className="text-navy-900"/>}
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function KpiBox({ label, value, sub, icon: Icon, accent='bg-blue-500' }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-card">
      <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center shrink-0`}>
        <Icon size={16} className="text-white"/>
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-1">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function DataTable({ headers, rows, emptyMsg='Tidak ada data' }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{headers.map((h,i)=><th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length===0
            ? <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-slate-400">{emptyMsg}</td></tr>
            : rows.map((row,i)=>(
                <tr key={i} className={i%2===0?'bg-white':'bg-slate-50/50'}>
                  {row.map((cell,j)=><td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap">{cell}</td>)}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// SUMMARY REPORT CONTENT
// ══════════════════════════════════════════════════════════════════════════
function SummaryReportContent({ data, period }) {
  const ov = data.overview
  const totalCat = data.byCategory.reduce((s,d)=>s+d.value,0)

  return (
    <div className="space-y-8">
      {/* ── KPI Overview ─────────────────────────────────────────────── */}
      <ReportSection title="Ringkasan Eksekutif" icon={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Total Problem" value={ov.totalProblems} sub={`${ov.openProblems} masih open`} icon={AlertTriangle} accent="bg-blue-500"/>
          <KpiBox label="Total Downtime" value={fmtDur(ov.totalDowntime)} sub={`Avg ${fmtDur(ov.avgDowntimePerProblem)}/problem`} icon={Clock} accent="bg-orange-400"/>
          <KpiBox label="MTTR" value={fmtDur(ov.mttr)} sub="Mean Time to Repair" icon={Wrench} accent="bg-violet-500"/>
          <KpiBox label="MTBF Fasilitas" value={fmtHrs(ov.mtbf_hours)} sub="Mean Time Between Failures" icon={TrendingUp} accent="bg-emerald-500"/>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {[
            {l:'Open',         v:ov.openProblems,   c:'bg-red-50    text-red-600   border-red-200'},
            {l:'Closed',       v:ov.closedProblems, c:'bg-green-50  text-green-600 border-green-200'},
            {l:'Critical',     v:ov.criticalCount,  c:'bg-red-100   text-red-700   border-red-300'},
            {l:'Avg Downtime', v:fmtDur(ov.avgDowntimePerProblem), c:'bg-orange-50 text-orange-600 border-orange-200'},
          ].map(({l,v,c})=>(
            <div key={l} className={`rounded-xl border px-3 py-2 text-center ${c}`}>
              <p className="text-xl font-bold">{v}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{l}</p>
            </div>
          ))}
        </div>
      </ReportSection>

      {/* ── Monthly Trend ────────────────────────────────────────────── */}
      <ReportSection title="Trend Bulanan" icon={TrendingUp}>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.monthlyTrend} margin={{left:-20,right:4,top:4,bottom:0}}>
              <defs>
                <linearGradient id="rGNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="rGClosed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e2e8f0'}}/>
              <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Area type="monotone" dataKey="total"  name="Total"  stroke="#3b82f6" fill="url(#rGNew)"    strokeWidth={2} dot={{r:3}}/>
              <Area type="monotone" dataKey="closed" name="Closed" stroke="#10b981" fill="url(#rGClosed)" strokeWidth={2} dot={{r:3}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>

      {/* ── Category + Priority side by side ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <ReportSection title="Breakdown per Kategori" icon={BarChart2}>
          <div className="grid grid-cols-5 gap-3">
            {/* Pie */}
            <div className="col-span-2 relative">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={data.byCategory} cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" paddingAngle={3} dataKey="count">
                    {data.byCategory.map((d,i)=><Cell key={i} fill={CAT_COLOR[d.name]||PALETTE[i%PALETTE.length]} stroke="none"/>)}
                  </Pie>
                  <Tooltip contentStyle={{fontSize:10,borderRadius:8}} formatter={(v,n)=>[`${v} (${Math.round(v/ov.totalProblems*100)}%)`,n]}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Table */}
            <div className="col-span-3">
              <DataTable
                headers={['Kategori','Jml','%','Downtime']}
                rows={data.byCategory.map(r=>[
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{background:CAT_COLOR[r.name]||'#94a3b8'}}/>{r.name}</span>,
                  <span className="font-bold">{r.count}</span>, `${r.pct}%`, fmtDur(r.downtime)
                ])}
              />
            </div>
          </div>
        </ReportSection>

        <ReportSection title="Breakdown per Priority" icon={AlertTriangle}>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.byPriority} layout="vertical" margin={{left:10,right:30,top:4,bottom:4}}>
                <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis dataKey="priority" type="category" tick={{fontSize:10,fill:'#475569',fontWeight:600}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip contentStyle={{fontSize:10,borderRadius:8}}/>
                <Bar dataKey="count" radius={[0,4,4,0]} maxBarSize={18}>
                  {data.byPriority.map((d,i)=><Cell key={i} fill={PRIO_COLOR[d.priority]||'#94a3b8'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            headers={['Priority','Jml','%','Downtime']}
            rows={data.byPriority.map(r=>[
              <PriorityBadge priority={r.priority}/>,
              <span className="font-bold">{r.count}</span>, `${r.pct}%`, fmtDur(r.downtime)
            ])}
          />
        </ReportSection>
      </div>

      {/* ── Top Machines ──────────────────────────────────────────────── */}
      <ReportSection title="Top Mesin Bermasalah" icon={Cpu}>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="sm:col-span-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={data.byMachine.slice(0,6)} layout="vertical" margin={{left:0,right:36,top:4,bottom:4}}>
                <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis dataKey="machine_code" type="category" tick={{fontSize:10,fill:'#475569',fontWeight:600}} axisLine={false} tickLine={false} width={56}/>
                <Tooltip contentStyle={{fontSize:10,borderRadius:8}}/>
                <Bar dataKey="count" name="Problem" fill="#3b82f6" radius={[0,4,4,0]} maxBarSize={20}>
                  {data.byMachine.slice(0,6).map((_,i)=>(
                    <Cell key={i} fill={i===0?'#e94560':i===1?'#f97316':i===2?'#f59e0b':'#3b82f6'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="sm:col-span-2">
            <DataTable
              headers={['Mesin','Jml','Open','Downtime']}
              rows={data.byMachine.map(r=>[
                <div><p className="font-bold text-xs text-blue-600">{r.machine_code}</p><p className="text-[10px] text-slate-400 max-w-[90px] truncate">{r.machine_name}</p></div>,
                <span className="font-bold">{r.count}</span>,
                <span className={r.open_count>0?'text-red-600 font-bold':'text-slate-400'}>{r.open_count}</span>,
                fmtDur(r.downtime)
              ])}
            />
          </div>
        </div>
      </ReportSection>

      {/* ── Top Recurring ─────────────────────────────────────────────── */}
      {data.topProblems.length > 0 && (
        <ReportSection title="Top 5 Problem Berulang (Mesin + Kategori Sama)" icon={RefreshCw}>
          <DataTable
            headers={['Mesin','Kategori','Frekuensi','Total Downtime']}
            rows={data.topProblems.map((r,i)=>[
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i===0?'bg-red-500':i===1?'bg-orange-400':'bg-amber-400'}`}>{i+1}</span>
                <div><p className="font-bold text-xs text-blue-600">{r.machine_code}</p><p className="text-[10px] text-slate-400">{r.machine_name}</p></div>
              </div>,
              <CategoryBadge category={r.problem_category}/>,
              <span className="font-bold text-red-600">{r.count}×</span>,
              fmtDur(r.total_downtime)
            ])}
          />
        </ReportSection>
      )}

      {/* ── Top Spare Parts ───────────────────────────────────────────── */}
      {data.topSpareParts.length > 0 && (
        <ReportSection title="Top Spare Parts Digunakan" icon={Package}>
          <DataTable
            headers={['#','Kode','Nama Part','Satuan','Frekuensi']}
            rows={data.topSpareParts.map((r,i)=>[
              <span className="text-slate-400 font-bold">{i+1}</span>,
              <span className="font-mono font-bold text-[11px]">{r.part_code}</span>,
              r.part_name,
              r.unit,
              <span className="font-bold text-blue-600">{r.times_used}×</span>
            ])}
          />
        </ReportSection>
      )}

      {/* ── Problem List ──────────────────────────────────────────────── */}
      <ReportSection title={`Daftar Problem (${data.recentProblems.length} ditampilkan)`} icon={FileText}>
        <DataTable
          headers={['Ticket#','Mesin','Kategori','Priority','Status','Deskripsi','Pelapor','Tgl Lapor','Downtime','Teknisi']}
          rows={data.recentProblems.map(p=>[
            <span className="font-mono font-bold text-[10px] text-blue-600">{p.ticket_number}</span>,
            <div><p className="font-bold text-[10px]">{p.machine_code||'—'}</p><p className="text-slate-400 text-[9px]">{p.machine_name}</p></div>,
            <CategoryBadge category={p.problem_category}/>,
            <PriorityBadge priority={p.priority}/>,
            <StatusBadge status={p.status}/>,
            <p className="max-w-[140px] truncate text-[10px]">{p.description}</p>,
            <span className="text-[10px]">{p.reported_by}</span>,
            <span className="text-[10px]">{fmtDate(p.reported_at)}</span>,
            <span className="text-[10px] text-orange-600">{fmtDur(p.downtime)}</span>,
            <span className="text-[10px]">{p.technician||'—'}</span>,
          ])}
        />
      </ReportSection>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MACHINE REPORT CONTENT
// ══════════════════════════════════════════════════════════════════════════
function MachineReportContent({ data, period }) {
  const { machine, kpi } = data

  return (
    <div className="space-y-8">
      {/* Machine info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Kode Mesin', machine.machine_code],
          ['Nama Mesin', machine.machine_name],
          ['Tipe', machine.machine_type||'—'],
          ['Lokasi', machine.location||'—'],
          ['Departemen', machine.department||'—'],
          ['Status', machine.status],
        ].map(([k,v])=>(
          <div key={k}>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{k}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <ReportSection title="KPI Mesin" icon={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiBox label="Total Problem" value={kpi.totalProblems} sub={`${kpi.openProblems} masih open`} icon={AlertTriangle} accent="bg-blue-500"/>
          <KpiBox label="Total Downtime" value={fmtDur(kpi.totalDowntime)} sub={`Avg ${fmtDur(kpi.avgDowntime)}/problem`} icon={Clock} accent="bg-orange-400"/>
          <KpiBox label="MTTR" value={fmtDur(kpi.mttr)} sub="Mean Time to Repair" icon={Wrench} accent="bg-violet-500"/>
          <KpiBox label="MTBF" value={fmtHrs(kpi.mtbf_hours)} sub="Mean Time Between Failures" icon={TrendingUp} accent="bg-emerald-500"/>
          <KpiBox label="Avg Downtime/Problem" value={fmtDur(kpi.avgDowntime)} sub="Per kejadian" icon={Clock} accent="bg-slate-400"/>
        </div>
      </ReportSection>

      {/* Trend + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
        <div className="sm:col-span-3">
          <ReportSection title="Trend Problem Bulanan" icon={TrendingUp}>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.monthlyTrend} margin={{left:-20,right:4,top:4,bottom:0}} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                  <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
                  <Bar dataKey="total"  name="Total"  fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={18}/>
                  <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[3,3,0,0]} maxBarSize={18}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportSection>
        </div>
        <div className="sm:col-span-2">
          <ReportSection title="By Kategori" icon={BarChart2}>
            <div className="relative">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={data.byCategory} cx="50%" cy="50%" innerRadius="40%" outerRadius="65%" paddingAngle={3} dataKey="count">
                    {data.byCategory.map((d,i)=><Cell key={i} fill={CAT_COLOR[d.name]||PALETTE[i%PALETTE.length]} stroke="none"/>)}
                  </Pie>
                  <Tooltip contentStyle={{fontSize:10,borderRadius:8}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              headers={['Kategori','Jml','Downtime']}
              rows={data.byCategory.map((r,i)=>[
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{background:CAT_COLOR[r.name]||PALETTE[i%PALETTE.length]}}/>
                  {r.name}
                </span>,
                r.count, fmtDur(r.downtime)
              ])}
            />
          </ReportSection>
        </div>
      </div>

      {/* Problem List + Repairs */}
      <ReportSection title={`Daftar Problem & Tindakan (${data.problems.length})`} icon={FileText}>
        {data.problems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Tidak ada problem dalam periode ini</div>
        ) : (
          <div className="space-y-3">
            {data.problems.map((p,i) => (
              <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className={`flex items-start gap-3 px-4 py-3 ${p.status==='Closed'?'bg-slate-50':'bg-orange-50/40'}`}>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-[11px] font-bold text-blue-600">{p.ticket_number}</span>
                      <PriorityBadge priority={p.priority}/>
                      <StatusBadge status={p.status}/>
                      <CategoryBadge category={p.problem_category}/>
                      {p.downtime > 0 && <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5"><Clock size={9}/>{fmtDur(p.downtime)}</span>}
                    </div>
                    <p className="text-xs text-slate-700">{p.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {fmtDate(p.reported_at)} — {p.reported_by}
                      {p.closed_at && ` · Ditutup: ${fmtDate(p.closed_at)}`}
                    </p>
                  </div>
                </div>
                {p.repairs?.length > 0 && (
                  <div className="border-t border-slate-100">
                    {p.repairs.map((r,j) => (
                      <div key={j} className="flex items-start gap-3 px-4 py-2 border-b border-slate-50 last:border-0 bg-blue-50/20">
                        <span className="text-[9px] text-slate-300 font-bold mt-0.5 shrink-0">R{j+1}</span>
                        <div className="flex-1">
                          <span className="text-[10px] font-semibold text-slate-600">[{r.action_type}] {r.technician}</span>
                          <p className="text-[10px] text-slate-500">{r.action_description}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {fmtDT(r.start_time)}{r.end_time ? ` → ${fmtDT(r.end_time)}` : ''}
                            {r.downtime_minutes ? ` · ${r.downtime_minutes} mnt` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ReportSection>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// REPORT HEADER (rendered inside printable area)
// ══════════════════════════════════════════════════════════════════════════
function ReportHeader({ type, machine, period }) {
  return (
    <div className="bg-navy-900 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">PT. Honda Precision Parts Manufacturing Indonesia</p>
          <h2 className="text-white font-bold text-lg mt-1">
            {type === 'summary' ? 'Maintenance Problem Summary Report' : `Machine Report — ${machine?.machine_code}: ${machine?.machine_name}`}
          </h2>
          <p className="text-white/60 text-xs mt-1.5">
            Periode: {fmtDate(period.start)} — {fmtDate(period.end)} &nbsp;({period.days} hari)
          </p>
        </div>
        <div className="text-right text-white/40 text-[10px] shrink-0 ml-4">
          <p>Dibuat: {nowStr()}</p>
          <p className="mt-1">PD 3 — Element Ring Dept &amp; Belt Assy Dept</p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORT BAR
// ══════════════════════════════════════════════════════════════════════════
function ExportBar({ reportType, reportData, period, machine, showToast }) {
  const [exporting, setExporting] = useState(null)

  const exportPDF = async () => {
    setExporting('pdf')
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const el = document.getElementById('report-print-area')
      if (!el) { showToast('Area cetak tidak ditemukan', 'error'); return }

      showToast('Memproses PDF...', 'info')
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
        scrollX: 0, scrollY: 0,
      })

      const pdf     = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pdfW    = pdf.internal.pageSize.getWidth()
      const pdfH    = pdf.internal.pageSize.getHeight()
      const imgData = canvas.toDataURL('image/png', 0.95)
      const imgH    = (canvas.height * pdfW) / canvas.width

      let remaining = imgH, yOff = 0
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH)
      remaining -= pdfH
      while (remaining > 0) {
        yOff -= pdfH; pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, yOff, pdfW, imgH)
        remaining -= pdfH
      }

      const fn = reportType === 'summary'
        ? `maintenance-summary-${period.start}-${period.end}.pdf`
        : `machine-report-${machine?.machine_code}-${period.start}-${period.end}.pdf`
      pdf.save(fn)
      showToast('PDF berhasil diunduh', 'success')
    } catch (err) {
      showToast('Export PDF gagal: ' + err.message, 'error')
    } finally { setExporting(null) }
  }

  const exportExcel = async () => {
    setExporting('excel')
    try {
      const { utils: X, writeFile } = await import('xlsx')
      const wb = X.book_new()

      const style = (ws) => ws // SheetJS free tier — no cell styles, just data

      if (reportType === 'summary') {
        const ov = reportData.overview
        // Sheet 1: Overview
        const ws1 = X.aoa_to_sheet([
          ['MAINTENANCE PROBLEM TRACKING REPORT'],
          [`Periode: ${period.start} s/d ${period.end} (${period.days} hari)`],
          [`Dibuat: ${nowStr()}`], [],
          ['=== RINGKASAN EKSEKUTIF ==='],
          ['KPI', 'Nilai'],
          ['Total Problem',              ov.totalProblems],
          ['Problem Terbuka (Open)',      ov.openProblems],
          ['Problem Selesai (Closed)',    ov.closedProblems],
          ['Problem Critical',           ov.criticalCount],
          ['Total Downtime (menit)',      ov.totalDowntime],
          ['Total Downtime (jam)',        +(ov.totalDowntime/60).toFixed(1)],
          ['Avg Downtime/Problem (menit)',ov.avgDowntimePerProblem],
          ['MTTR (menit)',               ov.mttr],
          ['MTTR (jam)',                 +(ov.mttr/60).toFixed(1)],
          ['MTBF Fasilitas (jam)',        ov.mtbf_hours || 'N/A'],
        ])
        X.book_append_sheet(wb, ws1, 'Ringkasan')

        // Sheet 2: By Category
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Kategori'],
          ['Kategori','Jumlah','% Total','Downtime (mnt)','Downtime (jam)','Selesai'],
          ...reportData.byCategory.map(r=>[r.name, r.count, r.pct+'%', r.downtime, +(r.downtime/60).toFixed(1), r.closed])
        ]), 'Per Kategori')

        // Sheet 3: By Priority
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Priority'],
          ['Priority','Jumlah','% Total','Downtime (mnt)'],
          ...reportData.byPriority.map(r=>[r.priority, r.count, r.pct+'%', r.downtime])
        ]), 'Per Priority')

        // Sheet 4: By Machine
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Mesin (Top 10)'],
          ['Kode Mesin','Nama Mesin','Lokasi','Jumlah Problem','% Total','Downtime (mnt)','Downtime (jam)','Masih Open'],
          ...reportData.byMachine.map(r=>[r.machine_code, r.machine_name, r.location, r.count, r.pct+'%', r.downtime, +(r.downtime/60).toFixed(1), r.open_count])
        ]), 'Per Mesin')

        // Sheet 5: Problem List
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Daftar Problem'],
          ['Ticket#','Kode Mesin','Nama Mesin','Kategori','Priority','Status','Deskripsi','Root Cause','Pelapor','Tgl Lapor','Tgl Selesai','Teknisi','Downtime (mnt)'],
          ...reportData.recentProblems.map(r=>[
            r.ticket_number, r.machine_code||'', r.machine_name||'',
            r.problem_category, r.priority, r.status, r.description, '',
            r.reported_by, r.reported_at, r.closed_at||'', r.technician||'', r.downtime
          ])
        ]), 'Daftar Problem')

        // Sheet 6: Spare Parts
        if (reportData.topSpareParts.length > 0) {
          X.book_append_sheet(wb, X.aoa_to_sheet([
            ['Top Spare Parts Digunakan'],
            ['#','Kode Part','Nama Part','Satuan','Frekuensi Penggunaan'],
            ...reportData.topSpareParts.map((r,i)=>[i+1, r.part_code, r.part_name, r.unit, r.times_used])
          ]), 'Spare Parts')
        }

        writeFile(wb, `maintenance-summary-${period.start}-${period.end}.xlsx`)

      } else {
        // Machine report
        const { machine, kpi } = reportData
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['MACHINE REPORT'],
          [`Mesin: ${machine.machine_code} — ${machine.machine_name}`],
          [`Periode: ${period.start} s/d ${period.end} (${period.days} hari)`],
          [`Dibuat: ${nowStr()}`], [],
          ['=== KPI MESIN ==='],
          ['KPI', 'Nilai'],
          ['Total Problem',          kpi.totalProblems],
          ['Problem Masih Open',     kpi.openProblems],
          ['Total Downtime (menit)', kpi.totalDowntime],
          ['Total Downtime (jam)',   +(kpi.totalDowntime/60).toFixed(1)],
          ['Avg Downtime/Problem (menit)', kpi.avgDowntime],
          ['MTTR (menit)',           kpi.mttr],
          ['MTTR (jam)',             +(kpi.mttr/60).toFixed(1)],
          ['MTBF (jam)',             kpi.mtbf_hours || 'N/A'],
        ]), 'KPI Mesin')

        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Kategori'],
          ['Kategori','Jumlah','Downtime (mnt)'],
          ...reportData.byCategory.map(r=>[r.name, r.count, r.downtime])
        ]), 'Per Kategori')

        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Daftar Problem & Repair'],
          ['Ticket#','Kategori','Priority','Status','Deskripsi','Root Cause','Pelapor','Tgl Lapor','Tgl Selesai','Downtime (mnt)','Repair #1 Teknisi','Repair #1 Tindakan','Repair #1 Tgl'],
          ...reportData.problems.map(p=>[
            p.ticket_number, p.problem_category, p.priority, p.status,
            p.description, p.root_cause||'', p.reported_by, p.reported_at, p.closed_at||'', p.downtime,
            p.repairs?.[0]?.technician||'', p.repairs?.[0]?.action_description||'', p.repairs?.[0]?.start_time||''
          ])
        ]), 'Daftar Problem')

        writeFile(wb, `machine-report-${machine.machine_code}-${period.start}-${period.end}.xlsx`)
      }

      showToast('Excel berhasil diunduh', 'success')
    } catch (err) {
      showToast('Export Excel gagal: ' + err.message, 'error')
    } finally { setExporting(null) }
  }

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-card">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Export:</span>
      <button
        onClick={exportPDF}
        disabled={!!exporting}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin"/> : <FileText size={15}/>}
        {exporting === 'pdf' ? 'Processing...' : 'Export PDF'}
      </button>
      <button
        onClick={exportExcel}
        disabled={!!exporting}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {exporting === 'excel' ? <Loader2 size={15} className="animate-spin"/> : <FileSpreadsheet size={15}/>}
        {exporting === 'excel' ? 'Processing...' : 'Export Excel'}
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <Printer size={15}/> Print
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN REPORTS PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const [reportType, setReportType] = useState('summary')
  const [startDate,  setStartDate]  = useState(day30ago)
  const [endDate,    setEndDate]    = useState(today)
  const [machineId,  setMachineId]  = useState('')
  const [machines,   setMachines]   = useState([])
  const [reportData, setReportData] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [toast,      setToast]      = useState(null)
  const printRef = useRef(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  useEffect(() => {
    machinesApi.getAll().then(r => setMachines(r.data)).catch(() => {})
  }, [])

  const applyPreset = (days) => {
    const e = new Date(); e.setHours(23,59,59,999)
    const s = new Date(); s.setDate(s.getDate() - days + 1); s.setHours(0,0,0,0)
    setStartDate(s.toISOString().slice(0,10))
    setEndDate(e.toISOString().slice(0,10))
    setReportData(null)
  }

  const generate = async () => {
    if (reportType === 'machine' && !machineId) {
      showToast('Pilih mesin terlebih dahulu', 'error'); return
    }
    if (!startDate || !endDate) {
      showToast('Tentukan periode laporan', 'error'); return
    }
    setLoading(true); setReportData(null)
    try {
      let r
      if (reportType === 'summary') {
        r = await reportsApi.getSummary({ start_date: startDate, end_date: endDate })
      } else {
        r = await reportsApi.getMachineReport(machineId, { start_date: startDate, end_date: endDate })
      }
      setReportData(r.data)
      setTimeout(() => printRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      showToast('Gagal generate laporan: ' + (err.response?.data?.error || err.message), 'error')
    } finally { setLoading(false) }
  }

  const period = reportData?.period || { start: startDate, end: endDate, days: 0 }
  const machine = reportData?.machine || null

  return (
    <div className="space-y-5">

      {/* ── Config panel ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-navy-900"/>
          <p className="text-sm font-bold text-navy-900">Konfigurasi Laporan</p>
        </div>

        {/* Report type */}
        <div>
          <p className="label">Jenis Laporan</p>
          <div className="flex gap-2">
            {[
              { v:'summary', l:'Summary Report',   desc:'Ringkasan seluruh maintenance' },
              { v:'machine', l:'Machine Report',   desc:'Laporan per mesin tertentu' },
            ].map(({v,l,desc})=>(
              <button key={v} onClick={()=>{ setReportType(v); setReportData(null) }}
                className={`flex-1 text-left px-4 py-3 rounded-xl border-2 transition-all ${reportType===v ? 'border-navy-900 bg-navy-900/5' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <p className={`text-sm font-bold ${reportType===v?'text-navy-900':'text-slate-600'}`}>{l}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Machine selector (machine report only) */}
        {reportType === 'machine' && (
          <div>
            <p className="label">Pilih Mesin *</p>
            <select className="input" value={machineId} onChange={e=>{ setMachineId(e.target.value); setReportData(null) }}>
              <option value="">— Pilih Mesin —</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.machine_code} — {m.machine_name}</option>)}
            </select>
          </div>
        )}

        {/* Period selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label !mb-0">Periode Laporan</p>
            <div className="flex items-center gap-1.5">
              {PRESETS.map(({label,days})=>(
                <button key={days} onClick={()=>applyPreset(days)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-card">
              <Calendar size={14} className="text-slate-400 shrink-0"/>
              <input type="date" className="border-0 outline-none text-sm text-slate-700 bg-transparent flex-1"
                value={startDate} onChange={e=>{ setStartDate(e.target.value); setReportData(null) }}/>
            </div>
            <span className="text-slate-400 font-bold shrink-0">→</span>
            <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-card">
              <Calendar size={14} className="text-slate-400 shrink-0"/>
              <input type="date" className="border-0 outline-none text-sm text-slate-700 bg-transparent flex-1"
                value={endDate} onChange={e=>{ setEndDate(e.target.value); setReportData(null) }}/>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 font-medium shrink-0">
                {Math.round((new Date(endDate)-new Date(startDate))/86400000)+1} hari
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {reportData
              ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Laporan siap diunduh</span>
              : 'Klik Generate untuk membuat laporan'}
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-navy-900/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <BarChart2 size={16}/>}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="card flex flex-col items-center py-16 text-slate-400">
          <Loader2 size={36} className="animate-spin mb-4 text-navy-900"/>
          <p className="font-semibold text-slate-600">Mengolah data laporan...</p>
          <p className="text-xs mt-1">Mengambil dan menghitung data dari database</p>
        </div>
      )}

      {/* ── Report Preview ─────────────────────────────────────────────── */}
      {reportData && !loading && (
        <>
          {/* Export bar above the report */}
          <ExportBar reportType={reportType} reportData={reportData} period={period} machine={machine} showToast={showToast}/>

          {/* Printable report area */}
          <div ref={printRef} id="report-print-area"
            className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden p-6 space-y-0">
            <ReportHeader type={reportType} machine={machine} period={period}/>

            {reportType === 'summary'
              ? <SummaryReportContent data={reportData} period={period}/>
              : <MachineReportContent data={reportData} period={period}/>
            }

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
              <span>PT. Honda Precision Parts Manufacturing Indonesia — PD 3 Maintenance System</span>
              <span>Dibuat otomatis oleh sistem pada {nowStr()}</span>
            </div>
          </div>

          {/* Export bar below too */}
          <ExportBar reportType={reportType} reportData={reportData} period={period} machine={machine} showToast={showToast}/>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!reportData && !loading && (
        <div className="card flex flex-col items-center py-20 text-slate-300">
          <FileText size={48} className="mb-4"/>
          <p className="text-slate-500 font-semibold text-base">Belum ada laporan dibuat</p>
          <p className="text-xs text-slate-400 mt-1">Pilih jenis laporan, tentukan periode, lalu klik Generate Report</p>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  )
}
