const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Ticket number generator ────────────────────────────────────────────────
function genTicket(dateStr) {
  const ds = dateStr
    ? dateStr.slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = db.prepare(
    "SELECT ticket_number FROM problems WHERE ticket_number LIKE ? ORDER BY ticket_number DESC LIMIT 1"
  ).get(`TKT-${ds}-%`);
  const seq = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
  return `TKT-${ds}-${String(seq).padStart(3, '0')}`;
}

// Safe sort column map
const SORT_MAP = {
  ticket_number:    'p.ticket_number',
  machine_code:     'm.machine_code',
  problem_category: 'p.problem_category',
  reported_by:      'p.reported_by',
  reported_at:      'p.reported_at',
  total_downtime:   'total_downtime',
  priority: `CASE p.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`,
  status:   `CASE p.status  WHEN 'Open' THEN 1 WHEN 'In Progress' THEN 2 WHEN 'Pending Part' THEN 3 WHEN 'Closed' THEN 4 ELSE 5 END`,
  is_repeat: 'p.is_repeat',
};

// ── GET /api/problems ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const {
      status, priority, category, machine_id, is_repeat,
      search, start_date, end_date,
      sort_by = 'reported_at', sort_order = 'desc',
      limit = 20, offset = 0,
    } = req.query;

    const conds = [], params = [];

    if (status)     { conds.push('p.status = ?');               params.push(status); }
    if (priority)   { conds.push('p.priority = ?');             params.push(priority); }
    if (category)   { conds.push('p.problem_category = ?');     params.push(category); }
    if (machine_id) { conds.push('p.machine_id = ?');           params.push(machine_id); }
    if (is_repeat)  { conds.push('p.is_repeat = ?');            params.push(is_repeat); }
    if (start_date) { conds.push("date(p.reported_at) >= ?");   params.push(start_date); }
    if (end_date)   { conds.push("date(p.reported_at) <= ?");   params.push(end_date); }
    if (search) {
      conds.push('(p.ticket_number LIKE ? OR p.description LIKE ? OR m.machine_code LIKE ? OR m.machine_name LIKE ? OR p.reported_by LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q, q);
    }

    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const sortCol = SORT_MAP[sort_by] || 'p.reported_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const rows = db.prepare(`
      SELECT
        p.*,
        m.machine_code, m.machine_name, m.location, m.department,
        COALESCE((SELECT SUM(r.downtime_minutes) FROM repairs r WHERE r.problem_id = p.id), 0) AS total_downtime,
        (SELECT COUNT(*) FROM repairs r WHERE r.problem_id = p.id) AS repair_count
      FROM problems p
      LEFT JOIN machines m ON p.machine_id = m.id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const { total } = db.prepare(
      `SELECT COUNT(*) total FROM problems p LEFT JOIN machines m ON p.machine_id = m.id ${where}`
    ).get(...params);

    res.json({ data: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/problems/:id — detail + repairs ───────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const problem = db.prepare(`
      SELECT p.*, m.machine_code, m.machine_name, m.location, m.department
      FROM problems p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const repairs = db.prepare(
      'SELECT * FROM repairs WHERE problem_id = ? ORDER BY start_time ASC'
    ).all(req.params.id);

    // Attach parsed spare_parts_used array
    const repairsFormatted = repairs.map(r => ({
      ...r,
      spare_parts_used: r.spare_parts_used ? JSON.parse(r.spare_parts_used) : [],
    }));

    res.json({ ...problem, repairs: repairsFormatted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/problems — create ────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { machine_id, problem_category, priority, description, root_cause, reported_by, status, is_repeat, reported_at } = req.body;
    if (!problem_category || !description || !reported_by)
      return res.status(400).json({ error: 'problem_category, description, reported_by wajib diisi' });

    const ticket_number = genTicket(reported_at);
    const result = db.prepare(`
      INSERT INTO problems (ticket_number, machine_id, problem_category, priority, description, root_cause, reported_by, reported_at, status, is_repeat)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
    `).run(ticket_number, machine_id || null, problem_category, priority || 'Medium', description,
           root_cause || null, reported_by, reported_at || null, status || 'Open', is_repeat || 'R');

    res.status(201).json({ id: result.lastInsertRowid, ticket_number, message: 'Problem created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/problems/:id — full update ───────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { machine_id, problem_category, priority, description, root_cause, reported_by, status, is_repeat, reported_at } = req.body;
    const closed_at = status === 'Closed' ? new Date().toISOString() : null;
    const result = db.prepare(`
      UPDATE problems
      SET machine_id=?, problem_category=?, priority=?, description=?,
          root_cause=?, reported_by=?, status=?, is_repeat=?,
          reported_at = COALESCE(?, reported_at),
          closed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE closed_at END
      WHERE id=?
    `).run(machine_id, problem_category, priority || 'Medium', description,
           root_cause, reported_by, status, is_repeat || 'R',
           reported_at || null, closed_at, closed_at, req.params.id);

    if (!result.changes) return res.status(404).json({ error: 'Problem not found' });
    res.json({ message: 'Problem updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/problems/:id — partial update (status / root_cause) ─────────
router.patch('/:id', (req, res) => {
  try {
    const allowed = ['status', 'root_cause', 'priority', 'description', 'is_repeat'];
    const sets = [], params = [];

    allowed.forEach(f => {
      if (f in req.body) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    });

    // Auto-set closed_at when marking Closed
    if (req.body.status === 'Closed') {
      sets.push('closed_at = CURRENT_TIMESTAMP');
    }
    // Clear closed_at when re-opening
    if (req.body.status && req.body.status !== 'Closed') {
      sets.push('closed_at = NULL');
    }

    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const result = db.prepare(`UPDATE problems SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (!result.changes) return res.status(404).json({ error: 'Problem not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/problems/:id ───────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM repairs WHERE problem_id = ?').run(req.params.id);
    const result = db.prepare('DELETE FROM problems WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Problem not found' });
    res.json({ message: 'Problem deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/problems/:id/repairs — add repair action ────────────────────
router.post('/:id/repairs', (req, res) => {
  try {
    const problem = db.prepare('SELECT id FROM problems WHERE id = ?').get(req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const {
      action_type, action_description, technician, start_time,
      end_time, downtime_minutes, spare_parts_used, notes, update_status,
    } = req.body;

    if (!action_type || !action_description || !technician || !start_time)
      return res.status(400).json({ error: 'action_type, action_description, technician, start_time wajib diisi' });

    // Auto-calc downtime if both times provided and not explicitly set
    let dt = downtime_minutes || null;
    if (!dt && start_time && end_time) {
      dt = Math.max(0, Math.floor((new Date(end_time) - new Date(start_time)) / 60000));
    }

    const result = db.prepare(`
      INSERT INTO repairs (problem_id, action_type, action_description, technician,
                           start_time, end_time, downtime_minutes, spare_parts_used, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, action_type, action_description, technician,
      start_time, end_time || null, dt,
      spare_parts_used ? JSON.stringify(spare_parts_used) : null,
      notes || null
    );

    // Optional: auto-update problem status
    if (update_status) {
      const closed_at = update_status === 'Closed' ? new Date().toISOString() : null;
      db.prepare(`UPDATE problems SET status=?, closed_at=CASE WHEN ? IS NOT NULL THEN ? ELSE closed_at END WHERE id=?`)
        .run(update_status, closed_at, closed_at, req.params.id);
    }

    res.status(201).json({ id: result.lastInsertRowid, message: 'Repair added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
