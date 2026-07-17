const express = require('express');
const router = express.Router();
const db = require('../db');

// NOTE: "problem" pada laporan ini = daily_logs dengan log_type='Trouble'.
// Struktur response dipertahankan sama seperti sebelumnya supaya Reports.jsx
// tidak perlu diubah.

// ── helpers ───────────────────────────────────────────────────────────────
function parsePeriod(q) {
  const now = new Date();
  const end = q.end_date || now.toISOString().slice(0, 10);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
  const start = q.start_date || d30.toISOString().slice(0, 10);
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return { start, end, days };
}

function fillMonths(start, end, rawRows) {
  const months = [];
  const cur = new Date(new Date(start).getFullYear(), new Date(start).getMonth(), 1);
  const last = new Date(end);
  while (cur <= last) {
    const key = cur.toISOString().slice(0, 7);
    const found = rawRows.find(r => r.month === key) || { total: 0, closed: 0 };
    const label = cur.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    months.push({ month: key, label, ...found });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function countSpareParts(rows) {
  const cnt = {};
  rows.forEach(r => {
    try { JSON.parse(r.spare_parts_used).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }); } catch {}
  });
  return cnt;
}

function pad2(n) { return String(n).padStart(2, '0'); }

// PM compliance (on-track vs overdue di antara pm_schedules aktif) — proxy
// yang sama dipakai di Dashboard & Machines: karena pm_schedules cuma
// menyimpan siklus terkini (bukan histori tiap kejadian), "rate" di sini
// berarti % jadwal yang belum overdue saat ini, bukan literal "% selesai
// bulan X" — approksimasi paling wajar dari skema yang ada.
function pmComplianceFor(machineId) {
  const row = db.prepare(`
    SELECT COUNT(*) total, SUM(CASE WHEN date(next_due_date) < date('now') THEN 1 ELSE 0 END) overdue
    FROM pm_schedules WHERE is_active=1 ${machineId ? 'AND machine_id=?' : ''}
  `).get(...(machineId ? [machineId] : []));
  const total = row.total || 0;
  const onTrack = total - (row.overdue || 0);
  return { rate: total > 0 ? Math.round((onTrack / total) * 100) : 100, onTrack, total };
}

// ── GET /api/reports/daily — pengganti buku folio harian ───────────────────
router.get('/daily', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { shift } = req.query;
    const conds = ['d.log_date = ?'], params = [date];
    if (shift) { conds.push('d.shift = ?'); params.push(shift); }
    const where = conds.join(' AND ');

    const planning = db.prepare(`
      SELECT d.log_number, d.shift, m.machine_code, m.machine_name, d.category, d.description,
             d.findings, d.action_taken, d.technician, d.start_time, d.end_time, d.status, d.spare_parts_used
      FROM daily_logs d LEFT JOIN machines m ON d.machine_id = m.id
      WHERE ${where} AND d.log_type='Planning' ORDER BY d.start_time
    `).all(...params);

    const trouble = db.prepare(`
      SELECT d.log_number, d.shift, m.machine_code, m.machine_name, d.category, d.description,
             d.action_taken, d.findings AS root_cause, d.technician, d.downtime_minutes, d.status, d.spare_parts_used
      FROM daily_logs d LEFT JOIN machines m ON d.machine_id = m.id
      WHERE ${where} AND d.log_type='Trouble' ORDER BY d.start_time
    `).all(...params);

    const totalDowntime = trouble.reduce((s, r) => s + (r.downtime_minutes || 0), 0);
    const partCnt = countSpareParts([...planning, ...trouble]);
    const sparePartsUsed = Object.entries(partCnt).map(([code, cnt]) => {
      const p = db.prepare('SELECT part_name, unit FROM spare_parts WHERE part_code=?').get(code);
      return { part_code: code, part_name: p?.part_name || code, unit: p?.unit || '', times_used: cnt };
    });

    res.json({
      date, shift: shift || 'all',
      planning, trouble,
      summary: { totalPlanning: planning.length, totalTrouble: trouble.length, totalDowntime, sparePartsUsed },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/reports/monthly?year&month ─────────────────────────────────────
router.get('/monthly', (req, res) => {
  try {
    const now = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1; // 1-12
    const start = `${year}-${pad2(month)}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const end = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;
    const label = new Date(`${start}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const Q = (sql, ...p) => db.prepare(sql).get(...p);
    const ALL = (sql, ...p) => db.prepare(sql).all(...p);
    const TR = "log_type='Trouble'";

    const planningCount = Q("SELECT COUNT(*) c FROM daily_logs WHERE log_type='Planning' AND log_date BETWEEN ? AND ?", start, end).c;
    const troubleCount  = Q(`SELECT COUNT(*) c FROM daily_logs WHERE ${TR} AND log_date BETWEEN ? AND ?`, start, end).c;
    const totalDowntime = Q(`SELECT COALESCE(SUM(downtime_minutes),0) v FROM daily_logs WHERE ${TR} AND log_date BETWEEN ? AND ?`, start, end).v;
    const mttr = Q(`SELECT ROUND(AVG(downtime_minutes),0) v FROM daily_logs WHERE ${TR} AND status='Completed' AND log_date BETWEEN ? AND ?`, start, end).v || 0;
    const mtbf_hours = troubleCount > 0 ? Math.round(daysInMonth * 24 / troubleCount) : null;
    const pmCompletion = pmComplianceFor(null);

    // Daily activity + planning/trouble ratio trend (satu chart, dua seri)
    const dailyActivity = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${pad2(month)}-${pad2(day)}`;
      const p = Q("SELECT COUNT(*) c FROM daily_logs WHERE log_type='Planning' AND log_date=?", ds).c;
      const t = Q(`SELECT COUNT(*) c FROM daily_logs WHERE ${TR} AND log_date=?`, ds).c;
      dailyActivity.push({ date: ds, day, planning: p, trouble: t });
    }

    // Breakdown per mesin (trouble count, downtime, PM compliance)
    const machineRows = ALL(`
      SELECT m.id, m.machine_code, m.machine_name,
        COUNT(d.id) trouble_count, COALESCE(SUM(d.downtime_minutes),0) downtime
      FROM machines m LEFT JOIN daily_logs d ON m.id=d.machine_id AND d.${TR} AND d.log_date BETWEEN ? AND ?
      GROUP BY m.id ORDER BY trouble_count DESC LIMIT 15
    `, start, end);
    const byMachine = machineRows.map(m => ({ ...m, pmCompliance: pmComplianceFor(m.id) }));

    // Breakdown per teknisi (jumlah aktivitas, rata-rata durasi pengerjaan)
    const byTechnician = ALL(`
      SELECT technician,
        COUNT(*) activity_count,
        ROUND(AVG(CASE WHEN end_time IS NOT NULL THEN (julianday(end_time)-julianday(start_time))*24*60 END),0) avg_duration_minutes
      FROM daily_logs WHERE log_date BETWEEN ? AND ?
      GROUP BY technician ORDER BY activity_count DESC
    `, start, end);

    // Top 5 recurring problems (mesin + kategori sama, 2+ kejadian)
    const topProblems = ALL(`
      SELECT m.machine_code, m.machine_name, d.category AS problem_category,
        COUNT(*) count, COALESCE(SUM(d.downtime_minutes),0) total_downtime
      FROM daily_logs d JOIN machines m ON d.machine_id=m.id
      WHERE d.${TR} AND d.log_date BETWEEN ? AND ?
      GROUP BY d.machine_id, d.category HAVING count > 1
      ORDER BY count DESC LIMIT 5
    `, start, end);

    // Top 5 spare parts
    const partRows = ALL(`
      SELECT spare_parts_used FROM daily_logs
      WHERE log_date BETWEEN ? AND ? AND spare_parts_used IS NOT NULL AND spare_parts_used != '[]'
    `, start, end);
    const partCnt = countSpareParts(partRows);
    const topSpareParts = Object.entries(partCnt)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([code, cnt]) => {
        const p = db.prepare('SELECT part_name, unit FROM spare_parts WHERE part_code=?').get(code);
        return { part_code: code, part_name: p?.part_name || code, unit: p?.unit || '', times_used: cnt };
      });

    res.json({
      period: { year, month, start, end, label },
      kpi: {
        totalActivities: planningCount + troubleCount, planningCount, troubleCount,
        totalDowntime, mttr, mtbf_hours, pmCompletionRate: pmCompletion.rate,
      },
      dailyActivity, byMachine, byTechnician, topProblems, topSpareParts,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/reports/machine/:id ───────────────────────────────────────────
router.get('/machine/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { start, end, days } = parsePeriod(req.query);
    const machine = db.prepare('SELECT * FROM machines WHERE id=?').get(id);
    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const Q = (sql, ...p) => db.prepare(sql).get(...p);
    const ALL = (sql, ...p) => db.prepare(sql).all(...p);
    const TR = "log_type='Trouble'";

    const totalP = Q(`SELECT COUNT(*) c FROM daily_logs WHERE machine_id=? AND ${TR} AND log_date BETWEEN ? AND ?`, id, start, end).c;
    const openP  = Q(`SELECT COUNT(*) c FROM daily_logs WHERE machine_id=? AND ${TR} AND status!='Completed' AND log_date BETWEEN ? AND ?`, id, start, end).c;
    const dtRow  = Q(`SELECT COALESCE(SUM(downtime_minutes),0) v FROM daily_logs WHERE machine_id=? AND ${TR} AND log_date BETWEEN ? AND ?`, id, start, end);
    const mttrRow= Q(`SELECT ROUND(AVG(downtime_minutes),0) v FROM daily_logs WHERE machine_id=? AND ${TR} AND status='Completed' AND log_date BETWEEN ? AND ?`, id, start, end);

    // MTBF across all time for this machine
    const allDates = ALL(`SELECT start_time FROM daily_logs WHERE machine_id=? AND ${TR} ORDER BY start_time`, id).map(r => new Date(r.start_time));
    let mtbf_hours = null;
    if (allDates.length >= 2) {
      const gaps = allDates.slice(1).map((d, i) => d - allDates[i]);
      mtbf_hours = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 3600000);
    }

    // By category
    const byCategory = ALL(`
      SELECT category name, COUNT(*) count,
        COALESCE(SUM(downtime_minutes),0) downtime
      FROM daily_logs WHERE machine_id=? AND ${TR} AND log_date BETWEEN ? AND ?
      GROUP BY category ORDER BY count DESC
    `, id, start, end);

    // Monthly trend
    const rawM = ALL(`
      SELECT strftime('%Y-%m', log_date) month,
        COUNT(*) total, SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) closed
      FROM daily_logs WHERE machine_id=? AND ${TR} AND log_date BETWEEN ? AND ?
      GROUP BY month ORDER BY month
    `, id, start, end);
    const monthlyTrend = fillMonths(start, end, rawM);

    // Problems with their (single-row) "repair" detail
    const problems = ALL(`
      SELECT d.id, d.log_number AS ticket_number, d.category AS problem_category, d.priority, d.status,
        d.description, d.findings AS root_cause, d.reported_by, d.start_time AS reported_at,
        CASE WHEN d.status='Completed' THEN d.end_time ELSE NULL END AS closed_at,
        d.downtime_minutes AS downtime, d.action_taken, d.technician, d.start_time, d.end_time
      FROM daily_logs d WHERE d.machine_id=? AND d.${TR} AND d.log_date BETWEEN ? AND ?
      ORDER BY d.start_time DESC
    `, id, start, end).map(p => ({
      ...p,
      repairs: [{
        action_type: p.problem_category,
        action_description: p.action_taken,
        technician: p.technician,
        start_time: p.start_time,
        end_time: p.end_time,
        downtime_minutes: p.downtime,
      }],
    }));

    res.json({
      machine, period: { start, end, days },
      kpi: { totalProblems: totalP, openProblems: openP, totalDowntime: dtRow.v, mttr: mttrRow.v || 0, mtbf_hours, avgDowntime: totalP > 0 ? Math.round(dtRow.v / totalP) : 0, pmCompliance: pmComplianceFor(id) },
      byCategory, monthlyTrend, problems,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
