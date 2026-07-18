require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Initialize database (schema + seed)
require('./db');

// ── Public route ──────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── All other routes are protected ────────────────────────────────────────
app.use('/api', authenticate);

app.use('/api/machines',     require('./routes/machines'));
app.use('/api/daily-logs',   require('./routes/dailyLogs'));
app.use('/api/pm-schedules', require('./routes/pmSchedules'));
app.use('/api/shifts',       require('./routes/shifts'));
app.use('/api/spare-parts',  require('./routes/spareParts'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/reports',      require('./routes/reports'));
// NOTE: routes/problems.js dan routes/repairs.js sudah tidak dipakai — konsep
// "Problem Tracking" digantikan oleh Daily Maintenance Activity Log.

// ── Serve Frontend (production) ─────────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});