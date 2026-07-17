const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const seedAll = require('./seedData');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'maintenance.db');

// Pastikan folder database ada — pada clone/deploy baru, folder ini belum
// tercipta (isinya di-gitignore) sehingga better-sqlite3 akan gagal buka file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
      line TEXT,
      pm_daily INTEGER DEFAULT 1,
      pm_weekly INTEGER DEFAULT 1,
      pm_monthly INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily Maintenance Activity Log — digitalisasi buku folio harian.
    -- Menggantikan konsep "problems" lama: setiap entri adalah satu pekerjaan
    -- Planning (Preventive Maintenance) ATAU Trouble (Corrective Maintenance).
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_number TEXT UNIQUE NOT NULL,
      log_date DATE NOT NULL,
      shift INTEGER NOT NULL,
      log_type TEXT NOT NULL,
      machine_id INTEGER NOT NULL REFERENCES machines(id),
      description TEXT NOT NULL,
      category TEXT,
      priority TEXT DEFAULT 'Medium',
      findings TEXT,
      action_taken TEXT,
      technician TEXT NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      downtime_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Completed',
      spare_parts_used TEXT,
      notes TEXT,
      reported_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Jadwal Preventive Maintenance per mesin
    CREATE TABLE IF NOT EXISTS pm_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL REFERENCES machines(id),
      pm_type TEXT NOT NULL,
      description TEXT,
      interval_days INTEGER NOT NULL,
      last_done_date DATE,
      next_due_date DATE,
      assigned_to TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Definisi shift kerja
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      shift_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_daily_logs_date       ON daily_logs(log_date);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_machine     ON daily_logs(machine_id);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_type        ON daily_logs(log_type);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_shift       ON daily_logs(shift);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_status      ON daily_logs(status);
    CREATE INDEX IF NOT EXISTS idx_pm_schedules_machine   ON pm_schedules(machine_id);
    CREATE INDEX IF NOT EXISTS idx_pm_schedules_next_due  ON pm_schedules(next_due_date);
  `);
}

// ── Ensure required test accounts always exist with correct passwords ─────
function ensureTestUsers() {
  const testUsers = [
    { username: 'admin',       password: 'admin123',  full_name: 'Administrator System', role: 'Admin',      dept: 'IT'                  },
    { username: 'supervisor', password: 'super123',  full_name: 'Budi Santoso',         role: 'Supervisor', dept: 'Maintenance'          },
    { username: 'teknisi1',   password: 'teknis123', full_name: 'Agus Trianto',         role: 'Technician', dept: 'Element Ring Dept'    },
    { username: 'operator1',  password: 'oper123',   full_name: 'Rina Puspita',         role: 'Operator',   dept: 'Element Ring Dept'    },
    { username: 'teknisi2',   password: 'teknis123', full_name: 'Dedi Kurniawan',       role: 'Technician', dept: 'Element Ring Dept'    },
    { username: 'teknisi3',   password: 'teknis123', full_name: 'Hendra Wijaya',        role: 'Technician', dept: 'Spinning Prep Dept'   },
    { username: 'operator2',  password: 'oper123',   full_name: 'Siti Rahayu',          role: 'Operator',   dept: 'Winding Dept'         },
    { username: 'supervisor2',password: 'super123',  full_name: 'Joko Prasetyo',        role: 'Supervisor', dept: 'Utility Dept'         },
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
  const machineCols = db.prepare('PRAGMA table_info(machines)').all().map(r => r.name);
  if (!machineCols.includes('line'))        db.exec("ALTER TABLE machines ADD COLUMN line TEXT");
  if (!machineCols.includes('pm_daily'))     db.exec("ALTER TABLE machines ADD COLUMN pm_daily INTEGER DEFAULT 1");
  if (!machineCols.includes('pm_weekly'))    db.exec("ALTER TABLE machines ADD COLUMN pm_weekly INTEGER DEFAULT 1");
  if (!machineCols.includes('pm_monthly'))   db.exec("ALTER TABLE machines ADD COLUMN pm_monthly INTEGER DEFAULT 1");

  // Konsep lama "Problem Tracking" (problems/repairs) sudah digantikan oleh
  // daily_logs. Hapus tabelnya kalau masih ada dari instalasi sebelumnya.
  db.exec("DROP TABLE IF EXISTS repairs");
  db.exec("DROP TABLE IF EXISTS problems");
}

initSchema();
migrateSchema();
seedAll(db);
ensureTestUsers();

module.exports = db;
