const express = require('express');
const router = express.Router();
const db = require('../db');

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

function countSpareParts(repairRows) {
  const cnt = {};
  repairRows.forEach(r => {
    try { JSON.parse(r.spare_parts_used).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }); } catch {}
  });
  return cnt;
}

// ── GET /api/reports/summary ───────────────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const { start, end, days } = parsePeriod(req.query);
    const Q = (sql, ...p) => db.prepare(sql).get(...p);
    const ALL = (sql, ...p) => db.prepare(sql).all(...p);

    // Overview
    const totalP    = Q("SELECT COUNT(*) c FROM problems WHERE date(reported_at) BETWEEN ? AND ?", start, end).c;
    const openP     = Q("SELECT COUNT(*) c FROM problems WHERE status!='Closed' AND date(reported_at) BETWEEN ? AND ?", start, end).c;
    const closedP   = Q("SELECT COUNT(*) c FROM problems WHERE status='Closed' AND date(reported_at) BETWEEN ? AND ?", start, end).c;
    const critP     = Q("SELECT COUNT(*) c FROM problems WHERE priority='Critical' AND date(reported_at) BETWEEN ? AND ?", start, end).c;
    const dtRow     = Q("SELECT COALESCE(SUM(r.downtime_minutes),0) v FROM repairs r JOIN problems p ON r.problem_id=p.id WHERE date(r.start_time) BETWEEN ? AND ?", start, end);
    const mttrRow   = Q("SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) v FROM problems WHERE status='Closed' AND closed_at IS NOT NULL AND date(reported_at) BETWEEN ? AND ?", start, end);
    const mtbf_hours = totalP > 0 ? Math.round(days * 24 / totalP) : null;

    // By category
    const byCategory = ALL(`
      SELECT p.problem_category name, COUNT(*) count,
        ROUND(COUNT(*)*100.0 / NULLIF((SELECT COUNT(*) FROM problems WHERE date(reported_at) BETWEEN ? AND ?),0), 1) pct,
        COALESCE(SUM((SELECT SUM(r2.downtime_minutes) FROM repairs r2 WHERE r2.problem_id=p.id)),0) downtime,
        SUM(CASE WHEN p.status='Closed' THEN 1 ELSE 0 END) closed
      FROM problems p WHERE date(p.reported_at) BETWEEN ? AND ?
      GROUP BY p.problem_category ORDER BY count DESC
    `, start, end, start, end);

    // By priority
    const byPriority = ALL(`
      SELECT p.priority,
        COUNT(*) count,
        ROUND(COUNT(*)*100.0 / NULLIF((SELECT COUNT(*) FROM problems WHERE date(reported_at) BETWEEN ? AND ?),0), 1) pct,
        COALESCE(SUM((SELECT SUM(r2.downtime_minutes) FROM repairs r2 WHERE r2.problem_id=p.id)),0) downtime
      FROM problems p WHERE date(p.reported_at) BETWEEN ? AND ?
      GROUP BY p.priority
      ORDER BY CASE p.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END
    `, start, end, start, end);

    // By machine (top 10)
    const byMachine = ALL(`
      SELECT m.machine_code, m.machine_name, m.location,
        COUNT(p.id) count,
        COALESCE(SUM((SELECT SUM(r2.downtime_minutes) FROM repairs r2 WHERE r2.problem_id=p.id)),0) downtime,
        SUM(CASE WHEN p.status!='Closed' THEN 1 ELSE 0 END) open_count
      FROM problems p JOIN machines m ON p.machine_id=m.id
      WHERE date(p.reported_at) BETWEEN ? AND ?
      GROUP BY m.id ORDER BY count DESC LIMIT 10
    `, start, end);
    byMachine.forEach(r => r.pct = Math.round(r.count / (totalP || 1) * 100));

    // Monthly trend
    const rawMonths = ALL(`
      SELECT strftime('%Y-%m', reported_at) month,
        COUNT(*) total, SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) closed
      FROM problems WHERE date(reported_at) BETWEEN ? AND ?
      GROUP BY month ORDER BY month
    `, start, end);
    const monthlyTrend = fillMonths(start, end, rawMonths);

    // Top recurring (same machine + category, 2+ occurrences)
    const topProblems = ALL(`
      SELECT m.machine_code, m.machine_name, p.problem_category,
        COUNT(*) count,
        COALESCE(SUM((SELECT SUM(r2.downtime_minutes) FROM repairs r2 WHERE r2.problem_id=p.id)),0) total_downtime
      FROM problems p JOIN machines m ON p.machine_id=m.id
      WHERE date(p.reported_at) BETWEEN ? AND ?
      GROUP BY p.machine_id, p.problem_category HAVING count > 1
      ORDER BY count DESC LIMIT 5
    `, start, end);

    // Top spare parts
    const partRows = ALL(`
      SELECT r.spare_parts_used FROM repairs r
      JOIN problems p ON r.problem_id=p.id
      WHERE date(r.start_time) BETWEEN ? AND ? AND r.spare_parts_used IS NOT NULL AND r.spare_parts_used != '[]'
    `, start, end);
    const partCnt = countSpareParts(partRows);
    const topSpareParts = Object.entries(partCnt)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([code, cnt]) => {
        const p = db.prepare("SELECT part_name, unit FROM spare_parts WHERE part_code=?").get(code);
        return { part_code: code, part_name: p?.part_name || code, unit: p?.unit || '', times_used: cnt };
      });

    // Recent problem list (up to 50)
    const recentProblems = ALL(`
      SELECT p.ticket_number, p.problem_category, p.priority, p.status,
        p.description, p.reported_by, p.reported_at, p.closed_at,
        m.machine_code, m.machine_name,
        COALESCE((SELECT SUM(r.downtime_minutes) FROM repairs r WHERE r.problem_id=p.id),0) downtime,
        (SELECT r.technician FROM repairs r WHERE r.problem_id=p.id ORDER BY r.start_time LIMIT 1) technician
      FROM problems p LEFT JOIN machines m ON p.machine_id=m.id
      WHERE date(p.reported_at) BETWEEN ? AND ?
      ORDER BY p.reported_at DESC LIMIT 50
    `, start, end);

    res.json({
      period: { start, end, days },
      overview: {
        totalProblems: totalP, openProblems: openP, closedProblems: closedP, criticalCount: critP,
        totalDowntime: dtRow.v,
        avgDowntimePerProblem: totalP > 0 ? Math.round(dtRow.v / totalP) : 0,
        mttr: mttrRow.v || 0, mtbf_hours,
      },
      byCategory, byPriority, byMachine,
      monthlyTrend, topProblems, topSpareParts, recentProblems,
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

    const totalP = Q("SELECT COUNT(*) c FROM problems WHERE machine_id=? AND date(reported_at) BETWEEN ? AND ?", id, start, end).c;
    const openP  = Q("SELECT COUNT(*) c FROM problems WHERE machine_id=? AND status!='Closed' AND date(reported_at) BETWEEN ? AND ?", id, start, end).c;
    const dtRow  = Q("SELECT COALESCE(SUM(r.downtime_minutes),0) v FROM repairs r JOIN problems p ON r.problem_id=p.id WHERE p.machine_id=? AND date(r.start_time) BETWEEN ? AND ?", id, start, end);
    const mttrRow= Q("SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) v FROM problems WHERE machine_id=? AND status='Closed' AND closed_at IS NOT NULL AND date(reported_at) BETWEEN ? AND ?", id, start, end);

    // MTBF across all time for this machine
    const allDates = ALL("SELECT reported_at FROM problems WHERE machine_id=? ORDER BY reported_at", id).map(r => new Date(r.reported_at));
    let mtbf_hours = null;
    if (allDates.length >= 2) {
      const gaps = allDates.slice(1).map((d, i) => d - allDates[i]);
      mtbf_hours = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 3600000);
    }

    // By category
    const byCategory = ALL(`
      SELECT problem_category name, COUNT(*) count,
        COALESCE(SUM((SELECT SUM(r2.downtime_minutes) FROM repairs r2 WHERE r2.problem_id=p.id)),0) downtime
      FROM problems p WHERE machine_id=? AND date(reported_at) BETWEEN ? AND ?
      GROUP BY problem_category ORDER BY count DESC
    `, id, start, end);

    // Monthly trend
    const rawM = ALL(`
      SELECT strftime('%Y-%m', reported_at) month,
        COUNT(*) total, SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) closed
      FROM problems WHERE machine_id=? AND date(reported_at) BETWEEN ? AND ?
      GROUP BY month ORDER BY month
    `, id, start, end);
    const monthlyTrend = fillMonths(start, end, rawM);

    // Problems with repairs
    const problems = ALL(`
      SELECT p.id, p.ticket_number, p.problem_category, p.priority, p.status,
        p.description, p.root_cause, p.reported_by, p.reported_at, p.closed_at,
        COALESCE((SELECT SUM(r.downtime_minutes) FROM repairs r WHERE r.problem_id=p.id),0) downtime,
        (SELECT COUNT(*) FROM repairs r WHERE r.problem_id=p.id) repair_count
      FROM problems p WHERE p.machine_id=? AND date(p.reported_at) BETWEEN ? AND ?
      ORDER BY p.reported_at DESC
    `, id, start, end).map(p => ({
      ...p,
      repairs: ALL("SELECT action_type, action_description, technician, start_time, end_time, downtime_minutes FROM repairs WHERE problem_id=? ORDER BY start_time", p.id),
    }));

    res.json({
      machine, period: { start, end, days },
      kpi: { totalProblems: totalP, openProblems: openP, totalDowntime: dtRow.v, mttr: mttrRow.v || 0, mtbf_hours, avgDowntime: totalP > 0 ? Math.round(dtRow.v / totalP) : 0 },
      byCategory, monthlyTrend, problems,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
