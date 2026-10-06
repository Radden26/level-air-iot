# Monitoring Level Air 1 Tangki — Modbus RTU RS485 + ESP32 + Firebase + Next.js

Arsitektur lengkap sesuai request:

```
Probe Stainless (25/50/75/100%) → BC547 + PC817 → Arduino Nano (Slave ID 1, Modbus RTU 9600 8N1)
  → RS485 MAX485 (DE/RE D2, RO D0, DI D1) ──A/B/GND──► ESP32 DevKit V1 Master (DE/RE GPIO4, RO GPIO16, DI GPIO17)
  → WiFi → Firebase Realtime Database (/tanks/tangki1) → Dashboard Next.js 14
```

---

## 1. Hardware Fix — JANGAN DIUBAH

### Slave Node (1x Arduino Nano)

| Probe Stainless | Transistor | Optocoupler | Arduino Nano Input | LED Indikator |
|---|---|---|---|---|
| 25% (paling bawah) | BC547 NPN via R 10k ke Base | PC817 Kolektor via R 1k, output pull-up 10k ke 5V | **D4** (INPUT_PULLUP, LOW=ada air) | **D8** Merah via R330 |
| 50% | sama | sama | **D5** | **D9** Kuning |
| 75% | sama | sama | **D6** | **D10** Hijau |
| 100% (paling atas) | sama | sama | **D7** | **D11** Biru |

Rangkaian probe: **Probe → R 10k → Base BC547**. Kolektor BC547 → R 1k → LED internal PC817 (Anoda). Emitter BC547 → GND. Sisi output PC817: Kolektor → R 10k pull-up ke 5V + ke pin D4-D7 Arduino, Emitter → GND. Saat air menyentuh probe, BC547 ON → PC817 ON → pin Arduino tertarik LOW.

**MAX485 Slave:** `DE/RE → D2`, `RO → D0 (RX)`, `DI → D1 (TX)`, `VCC 5V`, `GND`, `A→A master`, `B→B master`.

### Master Node (1x ESP32 DevKit V1)

| MAX485 | ESP32 |
|---|---|
| DE + RE (jumper) | **GPIO4** |
| RO | **GPIO16 (RX2)** |
| DI | **GPIO17 (TX2)** |
| VCC | 3.3V atau 5V (MAX485 3.3V tolerant, disarankan 3.3V) |
| GND | GND |
| A | A Slave |
| B | B Slave |

**Terminator 120Ω:** Pasang resistor 120Ω antara A-B di **kedua ujung** bus (di modul Slave dan Master). Jika kabel < 2m bisa tanpa terminator tapi disarankan pasang.

**Wiring RS485 Ringkas:**
```
Slave Nano (MAX485)         Master ESP32 (MAX485)
   A  ───────────────────────  A
   B  ───────────────────────  B
  GND ─────────────────────── GND  (WAJIB common ground)
   |120Ω|                  |120Ω|  terminator
```
Baudrate **9600 8N1** di kedua node.

---

## 2. Firmware Arduino Nano Slave — `arduino-slave/`

- **PlatformIO:** `platform = atmelavr`, `board = nanoatmega328`, `framework = arduino`
- **Library:** `emelianov/ModbusRTU @^2.0.1`
- **File:** `arduino-slave/src/main.cpp`
- **ID:** `#define SLAVE_ID 1` di baris atas file — **GANTI DISINI jika tambah slave lalu Re-Flash.**

### Cara Upload
```bash
cd arduino-slave
pio lib install
pio run --target upload  # pilih port Nano, baud 9600
pio device monitor --baud 9600
```

### Register Map Modbus RTU

| Alamat Modbus | Tipe | Alamat Protokol | Isi |
|---|---|---|---|
| 40001 | Holding Register | 0 | `level_persen` 0/25/50/75/100 |
| 40002 | Holding Register | 1 | `bitmask` bit0=25% bit1=50% bit2=75% bit3=100% |
| 40003 | Holding Register | 2 | `error_code` 0=OK, 1=Probe fault non-sekuensial |
| 00001 | Coil | 0 | `status pompa dummy` read/write |

### Debug Serial
```
[SLAVE 1] 75% | 0111 | err:0 | coil:OFF
[SLAVE 1] 100% | 1111 | err:0 | coil:OFF
```
Bitmask ditampilkan MSB→LSB (100%..25%).

### Cara Tambah Slave
1. Duplikat hardware slave (Nano + probe + MAX485).
2. Buka `arduino-slave/src/main.cpp`, ubah `#define SLAVE_ID 2` (atau 3,4...).
3. Upload ke Nano baru.
4. Buka `esp32-master/src/main.cpp`, ubah `#define POLL_SLAVE_ID 2` **atau** modifikasi firmware master untuk polling multi-ID (lihat catatan di README esp32-master).
5. Pastikan A/B/GND paralel di bus RS485.

---

## 3. Firmware ESP32 Master — `esp32-master/`

- **PlatformIO:** `platform = espressif32`, `board = esp32dev`
- **Library:** `ModbusMaster`, `Firebase ESP Client` (Mobizt), `WiFiManager`, `ArduinoJson`
- **File:** `esp32-master/src/main.cpp`
- **ID Polling:** `#define POLL_SLAVE_ID 1` di baris atas — **GANTI DISINI saat reflash tambah slave.**

### Fitur
- Polling **Function 3** baca 3 Holding Register dari `POLL_SLAVE_ID` tiap **2 detik**, timeout **500ms**, retry **3x** (DE/RE via pre/postTransmission GPIO4).
- Jika OK → kirim ke Firebase:
  - `PUT /tanks/tangki1/realtime` → `{ level_persen, bitmask, levels{25,50,75,100}, error_code, online:true, last_update (epoch), latency_ms, rssi, ip, label }`
  - `PUT /tanks/tangki1/history/{timestamp}` tiap **1 menit** (push history, timestamp epoch dari NTP).
- Jika gagal **5x berturut** → kirim `online:false` + `last_update`.
- Serial log: `Master polling ID 1 -> 75% | bitmask:0111 | 42ms OK`

### WiFiManager
Pada boot pertama, ESP32 membuka AP **`LevelAir-AP`** (open, tanpa password). Hubungkan HP/laptop → browser otomatis ke `192.168.4.1` → pilih WiFi rumah → Save. Kredensial tersimpan, reboot otomatis konek. Untuk reset: `wm.resetSettings()` (uncomment di setup).

### Firebase Setup — WAJIB ISI SEBELUM UPLOAD

1. Buat project di https://console.firebase.google.com
2. Enable **Realtime Database** → Create Database → Lokasi Singapore → Start in **test mode** (atau locked mode + buat user Auth).
3. Enable **Authentication → Email/Password** (jika pakai auth) → buat user `admin@monitoring.local`.
4. Salin **Project Settings → General → SDK config** dan **Database URL**.
5. Buka `esp32-master/src/main.cpp` isi:
```cpp
#define API_KEY "AIzaSy..."
#define DATABASE_URL "https://xxx-default-rtdb.firebaseio.com"
#define USER_EMAIL "admin@monitoring.local"
#define USER_PASSWORD "password123"
// ATAU jika pakai test mode tanpa auth, isi DATABASE_SECRET (legacy token dari Database → Data → ⋮ → ...)
```
6. Rules contoh (test 1 bulan, lalu ganti ke auth):
```json
{
  "rules": {
    ".read": "auth != null || true",
    ".write": "auth != null || true"
  }
}
```

### Cara Upload
```bash
cd esp32-master
pio run --target upload
pio device monitor --baud 115200
```

### Menambah Multi-Slave (opsional pengembangan)
Master default hanya polling 1 ID. Untuk multi-tangki, ubah loop polling jadi array:

```cpp
const uint8_t SLAVE_IDS[] = {1,2,3};
for (auto id : SLAVE_IDS) { node.begin(id, modbusSerial); /* poll & push ke /tanks/tangki{id} */ }
```
Lalu di Firebase buat path `/tanks/tangki2`, `/tanks/tangki3` dan dashboard multi-card.

---

## 4. Dashboard Next.js 14 — `dashboard/`

- **Stack:** Next.js 14 App Router, Tailwind CSS, Shadcn UI (card/badge/button), Recharts, Firebase JS SDK v10 (modular), lucide-react.
- **Tema:** Dark mode `#070b19`, primary `#0ea5e9`, border `#1e293b`, responsive.

### Fitur UI
- **Visual tangki transparan** di tengah + **animasi wave CSS** 60fps, tinggi air animasi 1s sesuai `level_persen`, angka % besar di tengah.
- **4 LED glow** kanan: Merah 25%, Kuning 50%, Hijau 75%, Biru 100% — ON/OFF sesuai bitmask, glow `box-shadow` + pulse.
- **Card status:** Level label (KOSONG/RENDAH/SEDANG/TINGGI/PENUH) + progress bar, Koneksi ONLINE/OFFLINE + latency ms + RSSI, Last Update (format id-ID, "x detik lalu").
- **Grafik Recharts AreaChart 24 jam** dari `/tanks/tangki1/history` (limit 200 titik, gradient sky).
- **Tabel Log realtime** (50 entri terbaru, kolom Waktu | Level | Bitmask | Label).
- Bahasa Indonesia penuh.

### Setup Dashboard

```bash
cd dashboard
cp .env.example .env.local   # isi Firebase config
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

### .env.example

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://xxx-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123...
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...
NEXT_PUBLIC_TANK_PATH=/tanks/tangki1
```

> Dashboard pakai Firebase JS SDK **tanpa auth** (read public) jika rules test mode. Untuk production, tambahkan Firebase Auth login page.

### Deploy
- **Vercel:** `vercel --prod`, set env di dashboard Vercel.
- **Firebase Hosting:** `firebase init hosting`, `npm run build`, `firebase deploy`.

---

## 5. Struktur Folder

```
LEVEL_AIR/
├── arduino-slave/
│   ├── platformio.ini
│   └── src/main.cpp          # SLAVE_ID = 1
├── esp32-master/
│   ├── platformio.ini
│   └── src/main.cpp          # POLL_SLAVE_ID = 1
├── dashboard/
│   ├── app/
│   │   ├── page.tsx          # Single tank UI
│   │   ├── layout.tsx
│   │   └── globals.css       # #070b19 + wave animation
│   ├── components/
│   │   ├── TankVisual.tsx
│   │   ├── LedIndicators.tsx
│   │   ├── StatusCards.tsx
│   │   ├── HistoryChart.tsx
│   │   ├── LogTable.tsx
│   │   └── ui/card.tsx, badge.tsx, button.tsx
│   ├── lib/firebase.ts
│   ├── lib/utils.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   └── .env.example
└── README.md
```

---

## 6. Cara Ganti SLAVE_ID (Tambah Tangki)

| Langkah | File | Ubah | Keterangan |
|---|---|---|---|
| 1 | `arduino-slave/src/main.cpp` | `#define SLAVE_ID 2` | ID slave baru (1-247) |
| 2 | Flash Nano baru | `pio run -e nanoatmega328 --target upload` | Hardware duplikat |
| 3 | `esp32-master/src/main.cpp` | `#define POLL_SLAVE_ID 2` | **Re-Flash ESP32** |
| 4 | Firebase | buat path `/tanks/tangki2` | dashboard multi-tangki atau ganti `NEXT_PUBLIC_TANK_PATH` |

Bus RS485 paralel: semua A gabung, semua B gabung, GND common, terminator hanya di ujung terjauh.

---

## 7. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Slave Serial `TIMEOUT` terus | A/B terbalik, GND tidak common, baud beda, terminator hilang, DE/RE salah pin | Cek wiring A-A B-B GND-GND, scope RS485, pastikan kedua node 9600 8N1 |
| Bitmask aneh `0101` | Probe kotor / kabel putus (non-sekuensial) | `error_code=1`, bersihkan probe, cek BC547/PC817 |
| ESP32 tidak ke Firebase | WiFi belum set, API_KEY/DATABASE_URL salah, rules deny | Buka Serial 115200, cek `[FIREBASE] FAIL`, re-config WiFiManager (resetSettings), cek rules |
| Dashboard `Belum ada data` | `.env.local` kosong, DATABASE_URL salah, history belum 1 menit | Isi `.env.local` dari Firebase Console, tunggu 1 menit push pertama, cek RTDB di console |
| Level loncat 0→100 | Probe atas basah tapi bawah kering (error_code 1) | Di slave sudah flag error, tetap tampil level tertinggi; cek instalasi probe sekuensial |

---

## 8. Lisensi & Kontak

Project open untuk modifikasi bebas. Untuk pertanyaan wiring BC547-PC817 atau tuning `pull-up 10k / R 1k / R 330`, lihat skema di `README.md` bagian Hardware.

**Selamat monitoring!** — Pastikan tangki grounding dan probe stainless tidak korosi.
