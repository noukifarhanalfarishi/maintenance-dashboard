const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all repairs
router.get('/', (req, res) => {
  try {
    const { problem_id, technician, action_type } = req.query;
    let query = `
      SELECT r.*, p.ticket_number, p.description as problem_description,
             m.machine_code, m.machine_name
      FROM repairs r
      LEFT JOIN problems p ON r.problem_id = p.id
      LEFT JOIN machines m ON p.machine_id = m.id
    `;
    const conditions = [];
    const params = [];
    if (problem_id) { conditions.push('r.problem_id = ?'); params.push(problem_id); }
    if (technician) { conditions.push('r.technician LIKE ?'); params.push(`%${technician}%`); }
    if (action_type) { conditions.push('r.action_type = ?'); params.push(action_type); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY r.start_time DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single repair
router.get('/:id', (req, res) => {
  try {
    const repair = db.prepare(`
      SELECT r.*, p.ticket_number, p.description as problem_description, m.machine_code, m.machine_name
      FROM repairs r
      LEFT JOIN problems p ON r.problem_id = p.id
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE r.id = ?
    `).get(req.params.id);
    if (!repair) return res.status(404).json({ error: 'Repair not found' });
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create repair
router.post('/', (req, res) => {
  try {
    const { problem_id, action_type, action_description, technician, start_time, end_time, downtime_minutes, spare_parts_used, notes } = req.body;
    if (!problem_id || !action_type || !action_description || !technician || !start_time) {
      return res.status(400).json({ error: 'problem_id, action_type, action_description, technician, start_time are required' });
    }
    const result = db.prepare(`
      INSERT INTO repairs (problem_id, action_type, action_description, technician, start_time, end_time, downtime_minutes, spare_parts_used, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      problem_id, action_type, action_description, technician, start_time,
      end_time || null, downtime_minutes || null,
      spare_parts_used ? JSON.stringify(spare_parts_used) : null,
      notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Repair created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update repair
router.put('/:id', (req, res) => {
  try {
    const { problem_id, action_type, action_description, technician, start_time, end_time, downtime_minutes, spare_parts_used, notes } = req.body;
    const result = db.prepare(`
      UPDATE repairs SET problem_id=?, action_type=?, action_description=?, technician=?,
        start_time=?, end_time=?, downtime_minutes=?, spare_parts_used=?, notes=?
      WHERE id=?
    `).run(
      problem_id, action_type, action_description, technician, start_time,
      end_time || null, downtime_minutes || null,
      spare_parts_used ? JSON.stringify(spare_parts_used) : null,
      notes || null, req.params.id
    );
    if (!result.changes) return res.status(404).json({ error: 'Repair not found' });
    res.json({ message: 'Repair updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE repair
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM repairs WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Repair not found' });
    res.json({ message: 'Repair deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
