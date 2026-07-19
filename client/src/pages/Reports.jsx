import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FileText, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Calendar, Cpu, TrendingUp,
  Clock, Wrench, AlertTriangle, Package, RefreshCw,
  BarChart2, Printer, ClipboardList, CalendarCheck, Users,
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
const curYear  = new Date().getFullYear()
const curMonth = new Date().getMonth() + 1

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtDT    = (d) => d ? new Date(d.replace(' ','T')).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
const fmtTimeOnly = (d) => d ? d.slice(11,16) : '—'
const fmtDur   = (m) => { if (!m) return '—'; const h=Math.floor(m/60); return h>0?`${h}j ${m%60}m`:`${m}m` }
const fmtHrs   = (h) => h==null ? '—' : `${h} jam`
const nowStr   = () => new Date().toLocaleString('id-ID')

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
// DAILY REPORT CONTENT — pengganti buku folio
// ══════════════════════════════════════════════════════════════════════════
function DailyReportContent({ data }) {
  const { summary } = data
  return (
    <div className="space-y-8">
      <ReportSection title="Ringkasan Hari Ini" icon={ClipboardList}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Total Planning" value={summary.totalPlanning} icon={CalendarCheck} accent="bg-blue-500"/>
          <KpiBox label="Total Trouble" value={summary.totalTrouble} icon={AlertTriangle} accent="bg-orange-500"/>
          <KpiBox label="Total Downtime" value={fmtDur(summary.totalDowntime)} icon={Clock} accent="bg-red-500"/>
          <KpiBox label="Spare Parts Used" value={summary.sparePartsUsed.length} sub={`${summary.sparePartsUsed.reduce((s,p)=>s+p.times_used,0)}x pemakaian`} icon={Package} accent="bg-violet-500"/>
        </div>
      </ReportSection>

      <ReportSection title={`Planning Activities (${data.planning.length})`} icon={CalendarCheck}>
        <DataTable
          headers={['No','Mesin','Kategori PM','Deskripsi','Temuan','Teknisi','Waktu','Status']}
          emptyMsg="Tidak ada aktivitas Planning pada tanggal ini"
          rows={data.planning.map((p,i)=>[
            i+1,
            <div><p className="font-bold text-[11px]">{p.machine_code||'—'}</p><p className="text-slate-400 text-[10px]">{p.machine_name}</p></div>,
            <CategoryBadge category={p.category}/>,
            <p className="max-w-[200px] truncate">{p.description}</p>,
            <p className="max-w-[160px] truncate text-slate-500">{p.findings||'—'}</p>,
            p.technician,
            `${fmtTimeOnly(p.start_time)}–${fmtTimeOnly(p.end_time)}`,
            <StatusBadge status={p.status}/>,
          ])}
        />
      </ReportSection>

      <ReportSection title={`Trouble Activities (${data.trouble.length})`} icon={AlertTriangle}>
        <DataTable
          headers={['No','Mesin','Kategori','Deskripsi','Tindakan','Root Cause','Teknisi','Downtime','Status']}
          emptyMsg="Tidak ada aktivitas Trouble pada tanggal ini"
          rows={data.trouble.map((t,i)=>[
            i+1,
            <div><p className="font-bold text-[11px]">{t.machine_code||'—'}</p><p className="text-slate-400 text-[10px]">{t.machine_name}</p></div>,
            <CategoryBadge category={t.category}/>,
            <p className="max-w-[180px] truncate">{t.description}</p>,
            <p className="max-w-[160px] truncate text-slate-500">{t.action_taken||'—'}</p>,
            <p className="max-w-[140px] truncate text-slate-500">{t.root_cause||'—'}</p>,
            t.technician,
            <span className="text-orange-600 font-semibold">{fmtDur(t.downtime_minutes)}</span>,
            <StatusBadge status={t.status}/>,
          ])}
        />
      </ReportSection>

      {summary.sparePartsUsed.length > 0 && (
        <ReportSection title="Spare Parts Digunakan" icon={Package}>
          <DataTable
            headers={['Kode','Nama Part','Satuan','Frekuensi']}
            rows={summary.sparePartsUsed.map(p=>[
              <span className="font-mono font-bold">{p.part_code}</span>, p.part_name, p.unit, `${p.times_used}×`
            ])}
          />
        </ReportSection>
      )}

      {/* Signature area */}
      <div className="grid grid-cols-3 gap-8 pt-8">
        {['Dibuat oleh', 'Diperiksa oleh', 'Diketahui oleh'].map(role => (
          <div key={role} className="text-center">
            <div className="h-16" />
            <div className="border-t border-slate-400 pt-2">
              <p className="text-xs font-semibold text-slate-600">{role}</p>
              <p className="text-[10px] text-slate-400 mt-1">( _________________________ )</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MONTHLY REPORT CONTENT
// ══════════════════════════════════════════════════════════════════════════
function MonthlyReportContent({ data }) {
  const { kpi } = data
  return (
    <div className="space-y-8">
      <ReportSection title="KPI Bulanan" icon={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiBox label="Total Activities" value={kpi.totalActivities} sub={`P: ${kpi.planningCount} · T: ${kpi.troubleCount}`} icon={ClipboardList} accent="bg-blue-500"/>
          <KpiBox label="Total Downtime" value={fmtDur(kpi.totalDowntime)} icon={Clock} accent="bg-orange-400"/>
          <KpiBox label="MTTR" value={fmtDur(kpi.mttr)} sub="Mean Time to Repair" icon={Wrench} accent="bg-violet-500"/>
          <KpiBox label="MTBF" value={fmtHrs(kpi.mtbf_hours)} sub="Mean Time Between Failures" icon={TrendingUp} accent="bg-emerald-500"/>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          <div className={`rounded-xl border px-3 py-2 text-center ${kpi.pmCompletionRate>90?'bg-emerald-50 text-emerald-700 border-emerald-200':kpi.pmCompletionRate>=70?'bg-amber-50 text-amber-700 border-amber-200':'bg-red-50 text-red-700 border-red-200'}`}>
            <p className="text-xl font-bold">{kpi.pmCompletionRate}%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">PM Completion Rate</p>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Aktivitas Harian & Rasio Planning vs Trouble" icon={TrendingUp}>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailyActivity} margin={{left:-20,right:4,top:4,bottom:0}} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false}/>
              <XAxis dataKey="day" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e2e8f0'}}/>
              <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:11,color:'#64748b'}}>{v}</span>}/>
              <Bar dataKey="planning" name="Planning" stackId="s" fill="#3b82f6" radius={[0,0,0,0]} maxBarSize={14}/>
              <Bar dataKey="trouble"  name="Trouble"  stackId="s" fill="#f97316" radius={[3,3,0,0]} maxBarSize={14}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>

      <ReportSection title="Breakdown per Mesin" icon={Cpu}>
        <DataTable
          headers={['Mesin','Trouble','Downtime','PM Compliance']}
          rows={data.byMachine.map(m=>[
            <div><p className="font-bold text-xs text-blue-600">{m.machine_code}</p><p className="text-[10px] text-slate-400">{m.machine_name}</p></div>,
            <span className="font-bold">{m.trouble_count}</span>,
            fmtDur(m.downtime),
            <span className={m.pmCompliance.rate>90?'text-emerald-600 font-bold':m.pmCompliance.rate>=70?'text-amber-600 font-bold':'text-red-600 font-bold'}>
              {m.pmCompliance.rate}% ({m.pmCompliance.onTrack}/{m.pmCompliance.total})
            </span>,
          ])}
        />
      </ReportSection>

      <ReportSection title="Breakdown per Teknisi" icon={Users}>
        <DataTable
          headers={['Teknisi','Jumlah Aktivitas','Rata-rata Durasi Pengerjaan']}
          rows={data.byTechnician.map(t=>[
            t.technician, <span className="font-bold">{t.activity_count}</span>, fmtDur(t.avg_duration_minutes)
          ])}
        />
      </ReportSection>

      {data.topProblems.length > 0 && (
        <ReportSection title="Top 5 Problem Berulang" icon={RefreshCw}>
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

      {data.topSpareParts.length > 0 && (
        <ReportSection title="Top 5 Spare Parts Digunakan" icon={Package}>
          <DataTable
            headers={['#','Kode','Nama Part','Satuan','Frekuensi']}
            rows={data.topSpareParts.map((r,i)=>[
              <span className="text-slate-400 font-bold">{i+1}</span>,
              <span className="font-mono font-bold text-[11px]">{r.part_code}</span>,
              r.part_name, r.unit,
              <span className="font-bold text-blue-600">{r.times_used}×</span>
            ])}
          />
        </ReportSection>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MACHINE REPORT CONTENT
// ══════════════════════════════════════════════════════════════════════════
function MachineReportContent({ data }) {
  const { machine, kpi } = data

  return (
    <div className="space-y-8">
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

      <ReportSection title="KPI Mesin" icon={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiBox label="Total Problem" value={kpi.totalProblems} sub={`${kpi.openProblems} masih open`} icon={AlertTriangle} accent="bg-blue-500"/>
          <KpiBox label="Total Downtime" value={fmtDur(kpi.totalDowntime)} sub={`Avg ${fmtDur(kpi.avgDowntime)}/problem`} icon={Clock} accent="bg-orange-400"/>
          <KpiBox label="MTTR" value={fmtDur(kpi.mttr)} sub="Mean Time to Repair" icon={Wrench} accent="bg-violet-500"/>
          <KpiBox label="MTBF" value={fmtHrs(kpi.mtbf_hours)} sub="Mean Time Between Failures" icon={TrendingUp} accent="bg-emerald-500"/>
          <KpiBox label="PM Compliance" value={`${kpi.pmCompliance.rate}%`} sub={`${kpi.pmCompliance.onTrack}/${kpi.pmCompliance.total} on track`} icon={CalendarCheck} accent={kpi.pmCompliance.rate>90?'bg-emerald-500':kpi.pmCompliance.rate>=70?'bg-amber-500':'bg-red-500'}/>
        </div>
      </ReportSection>

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

      <ReportSection title={`Daftar Problem & Tindakan (${data.problems.length})`} icon={FileText}>
        {data.problems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Tidak ada problem dalam periode ini</div>
        ) : (
          <div className="space-y-3">
            {data.problems.map((p,i) => (
              <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className={`flex items-start gap-3 px-4 py-3 ${p.status==='Completed'?'bg-slate-50':'bg-orange-50/40'}`}>
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
                {p.action_taken && (
                  <div className="border-t border-slate-100 px-4 py-2 bg-blue-50/20">
                    <span className="text-[10px] font-semibold text-slate-600">[{p.problem_category}] {p.technician}</span>
                    <p className="text-[10px] text-slate-500">{p.action_taken}</p>
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
function ReportHeader({ reportType, machine, subtitle }) {
  const titles = {
    daily:   'DAILY MAINTENANCE REPORT',
    monthly: 'MONTHLY MAINTENANCE REPORT',
    machine: `MACHINE REPORT — ${machine?.machine_code}: ${machine?.machine_name}`,
  }
  return (
    <div className="bg-navy-900 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">PT. Honda Precision Parts Manufacturing Indonesia</p>
          <h2 className="text-white font-bold text-lg mt-1">{titles[reportType]}</h2>
          <p className="text-white/60 text-xs mt-1.5">{subtitle}</p>
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
function ExportBar({ reportType, reportData, fileTag, showToast }) {
  const [exporting, setExporting] = useState(null)

  const exportPDF = async () => {
    setExporting('pdf')
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ])
      const el = document.getElementById('report-print-area')
      if (!el) { showToast('Area cetak tidak ditemukan', 'error'); return }

      showToast('Memproses PDF...', 'info')
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
        scrollX: 0, scrollY: 0,
      })

      // Daily Report pakai layout landscape A4 (mirip buku folio)
      const orientation = reportType === 'daily' ? 'l' : 'p'
      const pdf     = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
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

      pdf.save(`${reportType}-report-${fileTag}.pdf`)
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

      if (reportType === 'daily') {
        const { summary } = reportData
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['DAILY MAINTENANCE REPORT'], [`Tanggal: ${reportData.date}`], [`Shift: ${reportData.shift}`], [`Dibuat: ${nowStr()}`], [],
          ['Total Planning', summary.totalPlanning], ['Total Trouble', summary.totalTrouble],
          ['Total Downtime (menit)', summary.totalDowntime], ['Total Downtime (jam)', +(summary.totalDowntime/60).toFixed(1)],
        ]), 'Ringkasan')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Planning Activities'],
          ['Log#','Mesin','Kategori','Deskripsi','Temuan','Teknisi','Mulai','Selesai','Status'],
          ...reportData.planning.map(p=>[p.log_number, p.machine_code||'', p.category, p.description, p.findings||'', p.technician, p.start_time, p.end_time||'', p.status])
        ]), 'Planning')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Trouble Activities'],
          ['Log#','Mesin','Kategori','Deskripsi','Tindakan','Root Cause','Teknisi','Downtime (mnt)','Status'],
          ...reportData.trouble.map(t=>[t.log_number, t.machine_code||'', t.category, t.description, t.action_taken||'', t.root_cause||'', t.technician, t.downtime_minutes, t.status])
        ]), 'Trouble')
        if (summary.sparePartsUsed.length) {
          X.book_append_sheet(wb, X.aoa_to_sheet([
            ['Spare Parts Digunakan'], ['Kode','Nama Part','Satuan','Frekuensi'],
            ...summary.sparePartsUsed.map(p=>[p.part_code, p.part_name, p.unit, p.times_used])
          ]), 'Spare Parts')
        }
        writeFile(wb, `daily-report-${fileTag}.xlsx`)

      } else if (reportType === 'monthly') {
        const { kpi } = reportData
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['MONTHLY MAINTENANCE REPORT'], [`Periode: ${reportData.period.label}`], [`Dibuat: ${nowStr()}`], [],
          ['KPI','Nilai'],
          ['Total Activities', kpi.totalActivities], ['Planning Count', kpi.planningCount], ['Trouble Count', kpi.troubleCount],
          ['Total Downtime (menit)', kpi.totalDowntime], ['MTTR (menit)', kpi.mttr], ['MTBF (jam)', kpi.mtbf_hours ?? 'N/A'],
          ['PM Completion Rate (%)', kpi.pmCompletionRate],
        ]), 'Ringkasan')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Aktivitas Harian'], ['Tanggal','Planning','Trouble'],
          ...reportData.dailyActivity.map(d=>[d.date, d.planning, d.trouble])
        ]), 'Aktivitas Harian')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Mesin'], ['Kode Mesin','Nama Mesin','Trouble Count','Downtime (mnt)','PM Compliance (%)'],
          ...reportData.byMachine.map(m=>[m.machine_code, m.machine_name, m.trouble_count, m.downtime, m.pmCompliance.rate])
        ]), 'Per Mesin')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Teknisi'], ['Teknisi','Jumlah Aktivitas','Rata-rata Durasi (menit)'],
          ...reportData.byTechnician.map(t=>[t.technician, t.activity_count, t.avg_duration_minutes])
        ]), 'Per Teknisi')
        if (reportData.topProblems.length) {
          X.book_append_sheet(wb, X.aoa_to_sheet([
            ['Top 5 Problem Berulang'], ['Mesin','Kategori','Frekuensi','Total Downtime (mnt)'],
            ...reportData.topProblems.map(r=>[r.machine_code, r.problem_category, r.count, r.total_downtime])
          ]), 'Top Problems')
        }
        if (reportData.topSpareParts.length) {
          X.book_append_sheet(wb, X.aoa_to_sheet([
            ['Top 5 Spare Parts'], ['Kode','Nama Part','Satuan','Frekuensi'],
            ...reportData.topSpareParts.map(r=>[r.part_code, r.part_name, r.unit, r.times_used])
          ]), 'Top Spare Parts')
        }
        writeFile(wb, `monthly-report-${fileTag}.xlsx`)

      } else {
        const { machine, kpi } = reportData
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['MACHINE REPORT'], [`Mesin: ${machine.machine_code} — ${machine.machine_name}`], [`Dibuat: ${nowStr()}`], [],
          ['KPI','Nilai'],
          ['Total Problem', kpi.totalProblems], ['Problem Masih Open', kpi.openProblems],
          ['Total Downtime (menit)', kpi.totalDowntime], ['MTTR (menit)', kpi.mttr], ['MTBF (jam)', kpi.mtbf_hours ?? 'N/A'],
          ['PM Compliance Rate (%)', kpi.pmCompliance.rate],
        ]), 'KPI Mesin')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Breakdown per Kategori'], ['Kategori','Jumlah','Downtime (mnt)'],
          ...reportData.byCategory.map(r=>[r.name, r.count, r.downtime])
        ]), 'Per Kategori')
        X.book_append_sheet(wb, X.aoa_to_sheet([
          ['Daftar Problem'], ['Ticket#','Kategori','Priority','Status','Deskripsi','Root Cause','Pelapor','Tgl Lapor','Downtime (mnt)','Teknisi','Tindakan'],
          ...reportData.problems.map(p=>[p.ticket_number, p.problem_category, p.priority, p.status, p.description, p.root_cause||'', p.reported_by, p.reported_at, p.downtime, p.technician||'', p.action_taken||''])
        ]), 'Daftar Problem')
        writeFile(wb, `machine-report-${machine.machine_code}-${fileTag}.xlsx`)
      }

      showToast('Excel berhasil diunduh', 'success')
    } catch (err) {
      showToast('Export Excel gagal: ' + err.message, 'error')
    } finally { setExporting(null) }
  }

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-card">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Export:</span>
      <button onClick={exportPDF} disabled={!!exporting}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
        {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin"/> : <FileText size={15}/>}
        {exporting === 'pdf' ? 'Processing...' : 'Export PDF'}
      </button>
      <button onClick={exportExcel} disabled={!!exporting}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
        {exporting === 'excel' ? <Loader2 size={15} className="animate-spin"/> : <FileSpreadsheet size={15}/>}
        {exporting === 'excel' ? 'Processing...' : 'Export Excel'}
      </button>
      <button onClick={() => window.print()}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
        <Printer size={15}/> Print
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN REPORTS PAGE
// ══════════════════════════════════════════════════════════════════════════
const TABS = [
  { v: 'daily',   l: 'Daily Report',   icon: ClipboardList, desc: 'Pengganti buku folio harian' },
  { v: 'monthly', l: 'Monthly Report', icon: BarChart2,     desc: 'Ringkasan & analisis bulanan' },
  { v: 'machine', l: 'Machine Report', icon: Cpu,           desc: 'Laporan per mesin tertentu' },
]

export default function Reports() {
  const [tab, setTab] = useState('daily')

  // Daily
  const [dailyDate, setDailyDate]   = useState(today)
  const [dailyShift, setDailyShift] = useState('')

  // Monthly
  const [monthYear, setMonthYear] = useState(`${curYear}-${String(curMonth).padStart(2,'0')}`)

  // Machine
  const [startDate, setStartDate] = useState(day30ago)
  const [endDate,   setEndDate]   = useState(today)
  const [machineId, setMachineId] = useState('')
  const [machines,  setMachines]  = useState([])

  const [reportData, setReportData] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [toast,      setToast]      = useState(null)
  const printRef = useRef(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  useEffect(() => { machinesApi.getAll().then(r => setMachines(r.data)).catch(() => {}) }, [])
  useEffect(() => { setReportData(null) }, [tab])

  const applyPreset = (days) => {
    const e = new Date(); e.setHours(23,59,59,999)
    const s = new Date(); s.setDate(s.getDate() - days + 1); s.setHours(0,0,0,0)
    setStartDate(s.toISOString().slice(0,10))
    setEndDate(e.toISOString().slice(0,10))
    setReportData(null)
  }

  const generate = async () => {
    if (tab === 'machine' && !machineId) { showToast('Pilih mesin terlebih dahulu', 'error'); return }
    setLoading(true); setReportData(null)
    try {
      let r
      if (tab === 'daily') {
        r = await reportsApi.getDaily({ date: dailyDate, ...(dailyShift && { shift: dailyShift }) })
      } else if (tab === 'monthly') {
        const [y, m] = monthYear.split('-')
        r = await reportsApi.getMonthly({ year: y, month: parseInt(m) })
      } else {
        r = await reportsApi.getMachineReport(machineId, { start_date: startDate, end_date: endDate })
      }
      setReportData(r.data)
      setTimeout(() => printRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      showToast('Gagal generate laporan: ' + (err.response?.data?.error || err.message), 'error')
    } finally { setLoading(false) }
  }

  const subtitle = tab === 'daily'
    ? `Tanggal: ${fmtDate(dailyDate)} · Shift: ${dailyShift || 'Semua'}`
    : tab === 'monthly'
    ? `Periode: ${reportData?.period?.label || monthYear}`
    : `Periode: ${fmtDate(startDate)} — ${fmtDate(endDate)}`

  const fileTag = tab === 'daily' ? dailyDate : tab === 'monthly' ? monthYear : `${startDate}-${endDate}`
  const machine = reportData?.machine || null

  return (
    <div className="space-y-5">

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.v} onClick={() => { setTab(t.v); setReportData(null) }}
            className={`flex-1 text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3 ${tab===t.v ? 'border-navy-900 bg-navy-900/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
            <t.icon size={18} className={tab===t.v ? 'text-navy-900' : 'text-slate-400'} />
            <div>
              <p className={`text-sm font-bold ${tab===t.v?'text-navy-900':'text-slate-600'}`}>{t.l}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Config panel ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        {tab === 'daily' && (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="label">Tanggal *</p>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-card">
                <Calendar size={14} className="text-slate-400 shrink-0"/>
                <input type="date" className="border-0 outline-none text-sm text-slate-700 bg-transparent"
                  value={dailyDate} onChange={e => { setDailyDate(e.target.value); setReportData(null) }}/>
              </div>
            </div>
            <div>
              <p className="label">Shift</p>
              <select className="input w-40" value={dailyShift} onChange={e => { setDailyShift(e.target.value); setReportData(null) }}>
                <option value="">Semua Shift</option>
                {[1,2,3].map(s => <option key={s} value={s}>Shift {s}</option>)}
              </select>
            </div>
          </div>
        )}

        {tab === 'monthly' && (
          <div>
            <p className="label">Bulan & Tahun *</p>
            <input type="month" className="input w-56" value={monthYear} onChange={e => { setMonthYear(e.target.value); setReportData(null) }}/>
          </div>
        )}

        {tab === 'machine' && (
          <>
            <div>
              <p className="label">Pilih Mesin *</p>
              <select className="input" value={machineId} onChange={e=>{ setMachineId(e.target.value); setReportData(null) }}>
                <option value="">— Pilih Mesin —</option>
                {machines.map(m=><option key={m.id} value={m.id}>{m.machine_name ? `${m.machine_code} — ${m.machine_name}` : m.machine_code}</option>)}
              </select>
            </div>
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
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {reportData
              ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Laporan siap diunduh</span>
              : 'Klik Generate untuk membuat laporan'}
          </p>
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-navy-900/20">
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
          <ExportBar reportType={tab} reportData={reportData} fileTag={fileTag} showToast={showToast}/>

          <div ref={printRef} id="report-print-area"
            className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden p-6 space-y-0">
            <ReportHeader reportType={tab} machine={machine} subtitle={subtitle}/>

            {tab === 'daily'   && <DailyReportContent data={reportData}/>}
            {tab === 'monthly' && <MonthlyReportContent data={reportData}/>}
            {tab === 'machine' && <MachineReportContent data={reportData}/>}

            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
              <span>PT. Honda Precision Parts Manufacturing Indonesia — PD 3 Maintenance System</span>
              <span>Dibuat otomatis oleh sistem pada {nowStr()}</span>
            </div>
          </div>

          <ExportBar reportType={tab} reportData={reportData} fileTag={fileTag} showToast={showToast}/>
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
