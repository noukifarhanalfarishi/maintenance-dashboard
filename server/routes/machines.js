const express = require('express');
const router = express.Router();
const db = require('../db');

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
        (SELECT COUNT(*) FROM problems p WHERE p.machine_id = m.id)                        AS total_problems,
        (SELECT COUNT(*) FROM problems p WHERE p.machine_id = m.id AND p.status != 'Closed') AS open_problems,
        (SELECT COALESCE(SUM(r.downtime_minutes),0)
           FROM repairs r JOIN problems p ON r.problem_id = p.id
           WHERE p.machine_id = m.id)                                                       AS total_downtime,
        (SELECT MAX(p.reported_at) FROM problems p WHERE p.machine_id = m.id)              AS last_problem_at
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

// ── GET /api/machines/:id — detail + problem history ──────────────────────
router.get('/:id', (req, res) => {
  try {
    const machine = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM problems p WHERE p.machine_id = m.id)                        AS total_problems,
        (SELECT COUNT(*) FROM problems p WHERE p.machine_id = m.id AND p.status != 'Closed') AS open_problems,
        (SELECT COALESCE(SUM(r.downtime_minutes),0)
           FROM repairs r JOIN problems p ON r.problem_id = p.id
           WHERE p.machine_id = m.id)                                                       AS total_downtime
      FROM machines m WHERE m.id = ?
    `).get(req.params.id);

    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const problems = db.prepare(`
      SELECT p.id, p.ticket_number, p.problem_category, p.priority, p.status,
             p.description, p.reported_by, p.reported_at, p.closed_at,
             COALESCE((SELECT SUM(r.downtime_minutes) FROM repairs r WHERE r.problem_id = p.id), 0) AS downtime,
             (SELECT r.technician FROM repairs r WHERE r.problem_id = p.id ORDER BY r.start_time LIMIT 1) AS technician
      FROM problems p
      WHERE p.machine_id = ?
      ORDER BY p.reported_at DESC
      LIMIT 50
    `).all(req.params.id);

    res.json({ ...machine, problems });
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
    const curProb  = q("SELECT COUNT(*) c FROM problems WHERE machine_id=? AND date(reported_at) BETWEEN ? AND ?", id, curStart, curEnd);
    const prevProb = q("SELECT COUNT(*) c FROM problems WHERE machine_id=? AND date(reported_at) BETWEEN ? AND ?", id, prevStart, prevEnd);
    const curDT    = q("SELECT COALESCE(SUM(r.downtime_minutes),0) v FROM repairs r JOIN problems p ON r.problem_id=p.id WHERE p.machine_id=? AND date(r.start_time) BETWEEN ? AND ?", id, curStart, curEnd);
    const prevDT   = q("SELECT COALESCE(SUM(r.downtime_minutes),0) v FROM repairs r JOIN problems p ON r.problem_id=p.id WHERE p.machine_id=? AND date(r.start_time) BETWEEN ? AND ?", id, prevStart, prevEnd);

    // MTTR — average of (closed_at - reported_at) for closed problems
    const mttr = q(`
      SELECT ROUND(AVG((julianday(closed_at)-julianday(reported_at))*1440),0) v
      FROM problems
      WHERE machine_id=? AND status='Closed' AND closed_at IS NOT NULL
    `, id);

    // MTBF — average gap between consecutive problem reports (hours)
    const problemDates = db.prepare(
      "SELECT reported_at FROM problems WHERE machine_id=? ORDER BY reported_at ASC"
    ).all(id).map(r => new Date(r.reported_at));

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
      SELECT strftime('%Y-%m', reported_at) month,
             COUNT(*)                                                    AS total,
             SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END)           AS closed,
             COALESCE(SUM(
               CASE WHEN status='Closed'
                    THEN CAST((julianday(closed_at)-julianday(reported_at))*1440 AS INTEGER)
               ELSE 0 END
             ),0)                                                        AS downtime_min
      FROM problems
      WHERE machine_id=? AND reported_at >= date('now','-6 months')
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
      SELECT problem_category name, COUNT(*) value
      FROM problems WHERE machine_id=?
      GROUP BY problem_category ORDER BY value DESC
    `).all(id);

    res.json({ monthly: filled, byCategory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/machines ────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { machine_code, machine_name, machine_type, location, department, status } = req.body;
    if (!machine_code || !machine_name)
      return res.status(400).json({ error: 'machine_code and machine_name are required' });
    const result = db.prepare(`
      INSERT INTO machines (machine_code, machine_name, machine_type, location, department, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(machine_code, machine_name, machine_type || null, location || null, department || null, status || 'active');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Machine created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Kode mesin sudah ada' });
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/machines/:id ─────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { machine_code, machine_name, machine_type, location, department, status } = req.body;
    const result = db.prepare(`
      UPDATE machines SET machine_code=?, machine_name=?, machine_type=?, location=?, department=?, status=?
      WHERE id=?
    `).run(machine_code, machine_name, machine_type, location, department, status, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Machine not found' });
    res.json({ message: 'Machine updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/machines/:id ──────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const machine = db.prepare('SELECT id FROM machines WHERE id = ?').get(req.params.id);
    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    // Hitung problem terkait sebelum dihapus (untuk info response)
    const linked = db.prepare('SELECT COUNT(*) c FROM problems WHERE machine_id = ?').get(req.params.id).c;

    // Jalankan dalam transaction:
    // 1. Putuskan relasi problem → mesin (set NULL, histori tetap terjaga)
    // 2. Hapus mesin
    const del = db.transaction(() => {
      db.prepare('UPDATE problems SET machine_id = NULL WHERE machine_id = ?').run(req.params.id);
      return db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);
    });

    del();
    res.json({ message: 'Machine deleted', problems_detached: linked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
