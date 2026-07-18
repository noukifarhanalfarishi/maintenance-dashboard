/**
 * Seed data untuk Daily Maintenance Activity Log.
 * Semua fungsi di sini idempotent: kalau tabel targetnya sudah ada isinya,
 * seed TIDAK dijalankan lagi (supaya server aman di-restart berkali-kali
 * tanpa menduplikasi / menimpa data yang sudah diinput user).
 */

// ── Master data ─────────────────────────────────────────────────────────────

const MACHINES = [
  { code: 'RF-01', name: 'Ring Frame 1',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'A', hot: true  },
  { code: 'RF-02', name: 'Ring Frame 2',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'A', hot: false },
  { code: 'RF-03', name: 'Ring Frame 3',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'A', hot: true  },
  { code: 'RF-04', name: 'Ring Frame 4',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'B', hot: false },
  { code: 'RF-05', name: 'Ring Frame 5',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'B', hot: false },
  { code: 'RF-06', name: 'Ring Frame 6',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'B', hot: true  },
  { code: 'RF-07', name: 'Ring Frame 7',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'C', hot: false },
  { code: 'RF-08', name: 'Ring Frame 8',            type: 'Ring Frame',  dept: 'Element Ring Dept',   line: 'C', hot: false },
  { code: 'SF-01', name: 'Simplex Speed Frame 1',   type: 'Simplex',     dept: 'Spinning Prep Dept',  line: 'A', hot: false },
  { code: 'SF-02', name: 'Simplex Speed Frame 2',   type: 'Simplex',     dept: 'Spinning Prep Dept',  line: 'B', hot: false },
  { code: 'DF-01', name: 'Draw Frame 1',            type: 'Draw Frame',  dept: 'Spinning Prep Dept',  line: 'A', hot: false },
  { code: 'DF-02', name: 'Draw Frame 2',            type: 'Draw Frame',  dept: 'Spinning Prep Dept',  line: 'B', hot: false },
  { code: 'CD-01', name: 'Carding Machine 1',        type: 'Carding',     dept: 'Blowroom & Carding',  line: 'A', hot: true  },
  { code: 'AC-01', name: 'Autoconer Winding 1',      type: 'Autoconer',   dept: 'Winding Dept',        line: 'A', hot: false },
  { code: 'UT-01', name: 'Air Compressor Utility 1', type: 'Compressor', dept: 'Utility Dept',         line: null, hot: true  },
];

// PD2 BELT terbagi menjadi 2 departemen: Element Ring (di atas, RF-01..08)
// dan Belt Assy (di bawah). Mesin-mesin ini ditambahkan lewat migrasi
// idempotent (lihat seedBeltAssyMachines) supaya database yang sudah berisi
// data tetap mendapat mesin Belt Assy tanpa menghapus/mengubah data lain.
const BELT_ASSY_MACHINES = [
  { code: 'BA-01', name: 'Conveyor Belt Line 1',     type: 'Conveyor',         dept: 'Belt Assy Dept', line: 'D', hot: false },
  { code: 'BA-02', name: 'Conveyor Belt Line 2',     type: 'Conveyor',         dept: 'Belt Assy Dept', line: 'D', hot: true  },
  { code: 'BA-03', name: 'Belt Assembly Robot 1',    type: 'Robot',            dept: 'Belt Assy Dept', line: 'D', hot: true  },
  { code: 'BA-04', name: 'Belt Assembly Robot 2',    type: 'Robot',            dept: 'Belt Assy Dept', line: 'D', hot: false },
  { code: 'BA-05', name: 'Hydraulic Press 1',        type: 'Hydraulic Press',  dept: 'Belt Assy Dept', line: 'E', hot: true  },
  { code: 'BA-06', name: 'Washing Machine 1',        type: 'Washing Machine',  dept: 'Belt Assy Dept', line: 'E', hot: false },
  { code: 'BA-07', name: 'Cooling Tower 1',          type: 'Cooling Tower',    dept: 'Belt Assy Dept', line: 'E', hot: false },
  { code: 'BA-08', name: 'Belt Assembly Machine 1',  type: 'Assembly Machine', dept: 'Belt Assy Dept', line: 'E', hot: false },
];

const SPARE_PARTS = [
  { code: 'SP-001', name: 'Spindle Tape',              category: 'Mechanical', stock: 150, min: 50, unit: 'pcs',  location: 'Gudang Sparepart A' },
  { code: 'SP-002', name: 'Ring Traveler',              category: 'Mechanical', stock: 500, min: 100, unit: 'pcs', location: 'Gudang Sparepart A' },
  { code: 'SP-003', name: 'Cot (Roll Karet)',           category: 'Mechanical', stock: 80,  min: 30, unit: 'pcs',  location: 'Gudang Sparepart A' },
  { code: 'SP-004', name: 'Apron Bottom',               category: 'Mechanical', stock: 60,  min: 20, unit: 'pcs',  location: 'Gudang Sparepart A' },
  { code: 'SP-005', name: 'Bearing 6202ZZ',             category: 'Mechanical', stock: 40,  min: 15, unit: 'pcs',  location: 'Gudang Sparepart B' },
  { code: 'SP-006', name: 'Bearing 6204ZZ',             category: 'Mechanical', stock: 35,  min: 15, unit: 'pcs',  location: 'Gudang Sparepart B' },
  { code: 'SP-007', name: 'V-Belt A47',                 category: 'Mechanical', stock: 25,  min: 10, unit: 'pcs',  location: 'Gudang Sparepart B' },
  { code: 'SP-008', name: 'Timing Belt',                category: 'Mechanical', stock: 20,  min: 8,  unit: 'pcs',  location: 'Gudang Sparepart B' },
  { code: 'SP-009', name: 'Motor Servo 1.5kW',          category: 'Electrical', stock: 5,   min: 2,  unit: 'unit', location: 'Gudang Sparepart C' },
  { code: 'SP-010', name: 'Inverter / VFD 2.2kW',       category: 'Electrical', stock: 4,   min: 2,  unit: 'unit', location: 'Gudang Sparepart C' },
  { code: 'SP-011', name: 'Contactor Magnetic 220V',    category: 'Electrical', stock: 15,  min: 5,  unit: 'pcs',  location: 'Gudang Sparepart C' },
  { code: 'SP-012', name: 'Proximity Sensor',           category: 'Electrical', stock: 20,  min: 8,  unit: 'pcs',  location: 'Gudang Sparepart C' },
  { code: 'SP-013', name: 'Fuse 10A',                   category: 'Electrical', stock: 100, min: 30, unit: 'pcs',  location: 'Gudang Sparepart C' },
  { code: 'SP-014', name: 'Selang Pneumatic 8mm',       category: 'Pneumatic',  stock: 50,  min: 20, unit: 'meter',location: 'Gudang Sparepart D' },
  { code: 'SP-015', name: 'Solenoid Valve',             category: 'Pneumatic',  stock: 10,  min: 4,  unit: 'pcs',  location: 'Gudang Sparepart D' },
  { code: 'SP-016', name: 'Air Filter Regulator',       category: 'Pneumatic',  stock: 8,   min: 3,  unit: 'unit', location: 'Gudang Sparepart D' },
  { code: 'SP-017', name: 'Oli Hidrolik ISO 46',        category: 'Hydraulic',  stock: 40,  min: 10, unit: 'liter',location: 'Gudang Sparepart D' },
  { code: 'SP-018', name: 'Seal Hidrolik Set',          category: 'Hydraulic',  stock: 12,  min: 5,  unit: 'set',  location: 'Gudang Sparepart D' },
  { code: 'SP-019', name: 'Grease Lithium',             category: 'General',   stock: 30,  min: 10, unit: 'kg',   location: 'Gudang Sparepart A' },
  { code: 'SP-020', name: 'Filter Compressor',          category: 'Pneumatic',  stock: 6,   min: 2,  unit: 'pcs',  location: 'Gudang Sparepart D' },
];

const SHIFTS = [
  { id: 1, name: 'Shift 1', start: '06:00', end: '14:00' },
  { id: 2, name: 'Shift 2', start: '14:00', end: '22:00' },
  { id: 3, name: 'Shift 3', start: '22:00', end: '06:00' },
];

const TECHNICIANS = ['Agus Trianto', 'Dedi Kurniawan', 'Hendra Wijaya'];
const REPORTERS   = ['Budi Santoso', 'Joko Prasetyo', 'Agus Trianto', 'Rina Puspita', 'Siti Rahayu'];

const PARTS_BY_CATEGORY = {
  Mechanical: SPARE_PARTS.filter(p => p.category === 'Mechanical').map(p => p.code),
  Electrical: SPARE_PARTS.filter(p => p.category === 'Electrical').map(p => p.code),
  Pneumatic:  SPARE_PARTS.filter(p => p.category === 'Pneumatic').map(p => p.code),
  Hydraulic:  SPARE_PARTS.filter(p => p.category === 'Hydraulic').map(p => p.code),
  Software:   [],
  Other:      ['SP-019'],
};

const FINDINGS_PLANNING = [
  'Tidak ditemukan abnormality, kondisi mesin normal.',
  'Kondisi baik, sudah dilakukan pelumasan rutin.',
  'Ditemukan sedikit keausan pada belt, masih dalam toleransi.',
  'Traveler ring mulai aus, direkomendasikan penggantian pada PM berikutnya.',
  'Baut mounting motor sedikit kendor, sudah dikencangkan kembali.',
  'Level oli gearbox sedikit berkurang, sudah ditambahkan sesuai standar.',
  'Ditemukan getaran ringan pada spindle, perlu dipantau PM berikutnya.',
  'Semua parameter dalam batas normal sesuai checklist.',
];

const ACTIONS_PLANNING = [
  'Pembersihan area mesin dan pelumasan bagian bergerak.',
  'Pengecekan visual, pengencangan baut, dan pelumasan.',
  'Kalibrasi ulang sensor dan pembersihan filter udara.',
  'Penggantian oli/grease sesuai jadwal PM.',
  'Pemeriksaan menyeluruh sesuai checklist PM.',
  'Pengecekan kelurusan (alignment) dan kekencangan belt.',
];

const TROUBLE_TEMPLATES = {
  Mechanical: [
    { symptom: 'motor spindle overheat dan mesin berhenti mendadak', finding: 'Bearing motor spindle aus akibat pelumasan kurang.', action: 'Ganti bearing baru dan lakukan running test.' },
    { symptom: 'suara berisik tidak normal pada bagian drafting',     finding: 'Cot (roll karet) sudah aus dan retak.',            action: 'Ganti cot dan sesuaikan tekanan roll.' },
    { symptom: 'traveler sering putus saat produksi',                 finding: 'Traveler ring tidak sesuai spesifikasi benang.',   action: 'Ganti traveler dengan ukuran yang sesuai.' },
    { symptom: 'belt penggerak putus',                                 finding: 'V-belt getas akibat usia pakai lebih dari standar.', action: 'Ganti V-belt baru dan cek alignment pulley.' },
  ],
  Electrical: [
    { symptom: 'panel listrik trip berulang',                          finding: 'Kontaktor utama macet akibat debu kapas menumpuk.', action: 'Bersihkan kontaktor dan kencangkan terminal.' },
    { symptom: 'motor tidak mau start',                                 finding: 'Fuse pengaman putus akibat lonjakan arus.',        action: 'Ganti fuse dan cek beban motor.' },
    { symptom: 'inverter menampilkan kode error',                       finding: 'Inverter/VFD overheat karena ventilasi tersumbat debu.', action: 'Bersihkan ventilasi inverter dan reset parameter.' },
    { symptom: 'sensor proximity tidak terbaca PLC',                    finding: 'Sensor proximity kotor dan posisi bergeser.',      action: 'Bersihkan dan kalibrasi ulang posisi sensor.' },
  ],
  Pneumatic: [
    { symptom: 'tekanan angin drop saat operasi',                       finding: 'Selang pneumatic bocor pada sambungan fitting.',   action: 'Ganti selang dan rapatkan sambungan.' },
    { symptom: 'silinder pneumatic bergerak tidak sempurna',            finding: 'Solenoid valve macet akibat kotoran oli.',         action: 'Bersihkan/ganti solenoid valve.' },
    { symptom: 'suara desis angin bocor terus menerus',                  finding: 'Air filter regulator rusak/aus.',                  action: 'Ganti air filter regulator.' },
  ],
  Hydraulic: [
    { symptom: 'tekanan hidrolik tidak stabil',                          finding: 'Seal hidrolik bocor sehingga tekanan turun.',      action: 'Ganti seal set dan isi ulang oli hidrolik.' },
    { symptom: 'oli hidrolik rembes di lantai',                          finding: 'Selang/sambungan hidrolik retak.',                 action: 'Ganti selang dan bersihkan tumpahan oli.' },
  ],
  Software: [
    { symptom: 'HMI freeze / tidak merespon',                            finding: 'PLC error communication timeout.',                 action: 'Restart controller dan cek koneksi komunikasi.' },
    { symptom: 'parameter produksi kembali ke default',                  finding: 'Program PLC corrupt akibat mati listrik mendadak.',action: 'Upload ulang program PLC dari backup.' },
  ],
  Other: [
    { symptom: 'mesin berhenti tanpa indikasi jelas',                    finding: 'Penyebab belum teridentifikasi, perlu observasi lanjutan.', action: 'Reset mesin dan monitoring ketat shift berikutnya.' },
  ],
};

const NOTES_POOL = [
  'Perlu monitoring lanjutan pada shift berikutnya.',
  'Part sudah dipesan, estimasi datang 2-3 hari.',
  'Sudah dikoordinasikan dengan supervisor produksi.',
  'Direkomendasikan masuk agenda PM bulan depan.',
  null, null, null, // sebagian besar log tidak ada catatan tambahan
];

// ── Helpers ──────────────────────────────────────────────────────────────

function weightedPick(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [val, w] of pairs) {
    if (r < w) return val;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ── Seeders ──────────────────────────────────────────────────────────────

function seedMachines(db) {
  const { count } = db.prepare('SELECT COUNT(*) count FROM machines').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO machines (machine_code, machine_name, machine_type, location, department, status, line, pm_daily, pm_weekly, pm_monthly)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    MACHINES.forEach(m => {
      const location = m.line ? `Line ${m.line}` : m.dept;
      insert.run(m.code, m.name, m.type, location, m.dept, m.line, 1, m.type === 'Compressor' ? 0 : 1, 1);
    });
  });
  tx();
}

function seedSpareParts(db) {
  const { count } = db.prepare('SELECT COUNT(*) count FROM spare_parts').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO spare_parts (part_code, part_name, category, stock_quantity, minimum_stock, unit, location)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    SPARE_PARTS.forEach(p => insert.run(p.code, p.name, p.category, p.stock, p.min, p.unit, p.location));
  });
  tx();
}

function seedShifts(db) {
  const { count } = db.prepare('SELECT COUNT(*) count FROM shifts').get();
  if (count > 0) return;

  const insert = db.prepare(`INSERT INTO shifts (id, shift_name, start_time, end_time) VALUES (?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    SHIFTS.forEach(s => insert.run(s.id, s.name, s.start, s.end));
  });
  tx();
}

function seedPmSchedules(db) {
  const { count } = db.prepare('SELECT COUNT(*) count FROM pm_schedules').get();
  if (count > 0) return;

  const machines = db.prepare('SELECT id, machine_code, pm_daily, pm_weekly, pm_monthly FROM machines').all();
  const insert = db.prepare(`
    INSERT INTO pm_schedules (machine_id, pm_type, description, interval_days, last_done_date, next_due_date, assigned_to, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function addSchedule(machine, pmType, intervalDays, description) {
    const lastDone = new Date(today);
    lastDone.setDate(lastDone.getDate() - randInt(0, intervalDays));
    const nextDue = new Date(lastDone);
    nextDue.setDate(nextDue.getDate() + intervalDays);
    insert.run(
      machine.id, pmType, description, intervalDays,
      fmtDate(lastDone), fmtDate(nextDue), pickRandom(TECHNICIANS)
    );
  }

  const tx = db.transaction(() => {
    machines.forEach((m, idx) => {
      if (m.pm_daily)   addSchedule(m, 'Daily Check',  1,   'Pengecekan harian kondisi mesin sesuai checklist standar.');
      if (m.pm_weekly)  addSchedule(m, 'Weekly PM',    7,   'Pemeriksaan mingguan, pelumasan, dan pengencangan baut.');
      if (m.pm_monthly) addSchedule(m, 'Monthly PM',   30,  'Pemeriksaan bulanan menyeluruh dan penggantian consumable.');

      // Variasi tambahan supaya jadwal PM lebih realistis
      if (idx % 3 === 0) addSchedule(m, '3-Monthly PM', 90,  'Overhaul ringan tiap 3 bulan (bearing, belt, kalibrasi).');
      if (idx % 5 === 0) addSchedule(m, '6-Monthly PM', 180, 'Pemeriksaan besar 6 bulanan (motor, panel listrik).');
      if (idx === 0)      addSchedule(m, 'Yearly PM',    365, 'Overhaul tahunan menyeluruh.');
    });
  });
  tx();
}

function genLogDescription(machine, logType, category) {
  if (logType === 'Planning') {
    return `${category} rutin pada ${machine.machine_name} sesuai jadwal preventive maintenance.`;
  }
  return `${machine.machine_name} mengalami trouble ${category.toLowerCase()}.`;
}

// ── Generate ~totalDays histori daily_logs untuk sekumpulan mesin. Dipakai
// baik oleh seed awal (semua mesin, tabel kosong) maupun top-up Belt Assy
// (mesin baru saja, tabel sudah berisi data mesin lain). Nomor log dihitung
// dinamis dari MAX log_number per tanggal supaya tidak bentrok dengan log
// yang sudah ada di tanggal yang sama (constraint UNIQUE pada log_number).
function generateLogsForMachines(db, machines, totalDays) {
  const machineWeights = machines.map(m => [m, m.hot ? 3 : 1]);

  const insert = db.prepare(`
    INSERT INTO daily_logs
      (log_number, log_date, shift, log_type, machine_id, description, category, priority,
       findings, action_taken, technician, start_time, end_time, downtime_minutes, status,
       spare_parts_used, notes, reported_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const lastLogNumFor = db.prepare("SELECT log_number FROM daily_logs WHERE log_number LIKE ? ORDER BY log_number DESC LIMIT 1");

  const shiftStartHour = { 1: 6, 2: 14, 3: 22 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tx = db.transaction(() => {
    for (let dayOffset = totalDays; dayOffset >= 0; dayOffset--) {
      const day = new Date(today);
      day.setDate(day.getDate() - dayOffset);
      const dateStr = fmtDate(day);
      const isRecent = dayOffset <= 14;
      const ds = dateStr.replace(/-/g, '');

      const lastLog = lastLogNumFor.get(`LOG-${ds}-%`);
      let seq = lastLog ? parseInt(lastLog.log_number.split('-')[2]) + 1 : 1;

      const numLogsToday = randInt(1, 3);
      for (let i = 0; i < numLogsToday; i++, seq++) {
        const logNumber = `LOG-${ds}-${String(seq).padStart(3, '0')}`;
        const logType = Math.random() < 0.6 ? 'Planning' : 'Trouble';
        const shift = weightedPick([[1, 50], [2, 30], [3, 20]]);
        const machine = weightedPick(machineWeights);
        const technician = pickRandom(TECHNICIANS);
        const reportedBy = pickRandom(REPORTERS);

        // Waktu mulai: jam awal shift + offset acak, lalu hitung selesai dari durasi.
        const startHour = shiftStartHour[shift];
        const start = new Date(`${dateStr}T00:00:00`);
        start.setHours(startHour + randInt(0, 4), randInt(0, 59), 0, 0);

        let category, priority, findings, actionTaken, description, downtime, status, sparePartsUsed, notes;

        if (logType === 'Planning') {
          category = weightedPick([
            ['Daily Check', 50], ['Weekly PM', 25], ['Monthly PM', 15],
            ['3-Monthly PM', 5], ['6-Monthly PM', 3], ['Yearly PM', 1], ['Overhaul', 1],
          ]);
          priority = 'Medium';
          findings = pickRandom(FINDINGS_PLANNING);
          actionTaken = pickRandom(ACTIONS_PLANNING);
          description = genLogDescription(machine, logType, category);
          downtime = 0;
          status = isRecent && Math.random() < 0.08 ? 'Carry Over' : 'Completed';

          const duration = randInt(20, 120);
          const end = new Date(start.getTime() + duration * 60000);

          sparePartsUsed = Math.random() < 0.2 ? JSON.stringify(['SP-019']) : null;
          notes = pickRandom(NOTES_POOL);

          insert.run(
            logNumber, dateStr, shift, logType, machine.id, description, category, priority,
            findings, actionTaken, technician, fmtDateTime(start), fmtDateTime(end), downtime, status,
            sparePartsUsed, notes, reportedBy, fmtDateTime(start), fmtDateTime(start)
          );
        } else {
          category = weightedPick([
            ['Mechanical', 45], ['Electrical', 25], ['Pneumatic', 15],
            ['Hydraulic', 10], ['Software', 3], ['Other', 2],
          ]);
          priority = weightedPick([['Critical', 5], ['High', 25], ['Medium', 50], ['Low', 20]]);
          const tmpl = pickRandom(TROUBLE_TEMPLATES[category]);
          findings = tmpl.finding;
          actionTaken = tmpl.action;
          description = `${machine.machine_name} mengalami trouble ${category.toLowerCase()} - ${tmpl.symptom}.`;

          // Downtime 15-480 menit, condong ke nilai lebih rendah.
          downtime = Math.min(480, 15 + Math.floor(Math.pow(Math.random(), 2) * 465));

          status = isRecent
            ? weightedPick([['Completed', 75], ['Carry Over', 10], ['Pending Part', 10], ['In Progress', 5]])
            : 'Completed';

          const end = new Date(start.getTime() + downtime * 60000);

          const catParts = PARTS_BY_CATEGORY[category] || [];
          sparePartsUsed = (catParts.length && Math.random() < 0.45)
            ? JSON.stringify(pickRandom([[catParts[0]], catParts.slice(0, 2)]))
            : null;
          notes = pickRandom(NOTES_POOL);

          insert.run(
            logNumber, dateStr, shift, logType, machine.id, description, category, priority,
            findings, actionTaken, technician, fmtDateTime(start), fmtDateTime(end), downtime, status,
            sparePartsUsed, notes, reportedBy, fmtDateTime(start), fmtDateTime(start)
          );
        }
      }
    }
  });
  tx();
}

function seedDailyLogs(db) {
  const { count } = db.prepare('SELECT COUNT(*) count FROM daily_logs').get();
  if (count > 0) return;

  const machines = db.prepare('SELECT id, machine_code, machine_name FROM machines').all()
    .map(m => ({ ...m, hot: MACHINES.find(x => x.code === m.machine_code)?.hot || false }));
  generateLogsForMachines(db, machines, 92);
}

// ── Migrasi idempotent: tambah mesin Belt Assy + jadwal PM + histori log,
// tanpa menyentuh data yang sudah ada (aman dijalankan di database yang
// sudah berisi data maupun database baru).
function seedBeltAssyMachines(db) {
  const insert = db.prepare(`
    INSERT INTO machines (machine_code, machine_name, machine_type, location, department, status, line, pm_daily, pm_weekly, pm_monthly)
    VALUES (?, ?, ?, ?, ?, 'active', ?, 1, 1, 1)
  `);
  const exists = db.prepare('SELECT 1 FROM machines WHERE machine_code = ?');
  const tx = db.transaction(() => {
    BELT_ASSY_MACHINES.forEach(m => {
      if (exists.get(m.code)) return;
      insert.run(m.code, m.name, m.type, `Line ${m.line}`, m.dept, m.line);
    });
  });
  tx();
}

function seedBeltAssyPmSchedules(db) {
  const codes = BELT_ASSY_MACHINES.map(m => m.code);
  const machines = db.prepare(`SELECT id FROM machines WHERE machine_code IN (${codes.map(() => '?').join(',')})`).all(...codes);
  if (machines.length === 0) return;

  const hasSchedule = db.prepare('SELECT COUNT(*) c FROM pm_schedules WHERE machine_id = ?');
  const insert = db.prepare(`
    INSERT INTO pm_schedules (machine_id, pm_type, description, interval_days, last_done_date, next_due_date, assigned_to, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function addSchedule(machineId, pmType, intervalDays, description) {
    const lastDone = new Date(today);
    lastDone.setDate(lastDone.getDate() - randInt(0, intervalDays));
    const nextDue = new Date(lastDone);
    nextDue.setDate(nextDue.getDate() + intervalDays);
    insert.run(machineId, pmType, description, intervalDays, fmtDate(lastDone), fmtDate(nextDue), pickRandom(TECHNICIANS));
  }

  const tx = db.transaction(() => {
    machines.forEach((m, idx) => {
      if (hasSchedule.get(m.id).c > 0) return; // sudah ada jadwal utk mesin ini
      addSchedule(m.id, 'Daily Check',  1,  'Pengecekan harian kondisi mesin sesuai checklist standar.');
      addSchedule(m.id, 'Weekly PM',    7,  'Pemeriksaan mingguan, pelumasan, dan pengencangan baut.');
      addSchedule(m.id, 'Monthly PM',   30, 'Pemeriksaan bulanan menyeluruh dan penggantian consumable.');
      if (idx % 2 === 0) addSchedule(m.id, '3-Monthly PM', 90, 'Overhaul ringan tiap 3 bulan (bearing, belt, kalibrasi).');
    });
  });
  tx();
}

function seedBeltAssyLogs(db) {
  const codes = BELT_ASSY_MACHINES.map(m => m.code);
  const machines = db.prepare(`SELECT id, machine_code, machine_name FROM machines WHERE machine_code IN (${codes.map(() => '?').join(',')})`)
    .all(...codes)
    .map(m => ({ ...m, hot: BELT_ASSY_MACHINES.find(x => x.code === m.machine_code)?.hot || false }));
  if (machines.length === 0) return;

  const ids = machines.map(m => m.id);
  const { count } = db.prepare(`SELECT COUNT(*) count FROM daily_logs WHERE machine_id IN (${ids.map(() => '?').join(',')})`).get(...ids);
  if (count > 0) return; // sudah ada histori utk mesin2 Belt Assy ini

  generateLogsForMachines(db, machines, 92);
}

function seedAll(db) {
  seedMachines(db);
  seedSpareParts(db);
  seedShifts(db);
  seedPmSchedules(db);
  seedDailyLogs(db);

  // Migrasi idempotent — aman dijalankan berkali-kali, hanya menambah data
  // Belt Assy yang belum ada.
  seedBeltAssyMachines(db);
  seedBeltAssyPmSchedules(db);
  seedBeltAssyLogs(db);
}

module.exports = seedAll;
