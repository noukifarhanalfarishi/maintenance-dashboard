const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'maintenance.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_code TEXT UNIQUE NOT NULL,
      machine_name TEXT NOT NULL,
      machine_type TEXT,
      location TEXT,
      department TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      machine_id INTEGER REFERENCES machines(id),
      problem_category TEXT NOT NULL,
      priority TEXT NOT NULL,
      description TEXT NOT NULL,
      root_cause TEXT,
      reported_by TEXT NOT NULL,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Open',
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER REFERENCES problems(id),
      action_type TEXT NOT NULL,
      action_description TEXT NOT NULL,
      technician TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      downtime_minutes INTEGER,
      spare_parts_used TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      category TEXT,
      stock_quantity INTEGER DEFAULT 0,
      minimum_stock INTEGER DEFAULT 0,
      unit TEXT,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);
}

function seedData() {
  // Data dummy dihapus — silakan input data Anda sendiri melalui aplikasi
}

// ── Ensure required test accounts always exist with correct passwords ─────
function ensureTestUsers() {
  const testUsers = [
    { username: 'admin',      password: 'admin123',  full_name: 'Administrator System', role: 'Admin',      dept: 'IT'                 },
    { username: 'supervisor', password: 'super123',  full_name: 'Budi Santoso',         role: 'Supervisor', dept: 'Maintenance'         },
    { username: 'teknisi1',   password: 'teknis123', full_name: 'Agus Trianto',         role: 'Technician', dept: 'Element Ring Dept'   },
    { username: 'operator1',  password: 'oper123',   full_name: 'Rina Puspita',         role: 'Operator',   dept: 'Element Ring Dept'   },
  ];

  const upsert = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, department, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      full_name     = excluded.full_name,
      role          = excluded.role,
      department    = excluded.department
  `);

  const tx = db.transaction(() => {
    testUsers.forEach(u => {
      const hash = bcrypt.hashSync(u.password, 10);
      upsert.run(u.username, hash, u.full_name, u.role, u.dept);
    });
  });
  tx();
}

function migrateSchema() {
  const machineCols = db.prepare('PRAGMA table_info(machines)').all().map(r => r.name)
  if (!machineCols.includes('line')) {
    db.exec("ALTER TABLE machines ADD COLUMN line TEXT")
  }
  const problemCols = db.prepare('PRAGMA table_info(problems)').all().map(r => r.name)
  if (!problemCols.includes('is_repeat')) {
    db.exec("ALTER TABLE problems ADD COLUMN is_repeat TEXT DEFAULT 'R'")
  }
}

initSchema();
migrateSchema();
seedData();
ensureTestUsers();

module.exports = db;
