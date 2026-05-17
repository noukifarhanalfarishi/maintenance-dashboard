# HPPM Maintenance — PD 3 Problem Tracking Dashboard

**PT. Honda Precision Parts Manufacturing Indonesia**  
PD 3 — Element Ring Dept & Belt Assy Dept

Aplikasi web full-stack untuk manajemen dan tracking problem maintenance mesin di PD 3 secara terpusat dan real-time.

## Tech Stack
| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express.js |
| Database | SQLite (better-sqlite3) — tidak butuh server database |
| Auth | JWT (jsonwebtoken) |
| Export | jsPDF + html2canvas + SheetJS (xlsx) |

---

## Cara Menjalankan (Development)

### Prasyarat
- Node.js 18+ dan npm
- Git (opsional)

### Setup Pertama Kali

```bash
# 1. Clone atau download project
cd maintenance-dashboard

# 2. Install dependencies semua sekaligus
npm run install:all

# 3. Buat file .env (copy dari example)
cp .env.example .env
# Edit .env jika diperlukan (default sudah siap pakai untuk development)
```

### Menjalankan

**Option A — Jalankan keduanya sekaligus (recommended):**
```bash
npm run dev
```

**Option B — Jalankan terpisah:**
```bash
# Terminal 1 — Backend (port 5000)
cd server && npm run dev

# Terminal 2 — Frontend (port 3000)
cd client && npm run dev
```

Buka browser: **http://localhost:3000**

---

## Akun Default

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| **Admin** | `admin` | `admin123` | Semua fitur |
| **Supervisor** | `supervisor` | `super123` | Dashboard, Problems, Machines, Repairs, Spare Parts, Reports |
| **Technician** | `teknisi1` | `teknis123` | Dashboard, Problems, Machines, Repairs, Spare Parts |
| **Operator** | `operator1` | `oper123` | Dashboard, Problems |

---

## Deploy dengan Docker (Proxmox / VPS / Server)

### Prasyarat
- Docker Engine 20+
- Docker Compose v2

### Deploy

```bash
# 1. Clone project ke server
git clone <repo-url> maintenance-dashboard
cd maintenance-dashboard

# 2. Buat .env dengan secret yang kuat
cp .env.example .env
nano .env
# Pastikan ubah JWT_SECRET menjadi string random yang kuat!

# 3. Build dan jalankan
docker compose up -d --build

# 4. Cek status
docker compose ps
docker compose logs -f
```

Aplikasi berjalan di: **http://<ip-server>**  
API berjalan di: **http://<ip-server>/api**

### Environment Variables

Buat file `.env` di root project:

```env
# Server port (internal Docker)
PORT=5000

# JWT — WAJIB diganti di production!
JWT_SECRET=random-string-sangat-panjang-dan-unik-ganti-ini
JWT_EXPIRES=24h

# Port yang diekspos ke publik (default: 80)
APP_PORT=80

# Client URL untuk CORS
CLIENT_URL=http://localhost
```

### Persistent Data (SQLite)

Database SQLite tersimpan di Docker volume `db_data`. Data tidak hilang saat container di-restart.

```bash
# Backup database
docker compose exec server cp /data/maintenance.db /tmp/backup.db
docker compose cp server:/tmp/backup.db ./backup-$(date +%Y%m%d).db

# Restore
docker compose cp ./backup.db server:/data/maintenance.db
docker compose restart server
```

### Update Aplikasi

```bash
git pull
docker compose up -d --build
```

### Hentikan

```bash
docker compose down          # Hentikan tapi data tersimpan
docker compose down -v       # Hentikan DAN hapus data (HATI-HATI!)
```

---

## Fitur Lengkap

### Dashboard Overview
- KPI cards: Total Problem, Total Downtime, MTTR, MTBF
- Period filter: Hari Ini, 7 Hari, 30 Hari, 3 Bulan, Custom
- Area chart tren problem per minggu (12 minggu)
- Donut chart distribusi kategori
- Horizontal bar chart top mesin downtime
- Pareto chart problem per kategori (80/20 rule)
- Recent problems table + detail drawer

### Problem Tracking
- Tabel sortable 9 kolom
- Filter multi-dimensi: status, priority, kategori, mesin, date range
- Full-text search
- New Problem modal dengan auto-ticket generation
- Problem Detail Drawer (slide kanan):
  - Status update buttons
  - Root cause inline edit
  - Repair Actions list + Add Repair form
  - Auto-calc downtime dari waktu mulai/selesai
  - Multi-select spare parts
  - Timeline aktivitas

### Data Mesin
- Card view + Table view (toggle)
- Filter: tipe, lokasi, status
- Machine Detail Drawer:
  - KPI: MTBF, MTTR, downtime per bulan (vs bulan lalu)
  - 6-bulan trend bar chart
  - Category pie chart
  - Problem history table

### Spare Parts
- Tabel stok dengan visual progress bar
- Category filter chips
- Alert banner stok rendah
- Stock adjustment modal (masuk/keluar) dengan preview
- CRUD lengkap

### Reports
- Summary Report: KPI, trend, breakdown per kategori/priority/mesin, top recurring problems, top spare parts
- Machine Report: KPI mesin + trend + problem list dengan repairs
- Export PDF (via html2canvas + jsPDF)
- Export Excel multi-sheet (SheetJS)
- Print-friendly layout

### Authentication
- JWT-based session management
- Role-based access control (4 level: Admin, Supervisor, Technician, Operator)
- Auto-redirect ke login jika token kadaluarsa
- Sidebar dan menu disesuaikan dengan role

---

## Struktur Project

```
maintenance-dashboard/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── contexts/    # AuthContext, ConfirmContext
│   │   ├── components/  # Layout, Sidebar, Header, Badge, ProtectedRoute
│   │   ├── pages/       # Dashboard, Problems, Machines, SpareParts, Reports, Users, Login
│   │   └── api/         # axios client dengan auth interceptor
│   └── vite.config.js
│
├── server/              # Express backend
│   ├── middleware/      # auth.js (JWT verify + role check)
│   ├── routes/          # auth, machines, problems, repairs, spare-parts, users, dashboard, reports
│   └── db.js            # SQLite init + schema + seed data
│
├── database/            # SQLite file (auto-created)
├── docker-compose.yml
├── Dockerfile.server
├── Dockerfile.client
├── nginx.conf
├── .env.example
└── README.md
```

---

## API Endpoints

### Auth (Public)
| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login, returns JWT token |
| GET  | `/api/auth/me` | Verify token & get user |

### Protected (requires `Authorization: Bearer <token>`)
| Resource | Endpoints |
|----------|-----------|
| Machines | `GET/POST /api/machines`, `GET/PUT/DELETE /api/machines/:id`, `GET /api/machines/:id/stats`, `GET /api/machines/:id/chart-data` |
| Problems | `GET/POST /api/problems`, `GET/PUT/PATCH/DELETE /api/problems/:id`, `POST /api/problems/:id/repairs` |
| Repairs | `GET/POST /api/repairs`, `GET/PUT/DELETE /api/repairs/:id` |
| Spare Parts | `GET/POST /api/spare-parts`, `GET/PUT/DELETE /api/spare-parts/:id`, `PATCH /api/spare-parts/:id/stock` |
| Dashboard | `GET /api/dashboard/summary-v2`, `GET /api/dashboard/weekly-trend`, `GET /api/dashboard/top-downtime`, etc. |
| Reports | `GET /api/reports/summary`, `GET /api/reports/machine/:id` |

---

## Troubleshooting

**Port sudah dipakai:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /F /PID <pid>

# Linux
lsof -i :5000
kill -9 <pid>
```

**Database corrupt / reset data:**
```bash
# Development
rm database/maintenance.db
# Restart server — akan auto-recreate dengan data seed

# Docker
docker compose down -v
docker compose up -d
```

**Token expired di browser:**
- Buka browser console → Application → Local Storage → hapus `maint_token` dan `maint_user`
- Refresh halaman → akan redirect ke login

---

## Data Seed

Database diisi otomatis saat pertama kali server dijalankan:
- **15 mesin** dari berbagai tipe dan lokasi (Line 1-3, Utility, Packaging)
- **76 problem** selama 6 bulan (Nov 2025 – Mei 2026) dengan distribusi realistis
- **70 repair records** dengan downtime detail dan spare parts
- **20 spare parts** dengan stok dan minimum stok
- **8 users** dengan berbagai role

Mesin yang sengaja dibuat sering bermasalah: MC-001 (CNC), MC-003 (Conveyor), MC-007 (Hydraulic Press)
