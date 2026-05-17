const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET  = process.env.JWT_SECRET  || 'maint-dashboard-dev-secret-2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Username atau password salah' });

  const payload = { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  const { password_hash, ...safe } = user;
  res.json({ token, user: safe, expiresIn: JWT_EXPIRES });
});

// GET /api/auth/me — verify token & return user
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = db.prepare(
      'SELECT id, username, full_name, role, department, is_active FROM users WHERE id = ?'
    ).get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
});

// POST /api/auth/logout — client just discards token, but we acknowledge
router.post('/logout', (_req, res) => res.json({ message: 'Logged out' }));

module.exports = router;
