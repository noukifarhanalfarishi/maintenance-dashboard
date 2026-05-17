const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all spare parts
router.get('/', (req, res) => {
  try {
    const { category, low_stock } = req.query;
    let query = 'SELECT * FROM spare_parts';
    const conditions = [];
    const params = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (low_stock === 'true') { conditions.push('stock_quantity <= minimum_stock'); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY part_code';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single spare part
router.get('/:id', (req, res) => {
  try {
    const part = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(req.params.id);
    if (!part) return res.status(404).json({ error: 'Spare part not found' });
    res.json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create spare part
router.post('/', (req, res) => {
  try {
    const { part_code, part_name, category, stock_quantity, minimum_stock, unit, location } = req.body;
    if (!part_code || !part_name) return res.status(400).json({ error: 'part_code and part_name are required' });
    const result = db.prepare(`
      INSERT INTO spare_parts (part_code, part_name, category, stock_quantity, minimum_stock, unit, location)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(part_code, part_name, category || null, stock_quantity || 0, minimum_stock || 0, unit || null, location || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Spare part created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Part code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update spare part
router.put('/:id', (req, res) => {
  try {
    const { part_code, part_name, category, stock_quantity, minimum_stock, unit, location } = req.body;
    const result = db.prepare(`
      UPDATE spare_parts SET part_code=?, part_name=?, category=?, stock_quantity=?, minimum_stock=?, unit=?, location=?
      WHERE id=?
    `).run(part_code, part_name, category, stock_quantity, minimum_stock, unit, location, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Spare part not found' });
    res.json({ message: 'Spare part updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH adjust stock
router.patch('/:id/stock', (req, res) => {
  try {
    const { adjustment } = req.body;
    const part = db.prepare('SELECT stock_quantity FROM spare_parts WHERE id = ?').get(req.params.id);
    if (!part) return res.status(404).json({ error: 'Spare part not found' });
    const newQty = part.stock_quantity + parseInt(adjustment);
    if (newQty < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
    db.prepare('UPDATE spare_parts SET stock_quantity = ? WHERE id = ?').run(newQty, req.params.id);
    res.json({ message: 'Stock updated', new_quantity: newQty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE spare part
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM spare_parts WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Spare part not found' });
    res.json({ message: 'Spare part deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
