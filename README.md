# Quran Foundation Content APIs v4 → Full Dataset Exporter

Ambil **seluruh endpoint Content APIs v4** (Chapters, Verses+Words, Quran scripts/glyph, Resources, Translations, Tafsirs, Audio, dan Search) lalu simpan ke **NDJSON**. Dataset bisa diimpor ke **PostgreSQL** pakai `sql/schema.sql` dan skrip import otomatis.

Fitur utama:

* ✅ **OAuth2 Client Credentials** (`scope=content`)
* ✅ **Resume/Checkpoint** per segmen (lanjut dari titik terakhir)
* ✅ **Logging** (console/file, JSON/non-JSON) + **heartbeat progress**
* ✅ **Mode Dev (ts-node/esm)** & **Mode Build (compile ke dist/)**
* ✅ **Importer otomatis ke PostgreSQL** (tanpa `jq`)
* ✅ **Validator** untuk cek kelengkapan dataset

> Proyek ini mengekspor data publik melalui **Content APIs v4**. Perhatikan syarat & ketentuan layanan Qur'an Foundation untuk penggunaan data.

---

## Struktur Proyek

```
qf-export-all/
├── README.md
├── .env.example
├── package.json
├── tsconfig.dev.json
├── tsconfig.build.json
├── sql/
│   └── schema.sql
├── src/
│   ├── http.ts
│   ├── util.ts
│   ├── endpoints.ts
│   ├── normalizers.ts
│   ├── checkpoint.ts
│   ├── logger.ts
│   ├── run.ts          # exporter utama (sudah ada resume + logging)
│   ├── import.ts       # importer NDJSON -> Postgres
│   └── validate.ts     # validator data
└── out/                # hasil NDJSON
```

---

## Persiapan

### 1) Node.js & PostgreSQL

* Node **v18+** (disarankan v20+)
* PostgreSQL **13+**

### 2) Install deps & env

```bash
npm i
cp .env.example .env
# isi CLIENT_ID & CLIENT_SECRET (OAuth2 Client Credentials)
# isi DATABASE_URL (contoh: postgresql://postgres:postgres@localhost:5432/quran_local)
```

### 3) Konfigurasi tsconfig (sudah disediakan)

* **Dev**: `tsconfig.dev.json` (no emit, ts-node/esm)
* **Build**: `tsconfig.build.json` (emit → `dist/`)

### 4) Script yang tersedia

```json
{
  "scripts": {
    "dev:fetch": "node --loader ts-node/esm --project tsconfig.dev.json src/run.ts",
    "dev:import": "node --loader ts-node/esm --project tsconfig.dev.json src/import.ts",
    "dev:validate": "node --loader ts-node/esm --project tsconfig.dev.json src/validate.ts",

    "build": "tsc --project tsconfig.build.json",
    "fetch": "npm run build && node dist/run.js",
    "fetch:resume": "CHECKPOINT_PATH=.checkpoint.json npm run build && node dist/run.js",
    "import": "npm run build && node dist/import.js",
    "validate": "npm run build && node dist/validate.js"
  }
}
```

---

## Menjalankan Exporter

### Opsi A — Mode Dev (cepat, tanpa build)

```bash
npm run dev:fetch
```

### Opsi B — Mode Build (kompilasi ke `dist/`)

```bash
npm run fetch
# jika proses terputus / ingin lanjut:
npm run fetch:resume
```

**Filter subset** dengan env `ONLY` (comma-separated). Contoh:

```bash
ONLY=chapters,verses,words npm run dev:fetch
# opsi: chapters, verses, words, quran, translations, tafsirs, resources, audio, juz, search
```

**Rate-limit & concurrency** (atur di `.env`):

* `PER_PAGE` (default 50)
* `CONCURRENCY` (default 4)
* `SLEEP_MS` (default 200 ms antar request)

> Exporter otomatis melakukan pagination untuk endpoint yang mendukungnya.

---

## Resume / Checkpoint

Aktifkan dengan `CHECKPOINT_PATH` (contoh: `.checkpoint.json`). Contoh jalankan:

```bash
CHECKPOINT_PATH=.checkpoint.json npm run dev:fetch
# atau pakai script build:
npm run fetch:resume
```

Yang dicatat:

* **Verses**: per surah + halaman (`verses_by_chapter.ch_{n}_page`)
* **Quran scripts/glyph**: per `kind + scope` (`quran_{kind}.{scope}`)
* **Translations/Tafsirs**: per `resource_id + chapter + page`
* **Audio**: per `reciter_id`

> Checkpoint aman di-commit (opsional) untuk resume lintas mesin.

---

## Logging & Heartbeat

Opsi di `.env`:

```ini
LOG_LEVEL=info          # debug|info|warn|error
LOG_JSON=false          # true = output JSON lines
LOG_FILE=               # contoh: logs/qf-export.log (kosong = console saja)
LOG_INTERVAL_MS=10000   # interval heartbeat (ms), 0 = nonaktif
```

Contoh:

```bash
# console, verbose
LOG_LEVEL=debug npm run dev:fetch

# tulis ke file + JSON (cocok untuk tail + jq)
LOG_JSON=true LOG_FILE=logs/qf-export.log npm run dev:fetch
tail -f logs/qf-export.log | jq .
```

Contoh output non-JSON:

```
2025-09-12T04:21:00.123Z ℹ️  INFO export started {"BASE_URL":"...","LANGUAGE":"en","PER_PAGE":"50","ONLY":"(all)"}
2025-09-12T04:21:01.790Z ℹ️  INFO verses: chapter start {"chapter":1}
2025-09-12T04:21:02.210Z 🐛 DEBUG verses: page done {"chapter":1,"page":1,"total_pages":7}
...
2025-09-12T04:21:10.000Z ℹ️  INFO heartbeat {"chapters_done":114,"verses_ch_done":12,"verses_total_pages":84,"verses_last":{"chapter":12,"page":3}, ...}
2025-09-12T04:30:55.321Z ℹ️  INFO export finished ✅
```

---

## Output Dataset (NDJSON)

Folder `out/` berisi file-file:

* `chapters.ndjson`, `chapter_infos.ndjson`
* `verses.ndjson`, `words.ndjson` (**words aktif** via `fields=words` + `word_fields`)
* `quran_*.ndjson` (script teks & glyph: uthmani\_simple, uthmani, indopak, tajweed, imlaei\_simple, code\_v1, code\_v2)
* `languages.ndjson`, `translation_resources.ndjson`, `tafsir_resources.ndjson`
* `translations.ndjson`, `tafsirs.ndjson`
* `recitations.ndjson`, `chapter_audio_files.ndjson`
* `juzs.ndjson`
* `search.ndjson` (opsional seed)

---

## Import ke PostgreSQL

1. Buat DB & schema:

```bash
createdb quran_local
psql "$DATABASE_URL" -f sql/schema.sql
```

2. Import dengan skrip:

```bash
npm run import
```

Skrip import:

* Membaca tiap NDJSON di `out/`
* Memetakan kolom → tabel skema (`sql/schema.sql`)
* Menggunakan `COPY` (stream) untuk performa

> Jika ingin menambahkan mapping baru, lengkapi array `maps` di `src/import.ts`.

---

## Validasi Dataset

```bash
npm run validate
```

Validator mengecek:

* Jumlah baris per tabel inti
* Kesesuaian `chapters.verses_count` vs jumlah real di `verses`
* Ayat tanpa `words` (idealnya 0)
* Konsistensi `position` kata per ayat (1..N)

---

## Konfigurasi `.env`

```ini
# API & OAuth
BASE_URL=https://apis.quran.foundation/content/api/v4
OAUTH_TOKEN_URL=https://oauth2.quran.foundation/oauth2/token
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
LANGUAGE=en

# Crawl
PER_PAGE=50
CONCURRENCY=4
SLEEP_MS=200
ONLY=

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quran_local

# Checkpoint
CHECKPOINT_PATH=.checkpoint.json

# Logging
LOG_LEVEL=info
LOG_JSON=false
LOG_FILE=
LOG_INTERVAL_MS=10000
```

---

## Tips & Troubleshooting

* **Module not found (.ts/.js)**

  * Mode dev (ts-node/esm): import relatif boleh `.ts`
  * Mode build (dist): **pastikan import relatif pakai `.js`** (sudah di file `run.ts`).
* **429 / Rate limit**

  * Naikkan `SLEEP_MS` atau turunkan `CONCURRENCY`.
* **Token expired**

  * Token otomatis di-refresh (cache ±55 menit).
* **Partial data / putus di tengah**

  * Jalankan `npm run fetch:resume` (butuh `CHECKPOINT_PATH`).
* **Import "not found file"**

  * Pastikan exporter selesai membuat NDJSON; cek log & `out/`.

---

## Lisensi & Kepatuhan

Dataset yang dihasilkan berasal dari **Content APIs v4** dengan kredensial dan cakupan yang kamu miliki. Harap patuhi **Terms of Service**/lisensi Quran Foundation untuk distribusi dan penggunaan data.
