const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/pm-schedules ────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { machine_id, pm_type, is_active, due } = req.query;
    const conds = [], params = [];

    if (machine_id) { conds.push('p.machine_id = ?'); params.push(machine_id); }
    if (pm_type)    { conds.push('p.pm_type = ?');    params.push(pm_type); }
    if (is_active)  { conds.push('p.is_active = ?');  params.push(is_active === 'true' || is_active === '1' ? 1 : 0); }
    if (due === 'overdue') conds.push("date(p.next_due_date) < date('now')");
    if (due === 'soon')    conds.push("date(p.next_due_date) BETWEEN date('now') AND date('now','+7 days')");

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = db.prepare(`
      SELECT p.*, m.machine_code, m.machine_name, m.location, m.department
      FROM pm_schedules p
      LEFT JOIN machines m ON p.machine_id = m.id
      ${where}
      ORDER BY p.next_due_date ASC
    `).all(...params);

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/pm-schedules/:id ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT p.*, m.machine_code, m.machine_name
      FROM pm_schedules p LEFT JOIN machines m ON p.machine_id = m.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'PM schedule not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/pm-schedules ────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { machine_id, pm_type, description, interval_days, last_done_date, next_due_date, assigned_to, is_active } = req.body;
    if (!machine_id || !pm_type || !interval_days)
      return res.status(400).json({ error: 'machine_id, pm_type, interval_days wajib diisi' });

    const result = db.prepare(`
      INSERT INTO pm_schedules (machine_id, pm_type, description, interval_days, last_done_date, next_due_date, assigned_to, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(machine_id, pm_type, description || null, interval_days, last_done_date || null, next_due_date || null, assigned_to || null, is_active === undefined ? 1 : is_active);

    res.status(201).json({ id: result.lastInsertRowid, message: 'PM schedule created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/pm-schedules/:id ─────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { machine_id, pm_type, description, interval_days, last_done_date, next_due_date, assigned_to, is_active } = req.body;
    const result = db.prepare(`
      UPDATE pm_schedules SET
        machine_id=?, pm_type=?, description=?, interval_days=?,
        last_done_date=?, next_due_date=?, assigned_to=?, is_active=?
      WHERE id=?
    `).run(machine_id, pm_type, description || null, interval_days, last_done_date || null, next_due_date || null, assigned_to || null, is_active === undefined ? 1 : is_active, req.params.id);

    if (!result.changes) return res.status(404).json({ error: 'PM schedule not found' });
    res.json({ message: 'PM schedule updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/pm-schedules/:id/complete — tandai selesai, jadwalkan
// berikutnya, DAN otomatis catat entry Planning di daily_logs supaya PM yang
// ditandai selesai dari kalender ini tetap tercatat di histori Daily Log.
router.patch('/:id/complete', (req, res) => {
  try {
    const { done_date, shift, technician, reported_by, notes } = req.body;
    const sched = db.prepare('SELECT * FROM pm_schedules WHERE id = ?').get(req.params.id);
    if (!sched) return res.status(404).json({ error: 'PM schedule not found' });

    const doneDate  = done_date || new Date().toISOString().slice(0, 10);
    const nextDue   = new Date(doneDate);
    nextDue.setDate(nextDue.getDate() + sched.interval_days);
    const nextDueStr = nextDue.toISOString().slice(0, 10);

    const machine = db.prepare('SELECT machine_code FROM machines WHERE id = ?').get(sched.machine_id);
    const ds   = doneDate.replace(/-/g, '');
    const last = db.prepare("SELECT log_number FROM daily_logs WHERE log_number LIKE ? ORDER BY log_number DESC LIMIT 1").get(`LOG-${ds}-%`);
    const seq  = last ? parseInt(last.log_number.split('-')[2]) + 1 : 1;
    const logNumber = `LOG-${ds}-${String(seq).padStart(3, '0')}`;
    const shiftNum = parseInt(shift) || 1;
    const tech     = technician || sched.assigned_to || 'Teknisi';
    const reporter = reported_by || tech;
    const nowTime  = `${doneDate} ${new Date().toTimeString().slice(0, 8)}`;

    const tx = db.transaction(() => {
      db.prepare('UPDATE pm_schedules SET last_done_date=?, next_due_date=? WHERE id=?')
        .run(doneDate, nextDueStr, req.params.id);

      db.prepare(`
        INSERT INTO daily_logs
          (log_number, log_date, shift, log_type, machine_id, description, category, priority,
           technician, start_time, end_time, downtime_minutes, status, notes, reported_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)
      `).run(
        logNumber, doneDate, shiftNum, 'Planning', sched.machine_id,
        sched.description || `${sched.pm_type} pada ${machine?.machine_code || 'mesin'} sesuai jadwal PM.`,
        sched.pm_type, 'Medium', tech, nowTime, nowTime, 'Completed', notes || null, reporter
      );
    });
    tx();

    res.json({ message: 'PM schedule diperbarui', last_done_date: doneDate, next_due_date: nextDueStr, log_number: logNumber });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/pm-schedules/:id ──────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM pm_schedules WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'PM schedule not found' });
    res.json({ message: 'PM schedule deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
