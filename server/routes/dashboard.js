const express = require('express');
const router = express.Router();
const db = require('../db');

function parsePeriod(query) {
  const { start, end } = query;
  if (start && end) return { start, end };
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { start: s, end: now.toISOString().slice(0, 10) };
}

function prevPeriod(start, end) {
  const s = new Date(start), e = new Date(end);
  const days = Math.round((e - s) / 86400000) + 1;
  const pe = new Date(s); pe.setDate(pe.getDate() - 1);
  const ps = new Date(pe); ps.setDate(ps.getDate() - days + 1);
  return { start: ps.toISOString().slice(0, 10), end: pe.toISOString().slice(0, 10) };
}

function pct(cur, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

// ──────────────────────────────────────────────
// NEW: Summary V2 — with period + comparison
// ──────────────────────────────────────────────
router.get('/summary-v2', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const { start: ps, end: pe } = prevPeriod(start, end);

    const q = (sql, ...p) => db.prepare(sql).get(...p);

    const curTotal   = q('SELECT COUNT(*) c FROM problems WHERE date(reported_at) BETWEEN ? AND ?', start, end);
    const prevTotal  = q('SELECT COUNT(*) c FROM problems WHERE date(reported_at) BETWEEN ? AND ?', ps, pe);
    const openCount  = q("SELECT COUNT(*) c FROM problems WHERE status != 'Closed'");
    const critCount  = q("SELECT COUNT(*) c FROM problems WHERE status != 'Closed' AND priority = 'Critical'");
    const curDT      = q('SELECT COALESCE(SUM(downtime_minutes),0) v FROM repairs WHERE date(start_time) BETWEEN ? AND ?', start, end);
    const prevDT     = q('SELECT COALESCE(SUM(downtime_minutes),0) v FROM repairs WHERE date(start_time) BETWEEN ? AND ?', ps, pe);
    const curMTTR    = q(`SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) v
                          FROM problems WHERE status='Closed' AND closed_at IS NOT NULL AND date(reported_at) BETWEEN ? AND ?`, start, end);
    const prevMTTR   = q(`SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) v
                          FROM problems WHERE status='Closed' AND closed_at IS NOT NULL AND date(reported_at) BETWEEN ? AND ?`, ps, pe);
    const closedCur  = q("SELECT COUNT(*) c FROM problems WHERE status='Closed' AND date(closed_at) BETWEEN ? AND ?", start, end);

    res.json({
      period: { start, end, prevStart: ps, prevEnd: pe },
      totalProblems: { value: curTotal.c, prev: prevTotal.c, change: pct(curTotal.c, prevTotal.c) },
      openProblems:  { value: openCount.c, critical: critCount.c },
      downtime:      { value: curDT.v, prev: prevDT.v, change: pct(curDT.v, prevDT.v) },
      mttr:          { value: curMTTR.v || 0, prev: prevMTTR.v || 0, change: pct(curMTTR.v, prevMTTR.v) },
      closedCount:   closedCur.c,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// NEW: Weekly trend — last 12 weeks
// ──────────────────────────────────────────────
router.get('/weekly-trend', (req, res) => {
  try {
    const data = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const wEnd = new Date(now);
      wEnd.setDate(wEnd.getDate() - i * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);

      const s = wStart.toISOString().slice(0, 10);
      const e = wEnd.toISOString().slice(0, 10);

      const newP    = db.prepare("SELECT COUNT(*) c FROM problems WHERE date(reported_at) BETWEEN ? AND ?").get(s, e);
      const closed  = db.prepare("SELECT COUNT(*) c FROM problems WHERE status='Closed' AND date(closed_at) BETWEEN ? AND ?").get(s, e);

      data.push({
        label: wStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        start: s, end: e,
        new: newP.c,
        closed: closed.c,
      });
    }
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// NEW: Top 5 mesin — downtime (period filter)
// ──────────────────────────────────────────────
router.get('/top-downtime', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const data = db.prepare(`
      SELECT m.machine_code, m.machine_name, m.location,
             COALESCE(SUM(r.downtime_minutes), 0)        AS total_minutes,
             ROUND(COALESCE(SUM(r.downtime_minutes), 0) / 60.0, 1) AS total_hours,
             COUNT(DISTINCT p.id)                        AS problem_count
      FROM machines m
      LEFT JOIN problems p ON m.id = p.machine_id
      LEFT JOIN repairs   r ON p.id = r.problem_id AND date(r.start_time) BETWEEN ? AND ?
      GROUP BY m.id
      HAVING total_minutes > 0
      ORDER BY total_minutes DESC
      LIMIT 5
    `).all(start, end);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// NEW: Pareto by category (period filter)
// ──────────────────────────────────────────────
router.get('/pareto', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const raw = db.prepare(`
      SELECT problem_category name, COUNT(*) count
      FROM problems WHERE date(reported_at) BETWEEN ? AND ?
      GROUP BY problem_category ORDER BY count DESC
    `).all(start, end);

    const total = raw.reduce((s, r) => s + r.count, 0);
    let cum = 0;
    const result = raw.map(r => {
      cum += r.count;
      return { ...r, pct: Math.round(r.count / total * 100), cumulative_pct: Math.round(cum / total * 100) };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Updated: by-category with optional period filter
// ──────────────────────────────────────────────
router.get('/by-category', (req, res) => {
  try {
    const { start, end } = req.query;
    const rows = start && end
      ? db.prepare("SELECT problem_category name, COUNT(*) value FROM problems WHERE date(reported_at) BETWEEN ? AND ? GROUP BY problem_category ORDER BY value DESC").all(start, end)
      : db.prepare("SELECT problem_category name, COUNT(*) value FROM problems GROUP BY problem_category ORDER BY value DESC").all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Updated: recent-problems with period filter + technician
// ──────────────────────────────────────────────
router.get('/recent-problems', (req, res) => {
  try {
    const { start, end, limit = 10 } = req.query;
    const lim = parseInt(limit);
    const rows = start && end
      ? db.prepare(`
          SELECT p.id, p.ticket_number, p.problem_category, p.priority, p.description,
                 p.status, p.reported_by, p.reported_at, p.root_cause, p.closed_at,
                 m.machine_code, m.machine_name, m.location,
                 (SELECT r.technician FROM repairs r WHERE r.problem_id = p.id ORDER BY r.start_time LIMIT 1) technician
          FROM problems p LEFT JOIN machines m ON p.machine_id = m.id
          WHERE date(p.reported_at) BETWEEN ? AND ?
          ORDER BY p.reported_at DESC LIMIT ?`).all(start, end, lim)
      : db.prepare(`
          SELECT p.id, p.ticket_number, p.problem_category, p.priority, p.description,
                 p.status, p.reported_by, p.reported_at, p.root_cause, p.closed_at,
                 m.machine_code, m.machine_name, m.location,
                 (SELECT r.technician FROM repairs r WHERE r.problem_id = p.id ORDER BY r.start_time LIMIT 1) technician
          FROM problems p LEFT JOIN machines m ON p.machine_id = m.id
          ORDER BY p.reported_at DESC LIMIT ?`).all(lim);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Legacy endpoints (kept for other pages)
// ──────────────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const statusCounts    = db.prepare("SELECT status, COUNT(*) count FROM problems GROUP BY status").all();
    const priorityCounts  = db.prepare("SELECT priority, COUNT(*) count FROM problems WHERE status!='Closed' GROUP BY priority").all();
    const curMonth        = new Date().toISOString().slice(0, 7);
    const downtimeMonth   = db.prepare("SELECT COALESCE(SUM(r.downtime_minutes),0) total FROM repairs r WHERE strftime('%Y-%m',r.start_time)=?").get(curMonth);
    const totalMachines   = db.prepare("SELECT COUNT(*) count FROM machines WHERE status='active'").get();
    const machinesOpen    = db.prepare("SELECT COUNT(DISTINCT machine_id) count FROM problems WHERE status IN ('Open','In Progress','Pending Part')").get();
    const avgRes          = db.prepare("SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) avg_minutes FROM problems WHERE status='Closed' AND closed_at IS NOT NULL").get();
    res.json({ statusCounts, priorityCounts, downtimeThisMonth: downtimeMonth.total, totalActiveMachines: totalMachines.count, machinesWithOpenProblems: machinesOpen.count, avgResolutionMinutes: avgRes.avg_minutes || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/monthly-trend', (req, res) => {
  try {
    const data = db.prepare(`
      SELECT strftime('%Y-%m', reported_at) month, COUNT(*) total,
             SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) closed,
             COALESCE(SUM(CASE WHEN status='Closed' THEN CAST((julianday(closed_at)-julianday(reported_at))*1440 AS INT) ELSE 0 END),0) total_downtime
      FROM problems WHERE reported_at >= date('now','-6 months')
      GROUP BY month ORDER BY month`).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/top-machines', (req, res) => {
  try {
    const data = db.prepare(`
      SELECT m.machine_code, m.machine_name, m.location, COUNT(p.id) problem_count,
             COALESCE(SUM(r.downtime_minutes),0) total_downtime,
             SUM(CASE WHEN p.status!='Closed' THEN 1 ELSE 0 END) open_count
      FROM machines m LEFT JOIN problems p ON m.id=p.machine_id LEFT JOIN repairs r ON p.id=r.problem_id
      GROUP BY m.id ORDER BY problem_count DESC LIMIT 8`).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/downtime-category', (req, res) => {
  try {
    const data = db.prepare(`
      SELECT p.problem_category name, COALESCE(SUM(r.downtime_minutes),0) total_downtime, COUNT(p.id) count
      FROM problems p LEFT JOIN repairs r ON p.id=r.problem_id
      GROUP BY p.problem_category ORDER BY total_downtime DESC`).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/low-stock', (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM spare_parts WHERE stock_quantity <= minimum_stock ORDER BY (stock_quantity - minimum_stock)").all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pareto-line', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const raw = db.prepare(`
      WITH prob_dt AS (
        SELECT p.id, p.machine_id, COALESCE(SUM(r.downtime_minutes),0) dt
        FROM problems p
        LEFT JOIN repairs r ON r.problem_id = p.id
        WHERE date(p.reported_at) BETWEEN ? AND ?
        GROUP BY p.id
      )
      SELECT
        COALESCE(m.line,'(Tanpa Line)') name,
        COUNT(pd.id) count,
        COALESCE(SUM(pd.dt),0) total_dt
      FROM prob_dt pd
      LEFT JOIN machines m ON pd.machine_id = m.id
      GROUP BY COALESCE(m.line,'(Tanpa Line)')
      ORDER BY count DESC
    `).all(start, end);

    const total = raw.reduce((s,r) => s + r.count, 0);
    let cum = 0;
    const result = raw.map(r => {
      cum += r.count;
      return { ...r, pct: Math.round(r.count/total*100), cumulative_pct: Math.round(cum/total*100) };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pareto-machine', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const raw = db.prepare(`
      WITH prob_dt AS (
        SELECT p.id, p.machine_id, COALESCE(SUM(r.downtime_minutes),0) dt
        FROM problems p
        LEFT JOIN repairs r ON r.problem_id = p.id
        WHERE date(p.reported_at) BETWEEN ? AND ?
        GROUP BY p.id
      )
      SELECT
        COALESCE(m.machine_code,'(Tanpa Mesin)') machine_code,
        COALESCE(m.machine_name,'') machine_name,
        COALESCE(m.line,'') line,
        COUNT(pd.id) count,
        COALESCE(SUM(pd.dt),0) total_dt
      FROM prob_dt pd
      LEFT JOIN machines m ON pd.machine_id = m.id
      GROUP BY pd.machine_id
      ORDER BY count DESC
      LIMIT 15
    `).all(start, end);

    const total = raw.reduce((s,r) => s + r.count, 0);
    let cum = 0;
    const result = raw.map(r => {
      cum += r.count;
      return { ...r, pct: Math.round(r.count/total*100), cumulative_pct: Math.round(cum/total*100) };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/new-repeat', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);

    const summary = db.prepare(`
      SELECT
        SUM(CASE WHEN is_repeat='N' THEN 1 ELSE 0 END) new_count,
        SUM(CASE WHEN is_repeat='R' OR is_repeat IS NULL THEN 1 ELSE 0 END) repeat_count,
        COUNT(*) total
      FROM problems WHERE date(reported_at) BETWEEN ? AND ?
    `).get(start, end);

    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', reported_at) month,
        SUM(CASE WHEN is_repeat='N' THEN 1 ELSE 0 END) new_count,
        SUM(CASE WHEN is_repeat='R' OR is_repeat IS NULL THEN 1 ELSE 0 END) repeat_count
      FROM problems
      WHERE reported_at >= date('now','-6 months')
      GROUP BY month ORDER BY month
    `).all();

    const filled = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0,7);
      const found = monthly.find(m => m.month === key);
      filled.push(found || { month: key, new_count: 0, repeat_count: 0 });
    }
    filled.forEach(r => {
      const d = new Date(r.month + '-01');
      r.label = d.toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
    });

    res.json({ summary, monthly: filled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
