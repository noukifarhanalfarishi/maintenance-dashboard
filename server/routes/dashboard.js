const express = require('express');
const router = express.Router();
const db = require('../db');

// Data source untuk semua endpoint di bawah adalah daily_logs (Planning +
// Trouble) — dashboard ini adalah redesign penuh mengikuti spec baru
// (5 KPI cards, stacked bar Planning vs Trouble, donut kategori, top-5 mesin,
// trend downtime, PM compliance, recent activity).
//
// PD2 BELT terbagi menjadi 2 departemen: Element Ring dan Belt Assy. Semua
// endpoint menerima query param `dept` ('element-ring' | 'belt-assy' | 'all')
// untuk menyaring data per departemen — 'all' berarti PD2 BELT total
// (Element Ring + Belt Assy), BUKAN seluruh mesin di database (ada beberapa
// mesin dari departemen lain/legacy yang di luar cakupan PD2 BELT).

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

function deptClause(dept, alias = 'm') {
  if (dept === 'element-ring') return `${alias}.department = 'Element Ring Dept'`;
  if (dept === 'belt-assy')    return `${alias}.department = 'Belt Assy Dept'`;
  return `${alias}.department IN ('Element Ring Dept','Belt Assy Dept')`;
}

// ──────────────────────────────────────────────
// KPI overview — 5 kartu ringkasan (Row 1)
// ──────────────────────────────────────────────
router.get('/summary-v2', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const { start: ps, end: pe } = prevPeriod(start, end);
    const dc = deptClause(req.query.dept);
    const q = (sql, ...p) => db.prepare(sql).get(...p);
    const TR = "d.log_type='Trouble'";

    // 3. Total Downtime & 4. MTTR — period-scoped (mengikuti period filter dashboard)
    const curDT   = q(`SELECT COALESCE(SUM(d.downtime_minutes),0) v FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE ${TR} AND ${dc} AND d.log_date BETWEEN ? AND ?`, start, end);
    const prevDT  = q(`SELECT COALESCE(SUM(d.downtime_minutes),0) v FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE ${TR} AND ${dc} AND d.log_date BETWEEN ? AND ?`, ps, pe);
    const curMTTR = q(`SELECT ROUND(AVG(d.downtime_minutes),0) v FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE ${TR} AND ${dc} AND d.status='Completed' AND d.log_date BETWEEN ? AND ?`, start, end);
    const prevMTTR= q(`SELECT ROUND(AVG(d.downtime_minutes),0) v FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE ${TR} AND ${dc} AND d.status='Completed' AND d.log_date BETWEEN ? AND ?`, ps, pe);

    // 1. Aktivitas Hari Ini — selalu tanggal hari ini, tidak ikut period filter
    const today = new Date().toISOString().slice(0, 10);
    const todayPlanning = q(`SELECT COUNT(*) c FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Planning' AND ${dc} AND d.log_date=?`, today);
    const todayTrouble  = q(`SELECT COUNT(*) c FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Trouble'  AND ${dc} AND d.log_date=?`, today);

    // 5. Open Items — Carry Over + Pending Part + In Progress, kondisi saat ini
    // (bukan period-scoped — ini backlog kerja yang belum selesai sekarang)
    const openRow = q(`
      SELECT
        SUM(CASE WHEN d.status='Carry Over'   THEN 1 ELSE 0 END) carry_over,
        SUM(CASE WHEN d.status='Pending Part' THEN 1 ELSE 0 END) pending_part,
        SUM(CASE WHEN d.status='In Progress'  THEN 1 ELSE 0 END) in_progress
      FROM daily_logs d JOIN machines m ON d.machine_id=m.id
      WHERE d.status IN ('Carry Over','Pending Part','In Progress') AND ${dc}
    `);
    const carryOver   = openRow.carry_over   || 0;
    const pendingPart = openRow.pending_part || 0;
    const inProgress  = openRow.in_progress  || 0;

    // 2. PM Completion Rate — % PM schedule aktif yang masih on-track (belum
    // overdue) saat ini. Proxy untuk "seberapa terjaga jadwal PM bulan ini".
    const pmAgg = q(`
      SELECT COUNT(*) total, SUM(CASE WHEN date(p.next_due_date) < date('now') THEN 1 ELSE 0 END) overdue
      FROM pm_schedules p JOIN machines m ON p.machine_id=m.id
      WHERE p.is_active=1 AND ${dc}
    `);
    const pmTotal = pmAgg.total || 0;
    const pmOnTrack = pmTotal - (pmAgg.overdue || 0);
    const pmRate = pmTotal > 0 ? Math.round((pmOnTrack / pmTotal) * 100) : 100;

    res.json({
      period: { start, end, prevStart: ps, prevEnd: pe },
      todayActivity: { planning: todayPlanning.c, trouble: todayTrouble.c, total: todayPlanning.c + todayTrouble.c },
      pmCompletion:  { rate: pmRate, onTrack: pmOnTrack, total: pmTotal },
      downtime:      { value: curDT.v, prev: prevDT.v, change: pct(curDT.v, prevDT.v) },
      mttr:          { value: curMTTR.v || 0, prev: prevMTTR.v || 0, change: pct(curMTTR.v, prevMTTR.v) },
      openItems:     { count: carryOver + pendingPart + inProgress, carryOver, pendingPart, inProgress },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Weekly activity — Planning vs Trouble per minggu, 12 minggu terakhir
// (stacked bar chart + sumber data trend downtime mingguan)
// ──────────────────────────────────────────────
router.get('/weekly-trend', (req, res) => {
  try {
    const dc = deptClause(req.query.dept);
    const data = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const wEnd = new Date(now);
      wEnd.setDate(wEnd.getDate() - i * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);

      const s = wStart.toISOString().slice(0, 10);
      const e = wEnd.toISOString().slice(0, 10);

      const planning = db.prepare(`SELECT COUNT(*) c FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Planning' AND ${dc} AND d.log_date BETWEEN ? AND ?`).get(s, e);
      const trouble  = db.prepare(`SELECT COUNT(*) c FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Trouble'  AND ${dc} AND d.log_date BETWEEN ? AND ?`).get(s, e);
      const dt       = db.prepare(`SELECT COALESCE(SUM(d.downtime_minutes),0) v FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Trouble' AND ${dc} AND d.log_date BETWEEN ? AND ?`).get(s, e);

      data.push({
        label: wStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        start: s, end: e,
        planning: planning.c,
        trouble: trouble.c,
        downtime_hours: +(dt.v / 60).toFixed(1),
      });
    }
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// By-category — dipakai untuk donut Distribusi Kategori Trouble (period filter)
// ──────────────────────────────────────────────
router.get('/by-category', (req, res) => {
  try {
    const { start, end, dept } = req.query;
    const dc = deptClause(dept);
    const rows = start && end
      ? db.prepare(`SELECT d.category name, COUNT(*) value FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Trouble' AND ${dc} AND d.log_date BETWEEN ? AND ? GROUP BY d.category ORDER BY value DESC`).all(start, end)
      : db.prepare(`SELECT d.category name, COUNT(*) value FROM daily_logs d JOIN machines m ON d.machine_id=m.id WHERE d.log_type='Trouble' AND ${dc} GROUP BY d.category ORDER BY value DESC`).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Top 5 mesin — trouble count + downtime (period filter)
// ──────────────────────────────────────────────
router.get('/top-downtime', (req, res) => {
  try {
    const { start, end } = parsePeriod(req.query);
    const dc = deptClause(req.query.dept);
    const data = db.prepare(`
      SELECT m.machine_code, m.machine_name, m.location,
             COALESCE(SUM(d.downtime_minutes), 0)        AS total_minutes,
             ROUND(COALESCE(SUM(d.downtime_minutes), 0) / 60.0, 1) AS total_hours,
             COUNT(d.id)                                  AS problem_count
      FROM machines m
      LEFT JOIN daily_logs d ON m.id = d.machine_id AND d.log_type='Trouble' AND d.log_date BETWEEN ? AND ?
      WHERE ${dc}
      GROUP BY m.id
      HAVING total_minutes > 0
      ORDER BY total_minutes DESC
      LIMIT 5
    `).all(start, end);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Low stock spare parts (dipakai badge notifikasi di Header) — tidak
// tersegmentasi per departemen karena spare part dipakai lintas mesin/dept.
// ──────────────────────────────────────────────
router.get('/low-stock', (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM spare_parts WHERE stock_quantity <= minimum_stock ORDER BY (stock_quantity - minimum_stock)").all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// Recent activity — 10 log terbaru gabungan Planning + Trouble (Row 4)
// ──────────────────────────────────────────────
router.get('/recent-activity', (req, res) => {
  try {
    const { limit = 10, dept } = req.query;
    const dc = deptClause(dept);
    const rows = db.prepare(`
      SELECT d.id, d.log_number, d.log_type, d.category, d.description, d.technician, d.status,
             d.log_date, d.start_time, d.end_time, m.machine_code, m.machine_name
      FROM daily_logs d JOIN machines m ON d.machine_id = m.id
      WHERE ${dc}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ?
    `).all(parseInt(limit));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// PM compliance summary per tipe PM (mini cards Row 4)
// ──────────────────────────────────────────────
router.get('/pm-summary', (req, res) => {
  try {
    const dc = deptClause(req.query.dept);
    const rows = db.prepare(`
      SELECT p.pm_type,
        COUNT(*) total,
        SUM(CASE WHEN date(p.next_due_date) < date('now') THEN 1 ELSE 0 END) overdue,
        SUM(CASE WHEN date(p.next_due_date) >= date('now') THEN 1 ELSE 0 END) on_track
      FROM pm_schedules p JOIN machines m ON p.machine_id=m.id
      WHERE p.is_active=1 AND ${dc}
      GROUP BY p.pm_type
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
