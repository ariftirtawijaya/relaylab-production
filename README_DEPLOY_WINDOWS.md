# RelayLab Production System — Docker Deploy (Windows)

Panduan singkat menjalankan aplikasi di Windows menggunakan **Docker Desktop**.

---

## 🔧 Prasyarat

1. **Docker Desktop for Windows** sudah ter-install dan **WSL2 backend aktif**
   👉 https://www.docker.com/products/docker-desktop/
2. Pastikan Docker Desktop sudah running (icon di system tray bertuliskan "Docker Desktop is running")
3. Port **80** di Windows tidak dipakai aplikasi lain (cek dengan `netstat -ano | findstr :80`)
   - Kalau dipakai IIS, matikan: `Stop-Service W3SVC` (PowerShell sebagai Admin)

---

## 🚀 Cara Menjalankan (3 langkah)

### 1. Clone / pull repository ini
```powershell
git clone <repo-url> relaylab
cd relaylab
```

### 2. Buat file `.env` di root project
File ini berisi rahasia (storage key). **JANGAN di-commit ke git.**

```powershell
# PowerShell:
Copy-Item .env.example .env
notepad .env
```

Isi `EMERGENT_LLM_KEY` dengan kunci dari Emergent Profile → Universal Key.

```env
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxxxxxxx
```

> Tanpa key ini upload foto **akan gagal** (Object Storage). Master data, login, WO, cutting sheet, dst tetap bisa jalan.

### 3. Build & start semua container
```powershell
docker compose up -d --build
```

Build pertama kali makan ±5–10 menit (yarn install + python deps). Build berikutnya sangat cepat berkat cache.

---

## 🌐 Akses Aplikasi

Buka browser di komputer yang menjalankan Docker:

| URL | Keterangan |
|---|---|
| http://localhost | Aplikasi utama (login screen) |
| http://localhost/api/health | Cek backend hidup (return JSON `{ok: true}`) |

Untuk akses dari komputer lain di jaringan workshop (tablet, dst), gunakan IP host Windows:

```
http://192.168.x.x
```

(ganti dengan IP Windows Anda dari `ipconfig`)

---

## 🔑 Akun Demo Awal

Otomatis di-seed saat backend pertama kali startup (kalau MongoDB kosong):

| Username | Password | Role |
|---|---|---|
| `arif` | `admin123` | Admin |
| `redi` | `prod123` | Production |
| `leni` | `qc123` | QC |

⚠️ **Wajib ganti password Admin setelah login pertama** (menu profile pojok kanan atas).

---

## 📦 Service yang Berjalan

| Container | Image | Port | Catatan |
|---|---|---|---|
| `relaylab-mongo` | mongo:7 | (internal only) | Data tersimpan di volume `mongo_data` |
| `relaylab-backend` | dibuild dari `backend/Dockerfile` | (internal 8001) | FastAPI + Motor |
| `relaylab-frontend` | dibuild dari `frontend/Dockerfile` | **80** → host | Nginx serve React build + proxy `/api` ke backend |

Semua container ter-restart otomatis (`restart: unless-stopped`) kecuali Anda matikan Docker Desktop atau jalankan `docker compose down`.

---

## 🛠 Perintah Sehari-hari

```powershell
# Lihat status container
docker compose ps

# Lihat log realtime (semua service)
docker compose logs -f

# Lihat log salah satu service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo

# Restart 1 service
docker compose restart backend

# Stop tanpa hapus data
docker compose stop

# Start kembali
docker compose start

# Hapus container (data MongoDB tetap aman di volume)
docker compose down

# ⚠️ HAPUS TOTAL termasuk database (DESTRUCTIVE!)
docker compose down -v
```

---

## 🔄 Update Setelah Pull Code Baru

```powershell
git pull
docker compose up -d --build
```

Docker akan otomatis rebuild image yang berubah; service yang tidak berubah tetap pakai cache.

---

## 💾 Backup & Restore MongoDB

### Backup
```powershell
docker compose exec mongo sh -c "mongodump --db=relaylab_production --archive" > backup.archive
```

### Restore
```powershell
Get-Content backup.archive | docker compose exec -T mongo sh -c "mongorestore --archive --drop"
```

> Disarankan jadwalkan backup harian via Windows Task Scheduler.

---

## 🧪 Troubleshooting

### "Port 80 already in use"
Aplikasi lain (IIS, Skype lama, dll) pakai port 80. Solusi:
1. Matikan aplikasi pengganggu, **ATAU**
2. Ubah port di `docker-compose.yml`:
   ```yaml
   frontend:
     ports:
       - "8080:80"   # akses di http://localhost:8080
   ```

### "Cannot connect to backend" / 502 Bad Gateway
1. Cek container backend hidup: `docker compose ps`
2. Lihat log: `docker compose logs backend`
3. Tunggu ±15 detik setelah `up` — backend butuh waktu init connection ke MongoDB

### "Upload foto gagal"
- Cek `.env` Anda — `EMERGENT_LLM_KEY` sudah benar?
- Cek log backend: `docker compose logs backend | findstr storage`
- Maks file 5 MB (server) + 10 MB (Nginx). Cek ukuran file Anda.

### Frontend build error "out of memory" (mesin RAM kecil)
Tambahkan Node memory flag di `frontend/Dockerfile`:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### Bersihkan cache Docker (kalau disk penuh)
```powershell
docker system prune -af --volumes
# ⚠️ Ini hapus SEMUA container & volume yang stopped, termasuk data MongoDB!
# Gunakan hanya kalau Anda sudah backup.
```

---

## 🔐 Catatan Keamanan

- File `.env` **JANGAN di-commit ke git**. Sudah otomatis di-ignore di `.gitignore`.
- Untuk produksi serius, pertimbangkan:
  - Set HTTPS via reverse proxy (Caddy / Traefik / Nginx + Let's Encrypt)
  - Ganti `CORS_ORIGINS=*` jadi domain spesifik
  - Restrict Docker network ke interface internal saja
  - Aktifkan MongoDB authentication (set `MONGO_INITDB_ROOT_USERNAME/PASSWORD` di service `mongo`, update `MONGO_URL` di backend env)

---

## 📁 Struktur File Deployment

```
relaylab/
├── docker-compose.yml          ← Orchestrator
├── .env                        ← (Anda buat) EMERGENT_LLM_KEY
├── .env.example                ← Template .env
├── README_DEPLOY_WINDOWS.md    ← File ini
├── backend/
│   ├── Dockerfile              ← Build image FastAPI
│   ├── .dockerignore
│   └── ... (source)
└── frontend/
    ├── Dockerfile              ← Build image React + Nginx
    ├── .dockerignore
    ├── nginx.conf              ← Reverse proxy /api → backend
    └── ... (source)
```

---

## ❓ Pertanyaan / Issue

Buka issue di repository ini atau hubungi developer.

Selamat deploy! 🚀
