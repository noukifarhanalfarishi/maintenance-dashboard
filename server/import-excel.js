/**
 * One-time import script: Data Problem.xlsx → SQLite
 * Run: node import-excel.js
 */
const xlsx = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'maintenance.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const EXCEL_PATH = 'C:/Users/PC/Documents/Data Problem.xlsx';

const wb = xlsx.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

// Data starts at row index 5 (row 4=header, 5=first data)
const dataRows = rows.slice(5).filter(r => r[4] != null && r[9]);

function excelSerialToISO(serial) {
  // Excel day 1 = 1/1/1900, JS epoch offset = 25569
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function mapCategory(cat) {
  if (!cat) return 'Mechanical';
  const c = cat.toString().trim().toUpperCase();
  if (c === 'E') return 'Electrical';
  if (c === 'M') return 'Mechanical';
  return 'Mechanical';
}

// ── Machine helpers ────────────────────────────────────────────────────────
const machineCache = {};
let machineCodeCounter = 1;

function getOrCreateMachine(machineName, line, dept) {
  const key = machineName.trim().toLowerCase();
  if (machineCache[key]) return machineCache[key];

  const existing = db.prepare('SELECT id FROM machines WHERE LOWER(TRIM(machine_name)) = ?').get(key);
  if (existing) {
    machineCache[key] = existing.id;
    return existing.id;
  }

  // Generate a short unique code
  const safeName = machineName.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-#]/g, '').toUpperCase();
  const code = `IMP-${String(machineCodeCounter++).padStart(3, '0')}-${safeName.slice(0, 10)}`;

  const result = db.prepare(`
    INSERT INTO machines (machine_code, machine_name, machine_type, location, department, line, status)
    VALUES (?, ?, 'General', ?, ?, ?, 'active')
  `).run(code, machineName.trim(), machineName.trim(), dept ? dept.toString().trim() : null, line ? line.toString().trim() : null);

  machineCache[key] = result.lastInsertRowid;
  return result.lastInsertRowid;
}

// ── Ticket generator ───────────────────────────────────────────────────────
const ticketSeq = {};

function genTicket(dateStr) {
  const ds = dateStr.replace(/-/g, '');
  if (ticketSeq[ds] === undefined) {
    const last = db.prepare(
      "SELECT ticket_number FROM problems WHERE ticket_number LIKE ? ORDER BY ticket_number DESC LIMIT 1"
    ).get(`TKT-${ds}-%`);
    ticketSeq[ds] = last ? parseInt(last.ticket_number.split('-')[2]) : 0;
  }
  ticketSeq[ds]++;
  return `TKT-${ds}-${String(ticketSeq[ds]).padStart(3, '0')}`;
}

// ── Prepared statements ────────────────────────────────────────────────────
const insertProblem = db.prepare(`
  INSERT INTO problems
    (ticket_number, machine_id, problem_category, priority, description,
     root_cause, reported_by, reported_at, status, is_repeat, closed_at)
  VALUES (?, ?, ?, 'Medium', ?, ?, ?, ?, 'Closed', ?, ?)
`);

const insertRepair = db.prepare(`
  INSERT INTO repairs
    (problem_id, action_type, action_description, technician,
     start_time, end_time, downtime_minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ── Main import transaction ────────────────────────────────────────────────
let imported = 0, skipped = 0, errors = 0;

const runImport = db.transaction(() => {
  for (const row of dataRows) {
    try {
      const excelSerial = row[5];
      const dept        = row[7];
      const line        = row[8];
      const machine     = row[9];
      const description = row[10];
      const rootCause   = row[11];
      const action      = row[12];
      const category    = row[13];
      const dtMin       = row[14];
      const isRepeat    = row[16];
      const technician  = row[17];

      if (!machine || !description) { skipped++; continue; }

      // Parse date
      let dateStr;
      if (excelSerial && typeof excelSerial === 'number') {
        dateStr = excelSerialToISO(excelSerial);
      } else {
        const dd = row[1], mm = row[2], yy = row[3];
        if (dd && mm && yy) {
          dateStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        } else {
          dateStr = new Date().toISOString().slice(0, 10);
        }
      }

      const reportedAt = `${dateStr} 08:00:00`;
      const repeatVal  = isRepeat ? isRepeat.toString().trim().toUpperCase() : 'R';
      const isRepeatNorm = repeatVal === 'N' ? 'N' : 'R';

      const machineId = getOrCreateMachine(
        machine.toString(),
        line ? line.toString() : null,
        dept ? dept.toString() : null
      );
      const ticket = genTicket(dateStr);

      const problemResult = insertProblem.run(
        ticket,
        machineId,
        mapCategory(category),
        description.toString().trim(),
        rootCause ? rootCause.toString().trim() : null,
        technician ? technician.toString().trim() : 'Import',
        reportedAt,
        isRepeatNorm,
        reportedAt   // closed_at = same as reported (historical data already resolved)
      );

      if (action && action.toString().trim()) {
        const rawDt = parseInt(dtMin);
        const dt = (!isNaN(rawDt) && rawDt >= 0) ? rawDt : null;
        const startMs  = new Date(reportedAt).getTime();
        const endTime  = dt != null
          ? new Date(startMs + dt * 60000).toISOString().slice(0, 19).replace('T', ' ')
          : reportedAt;
        const actionType = mapCategory(category) === 'Electrical' ? 'Electrical Repair' : 'Mechanical Repair';

        insertRepair.run(
          problemResult.lastInsertRowid,
          actionType,
          action.toString().trim(),
          technician ? technician.toString().trim() : 'Import',
          reportedAt,
          endTime,
          dt || null
        );
      }

      imported++;
    } catch (err) {
      console.error(`  ✗ Row No.${row[4]}:`, err.message);
      errors++;
    }
  }
});

console.log(`\nMembaca ${dataRows.length} baris dari Excel...`);
runImport();

const machineCount = db.prepare('SELECT COUNT(*) c FROM machines').get().c;
const problemCount = db.prepare('SELECT COUNT(*) c FROM problems').get().c;
const repairCount  = db.prepare('SELECT COUNT(*) c FROM repairs').get().c;

console.log(`\n✅ Import selesai!`);
console.log(`   ${imported} problem diimport`);
if (skipped) console.log(`   ${skipped} baris dilewati (kosong)`);
if (errors)  console.log(`   ${errors} error`);
console.log(`\nTotal di database:`);
console.log(`   Machines : ${machineCount}`);
console.log(`   Problems : ${problemCount}`);
console.log(`   Repairs  : ${repairCount}`);
