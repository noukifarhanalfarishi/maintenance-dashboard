const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Log number generator: LOG-YYYYMMDD-001 ─────────────────────────────────
function genLogNumber(dateStr) {
  const ds = dateStr
    ? dateStr.slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = db.prepare(
    "SELECT log_number FROM daily_logs WHERE log_number LIKE ? ORDER BY log_number DESC LIMIT 1"
  ).get(`LOG-${ds}-%`);
  const seq = last ? parseInt(last.log_number.split('-')[2]) + 1 : 1;
  return `LOG-${ds}-${String(seq).padStart(3, '0')}`;
}

function parseRow(row) {
  if (!row) return row;
  return {
    ...row,
    spare_parts_used: row.spare_parts_used ? JSON.parse(row.spare_parts_used) : [],
    // ── Alias legacy "problem" field names — beberapa halaman client (mis.
    // drawer detail di Dashboard) masih memakai nama field lama.
    ticket_number:    row.log_number,
    problem_category: row.category,
    reported_at:      row.start_time || row.log_date,
    closed_at:        row.status === 'Completed' ? row.end_time : null,
    root_cause:       row.findings,
    repairs: row.log_type === 'Trouble' ? [{
      id: row.id,
      action_type: row.category,
      action_description: row.action_taken,
      technician: row.technician,
      start_time: row.start_time,
      end_time: row.end_time,
      downtime_minutes: row.downtime_minutes,
      notes: row.notes,
    }] : [],
  };
}

const SORT_MAP = {
  log_number:       'd.log_number',
  log_date:         'd.log_date',
  log_type:         'd.log_type',
  shift:            'd.shift',
  machine_code:     'm.machine_code',
  category:         'd.category',
  technician:       'd.technician',
  downtime_minutes: 'd.downtime_minutes',
  priority: `CASE d.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`,
  status:   `CASE d.status WHEN 'In Progress' THEN 1 WHEN 'Pending Part' THEN 2 WHEN 'Carry Over' THEN 3 WHEN 'Completed' THEN 4 ELSE 5 END`,
};

// ── GET /api/daily-logs ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const {
      log_type, status, priority, category, shift, machine_id,
      search, start_date, end_date,
      sort_by = 'log_date', sort_order = 'desc',
      limit = 20, offset = 0,
    } = req.query;

    const conds = [], params = [];

    if (log_type)   { conds.push('d.log_type = ?');    params.push(log_type); }
    if (status)     { conds.push('d.status = ?');      params.push(status); }
    if (priority)   { conds.push('d.priority = ?');    params.push(priority); }
    if (category)   { conds.push('d.category = ?');    params.push(category); }
    if (shift)      { conds.push('d.shift = ?');       params.push(shift); }
    if (machine_id) { conds.push('d.machine_id = ?');  params.push(machine_id); }
    if (start_date) { conds.push('d.log_date >= ?');   params.push(start_date); }
    if (end_date)   { conds.push('d.log_date <= ?');   params.push(end_date); }
    if (search) {
      conds.push('(d.log_number LIKE ? OR d.description LIKE ? OR m.machine_code LIKE ? OR m.machine_name LIKE ? OR d.technician LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q, q);
    }

    const where   = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const sortCol = SORT_MAP[sort_by] || 'd.log_date';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const rows = db.prepare(`
      SELECT d.*, m.machine_code, m.machine_name, m.location, m.department
      FROM daily_logs d
      LEFT JOIN machines m ON d.machine_id = m.id
      ${where}
      ORDER BY ${sortCol} ${sortDir}, d.id ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const { total } = db.prepare(
      `SELECT COUNT(*) total FROM daily_logs d LEFT JOIN machines m ON d.machine_id = m.id ${where}`
    ).get(...params);

    res.json({ data: rows.map(parseRow), total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/daily-logs/:id ─────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT d.*, m.machine_code, m.machine_name, m.location, m.department
      FROM daily_logs d
      LEFT JOIN machines m ON d.machine_id = m.id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Log not found' });
    res.json(parseRow(row));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/daily-logs — create ───────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const {
      log_date, shift, log_type, machine_id, description, category, priority,
      findings, action_taken, technician, start_time, end_time, status,
      spare_parts_used, notes, reported_by,
    } = req.body;

    if (!log_date || !shift || !log_type || !machine_id || !description || !technician || !reported_by)
      return res.status(400).json({ error: 'log_date, shift, log_type, machine_id, description, technician, reported_by wajib diisi' });

    const logNumber = genLogNumber(log_date);

    let downtime = 0;
    if (log_type === 'Trouble' && start_time && end_time) {
      downtime = Math.max(0, Math.floor((new Date(end_time) - new Date(start_time)) / 60000));
    }

    const result = db.prepare(`
      INSERT INTO daily_logs
        (log_number, log_date, shift, log_type, machine_id, description, category, priority,
         findings, action_taken, technician, start_time, end_time, downtime_minutes, status,
         spare_parts_used, notes, reported_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      logNumber, log_date, shift, log_type, machine_id, description, category || null, priority || 'Medium',
      findings || null, action_taken || null, technician, start_time || null, end_time || null, downtime,
      status || 'Completed', spare_parts_used ? JSON.stringify(spare_parts_used) : null, notes || null, reported_by
    );

    res.status(201).json({ id: result.lastInsertRowid, log_number: logNumber, message: 'Log created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/daily-logs/:id — full update ───────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const {
      log_date, shift, log_type, machine_id, description, category, priority,
      findings, action_taken, technician, start_time, end_time, status,
      spare_parts_used, notes, reported_by,
    } = req.body;

    let downtime = 0;
    if (log_type === 'Trouble' && start_time && end_time) {
      downtime = Math.max(0, Math.floor((new Date(end_time) - new Date(start_time)) / 60000));
    }

    const result = db.prepare(`
      UPDATE daily_logs SET
        log_date=?, shift=?, log_type=?, machine_id=?, description=?, category=?, priority=?,
        findings=?, action_taken=?, technician=?, start_time=?, end_time=?, downtime_minutes=?,
        status=?, spare_parts_used=?, notes=?, reported_by=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      log_date, shift, log_type, machine_id, description, category || null, priority || 'Medium',
      findings || null, action_taken || null, technician, start_time || null, end_time || null, downtime,
      status || 'Completed', spare_parts_used ? JSON.stringify(spare_parts_used) : null, notes || null,
      reported_by, req.params.id
    );

    if (!result.changes) return res.status(404).json({ error: 'Log not found' });
    res.json({ message: 'Log updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/daily-logs/:id — partial update (status umumnya) ────────────
router.patch('/:id', (req, res) => {
  try {
    const allowed = ['status', 'findings', 'action_taken', 'priority', 'description', 'notes'];
    const sets = ['updated_at = CURRENT_TIMESTAMP'], params = [];

    allowed.forEach(f => {
      if (f in req.body) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    });

    if (sets.length === 1) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const result = db.prepare(`UPDATE daily_logs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (!result.changes) return res.status(404).json({ error: 'Log not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/daily-logs/:id ──────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM daily_logs WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Log not found' });
    res.json({ message: 'Log deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
