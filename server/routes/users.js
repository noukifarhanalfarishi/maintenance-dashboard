const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// GET all users (no password)
router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT id, username, full_name, role, department, is_active FROM users ORDER BY full_name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single user
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, full_name, role, department, is_active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create user
router.post('/', (req, res) => {
  try {
    const { username, password, full_name, role, department } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'username, password, full_name, role are required' });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, department)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password_hash, full_name, role, department || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'User created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update user
router.put('/:id', (req, res) => {
  try {
    const { username, full_name, role, department, is_active } = req.body;
    const result = db.prepare(`
      UPDATE users SET username=?, full_name=?, role=?, department=?, is_active=?
      WHERE id=?
    `).run(username, full_name, role, department, is_active, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { password_hash, ...userData } = user;
    res.json({ message: 'Login successful', user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
