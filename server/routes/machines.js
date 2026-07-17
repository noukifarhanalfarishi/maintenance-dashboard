const express = require('express');
const router = express.Router();
const db = require('../db');

// NOTE: "problem" di sini = daily_logs dengan log_type='Trouble' (setara
// konsep lama "problems" pasca migrasi ke Daily Maintenance Activity Log).
// Nama field response (total_problems, open_problems, dst) dipertahankan
// apa adanya supaya halaman client (Machines.jsx, Dashboard.jsx) yang sudah
// ada tetap jalan tanpa perubahan.

// ── GET /api/machines — list with aggregated stats ─────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, type, location, search } = req.query;
    const conds = [], params = [];

    if (status)   { conds.push('m.status = ?');       params.push(status); }
    if (type)     { conds.push('m.machine_type = ?');  params.push(type); }
    if (location) { conds.push('m.location = ?');      params.push(location); }
    if (search)   {
      conds.push('(m.machine_code LIKE ? OR m.machine_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble')                          AS total_problems,
        (SELECT COUNT(*) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble' AND d.status != 'Completed') AS open_problems,
        (SELECT COALESCE(SUM(d.downtime_minutes),0) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble') AS total_downtime,
        (SELECT MAX(d.start_time) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble')                 AS last_problem_at
      FROM machines m
      ${where}
      ORDER BY m.machine_code
    `).all(...params);

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/machines/meta — distinct types & locations for filters ─────────
router.get('/meta', (req, res) => {
  try {
    const types     = db.prepare("SELECT DISTINCT machine_type FROM machines WHERE machine_type IS NOT NULL ORDER BY machine_type").all().map(r => r.machine_type);
    const locations = db.prepare("SELECT DISTINCT location      FROM machines WHERE location      IS NOT NULL ORDER BY location").all().map(r => r.location);
    const depts     = db.prepare("SELECT DISTINCT department    FROM machines WHERE department    IS NOT NULL ORDER BY department").all().map(r => r.department);
    res.json({ types, locations, depts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/machines/:id — detail + problem (Trouble log) history ─────────
router.get('/:id', (req, res) => {
  try {
    const machine = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble')                          AS total_problems,
        (SELECT COUNT(*) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble' AND d.status != 'Completed') AS open_problems,
        (SELECT COALESCE(SUM(d.downtime_minutes),0) FROM daily_logs d WHERE d.machine_id = m.id AND d.log_type = 'Trouble') AS total_downtime
      FROM machines m WHERE m.id = ?
    `).get(req.params.id);

    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const problems = db.prepare(`
      SELECT d.id, d.log_number AS ticket_number, d.category AS problem_category, d.priority, d.status,
             d.description, d.reported_by, d.start_time AS reported_at,
             CASE WHEN d.status = 'Completed' THEN d.end_time ELSE NULL END AS closed_at,
             d.downtime_minutes AS downtime, d.technician
      FROM daily_logs d
      WHERE d.machine_id = ? AND d.log_type = 'Trouble'
      ORDER BY d.start_time DESC
      LIMIT 50
    `).all(req.params.id);

    res.json({ ...machine, problems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/machines/:id/logs — riwayat aktivitas (Planning + Trouble) ────
// Dipakai oleh section "Activity History" di drawer detail mesin — beda dari
// GET /:id yang hanya mengembalikan histori Trouble ("problems", dipertahankan
// untuk kompatibilitas nama field lama).
router.get('/:id/logs', (req, res) => {
  try {
    const { log_type, limit = 50 } = req.query;
    const conds = ['machine_id = ?'], params = [req.params.id];
    if (log_type && log_type !== 'all') { conds.push('log_type = ?'); params.push(log_type); }

    const rows = db.prepare(`
      SELECT id, log_number, log_type, category, priority, status, description, findings, action_taken,
             technician, reported_by, start_time, end_time, downtime_minutes, log_date
      FROM daily_logs WHERE ${conds.join(' AND ')}
      ORDER BY start_time DESC LIMIT ?
    `).all(...params, parseInt(limit));

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/machines/:id/stats — KPI: MTBF, MTTR, monthly comparison ─────
router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const curStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const curEnd    = now.toISOString().slice(0, 10);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const q = (sql, ...p) => db.prepare(sql).get(...p);

    // Current & previous month
    const curProb  = q("SELECT COUNT(*) c FROM daily_logs WHERE machine_id=? AND log_type='Trouble' AND log_date BETWEEN ? AND ?", id, curStart, curEnd);
    const prevProb = q("SELECT COUNT(*) c FROM daily_logs WHERE machine_id=? AND log_type='Trouble' AND log_date BETWEEN ? AND ?", id, prevStart, prevEnd);
    const curDT    = q("SELECT COALESCE(SUM(downtime_minutes),0) v FROM daily_logs WHERE machine_id=? AND log_type='Trouble' AND log_date BETWEEN ? AND ?", id, curStart, curEnd);
    const prevDT   = q("SELECT COALESCE(SUM(downtime_minutes),0) v FROM daily_logs WHERE machine_id=? AND log_type='Trouble' AND log_date BETWEEN ? AND ?", id, prevStart, prevEnd);

    // MTTR — rata-rata downtime_minutes untuk Trouble yang sudah Completed
    const mttr = q(`
      SELECT ROUND(AVG(downtime_minutes),0) v
      FROM daily_logs
      WHERE machine_id=? AND log_type='Trouble' AND status='Completed'
    `, id);

    // MTBF — rata-rata jarak antar kejadian Trouble berturut-turut (jam)
    const problemDates = db.prepare(
      "SELECT start_time FROM daily_logs WHERE machine_id=? AND log_type='Trouble' ORDER BY start_time ASC"
    ).all(id).map(r => new Date(r.start_time));

    let mtbf_hours = null;
    if (problemDates.length >= 2) {
      let sum = 0;
      for (let i = 1; i < problemDates.length; i++) {
        sum += problemDates[i] - problemDates[i - 1];
      }
      mtbf_hours = Math.round(sum / (problemDates.length - 1) / 3600000);
    }

    const pct = (c, p) => p ? Math.round(((c - p) / p) * 100) : null;

    res.json({
      currentMonth:  { problems: curProb.c,  downtime: curDT.v  },
      previousMonth: { problems: prevProb.c, downtime: prevDT.v },
      probChange: pct(curProb.c, prevProb.c),
      dtChange:   pct(curDT.v,  prevDT.v),
      mttr_minutes: mttr.v || 0,
      mtbf_hours,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/machines/:id/chart-data ──────────────────────────────────────
router.get('/:id/chart-data', (req, res) => {
  try {
    const { id } = req.params;

    // 6-month monthly breakdown
    const monthly = db.prepare(`
      SELECT strftime('%Y-%m', log_date) month,
             COUNT(*)                                                AS total,
             SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END)     AS closed,
             COALESCE(SUM(downtime_minutes),0)                       AS downtime_min
      FROM daily_logs
      WHERE machine_id=? AND log_type='Trouble' AND log_date >= date('now','-6 months')
      GROUP BY month ORDER BY month
    `).all(id);

    // Fill missing months so the chart looks continuous
    const filled = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const found = monthly.find(m => m.month === key);
      filled.push(found || { month: key, total: 0, closed: 0, downtime_min: 0 });
    }
    filled.forEach(r => {
      const d = new Date(r.month + '-01');
      r.label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    });

    // Category breakdown
    const byCategory = db.prepare(`
      SELECT category name, COUNT(*) value
      FROM daily_logs WHERE machine_id=? AND log_type='Trouble'
      GROUP BY category ORDER BY value DESC
    `).all(id);

    res.json({ monthly: filled, byCategory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/machines ────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { machine_code, machine_name, machine_type, line, location, department, status, pm_daily, pm_weekly, pm_monthly } = req.body;
    if (!machine_code || !machine_name)
      return res.status(400).json({ error: 'machine_code and machine_name are required' });
    const result = db.prepare(`
      INSERT INTO machines (machine_code, machine_name, machine_type, line, location, department, status, pm_daily, pm_weekly, pm_monthly)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      machine_code, machine_name, machine_type || null, line || null, location || null, department || null, status || 'active',
      pm_daily === undefined ? 1 : pm_daily, pm_weekly === undefined ? 1 : pm_weekly, pm_monthly === undefined ? 1 : pm_monthly
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Machine created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Kode mesin sudah ada' });
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/machines/:id ─────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { machine_code, machine_name, machine_type, line, location, department, status, pm_daily, pm_weekly, pm_monthly } = req.body;
    const result = db.prepare(`
      UPDATE machines SET machine_code=?, machine_name=?, machine_type=?, line=?, location=?, department=?, status=?,
        pm_daily=?, pm_weekly=?, pm_monthly=?
      WHERE id=?
    `).run(
      machine_code, machine_name, machine_type, line || null, location, department, status,
      pm_daily === undefined ? 1 : pm_daily, pm_weekly === undefined ? 1 : pm_weekly, pm_monthly === undefined ? 1 : pm_monthly,
      req.params.id
    );
    if (!result.changes) return res.status(404).json({ error: 'Machine not found' });
    res.json({ message: 'Machine updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/machines/:id ──────────────────────────────────────────────
// daily_logs.machine_id bersifat NOT NULL (setiap log harus terhubung ke
// mesin), jadi berbeda dari perilaku lama yang "melepas" (set NULL) histori
// problem — di sini mesin yang masih punya daily_logs tidak boleh dihapus,
// supaya histori maintenance tidak pernah hilang diam-diam. Nonaktifkan
// (status: 'inactive') sebagai gantinya bila mesin sudah tidak dipakai.
router.delete('/:id', (req, res) => {
  try {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const linked = db.prepare('SELECT COUNT(*) c FROM daily_logs WHERE machine_id = ?').get(req.params.id).c;
    if (linked > 0) {
      return res.status(400).json({
        error: `Mesin ini memiliki ${linked} histori daily log dan tidak bisa dihapus. Nonaktifkan mesin (status: inactive) sebagai gantinya.`,
      });
    }

    const del = db.transaction(() => {
      db.prepare('DELETE FROM pm_schedules WHERE machine_id = ?').run(req.params.id);
      return db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);
    });

    del();
    res.json({ message: 'Machine deleted', problems_detached: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
