const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/shifts ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM shifts ORDER BY id').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/shifts/:id — ubah jam mulai/selesai shift ─────────────────
router.put('/:id', (req, res) => {
  try {
    const { shift_name, start_time, end_time } = req.body;
    const result = db.prepare('UPDATE shifts SET shift_name=?, start_time=?, end_time=? WHERE id=?')
      .run(shift_name, start_time, end_time, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Shift not found' });
    res.json({ message: 'Shift updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
