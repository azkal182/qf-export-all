# Quran Foundation Content APIs v4 → Full Dataset Exporter

Export **all Content APIs v4 endpoints** (Chapters, Verses+Words, Quran scripts/glyphs, Resources, Translations, Tafsirs, Audio, and Search) and save to **NDJSON** format. Dataset can be imported to **PostgreSQL** using `sql/schema.sql` and automated import scripts.

## ✨ Key Features

* ✅ **OAuth2 Client Credentials** (`scope=content`) with **auto-refresh JWT**
* ✅ **Automatic retry** for 5xx/network errors (up to 3x, exponential backoff + jitter)
* ✅ **Resume/Checkpoint** per segment (continue from last point)
* ✅ **Resource filtering** (translations/tafsirs) by target language only
* ✅ **Logging** (console/file, JSON/non-JSON) + **heartbeat progress**
* ✅ **Telegram notifications** for fatal errors
* ✅ **Dev Mode (ts-node/esm)** & **Build Mode (compile to dist/)**
* ✅ **Automatic PostgreSQL importer** (without `jq`)
* ✅ **Validator** to check dataset completeness

> ⚠️ **Important**: This project exports public data through **Content APIs v4**. Please observe Qur'an Foundation's terms of service for data usage.

## 📋 Version Compatibility

### Node.js Versions
| Version | Status | Notes |
|---------|--------|-------|
| 18.x | ✅ Minimum | LTS (Active) |
| 20.x | ✅ Recommended | LTS (Recommended) |
| 22.x | ✅ Supported | Current |

### PostgreSQL Versions
| Version | Status | Features |
|---------|--------|----------|
| 13.x | ✅ Minimum | Basic JSON support |
| 14.x | ✅ Supported | Improved JSON performance |
| 15.x | ✅ Recommended | Better bulk import |
| 16.x | ✅ Latest | Optimal performance |

### OS Compatibility
- ✅ **Linux** (Ubuntu 20.04+, CentOS 8+)
- ✅ **macOS** (10.15+)
- ✅ **Windows** (10+, WSL2 recommended)
- ✅ **Docker** (Multi-platform)

---

## 📁 Project Structure

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
│   ├── http.ts         # HTTP client (token refresh + retry)
│   ├── util.ts
│   ├── endpoints.ts
│   ├── normalizers.ts
│   ├── checkpoint.ts
│   ├── logger.ts
│   ├── telegram.ts     # Telegram notifications
│   ├── run.ts          # main exporter
│   ├── import.ts       # NDJSON -> Postgres importer
│   └── validate.ts     # data validator
└── out/                # NDJSON output
```

---

## 🚀 Quick Start

### 1. Prerequisites

* **Node.js** v18+ (v20+ recommended)
* **PostgreSQL** 13+

### 2. Installation

```bash
# Clone repository
git clone <repository-url>
cd qf-export-all

# Install dependencies
npm install

# Setup environment
cp .env.example .env
```

### 3. Environment Configuration

Edit the `.env` file and fill in your credentials:

```ini
# API & OAuth
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quran_local
```

### 4. Available Scripts

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

## 📥 Running the Exporter

### Development Mode (Fast, no build required)

```bash
npm run dev:fetch
```

### Production Mode (Compile to `dist/`)

```bash
# Full export
npm run fetch

# Resume if interrupted
npm run fetch:resume
```

### Export Subset Data

Use the `ONLY` environment variable to export specific data:

```bash
ONLY=chapters,verses,words npm run dev:fetch

# Available options:
# chapters, verses, words, quran, translations, tafsirs, resources, audio, juz, search
```

### Rate Limiting Configuration

Adjust in the `.env` file:

```ini
PER_PAGE=50           # items per page
CONCURRENCY=4         # concurrent requests
SLEEP_MS=200          # delay between requests (ms)
```

---

## 💾 Resume & Checkpoint

Enable checkpointing to continue interrupted exports:

```bash
# With checkpoint
CHECKPOINT_PATH=.checkpoint.json npm run dev:fetch

# Or use resume script
npm run fetch:resume
```

**Checkpoint tracks progress for:**
- **Verses**: per surah + page
- **Quran scripts/glyphs**: per `kind + scope`
- **Translations/Tafsirs**: per `resource_id + chapter + page`
- **Audio**: per `reciter_id`
- **Single translation/tafsir**: per `resource_id + scope`

---

## 📊 Logging & Monitoring

Configure logging in `.env`:

```ini
LOG_LEVEL=info          # debug|info|warn|error
LOG_JSON=false          # true = output JSON lines
LOG_FILE=               # example: logs/qf-export.log (empty = console only)
LOG_INTERVAL_MS=10000   # heartbeat interval (ms), 0 = disabled
```

---

## 🌐 Resource Language Filtering

Filter translations/tafsirs by language:

```ini
RESOURCE_FILTER_MODE=strict   # strict|fallback|all
RESOURCE_LANG=                # defaults to LANGUAGE
RESOURCE_LANG_FALLBACK=en     # used when mode=fallback
```

**Filtering modes:**
- **strict** → only fetch resources matching target language
- **fallback** → if empty, use fallback language
- **all** → fetch all resources (legacy behavior)

**Example:**

```bash
LANGUAGE=en RESOURCE_FILTER_MODE=strict RESOURCE_LANG=id npm run dev:fetch
```

---

## 🔄 Retry & Error Handling

Configure retry behavior in `.env`:

```ini
MAX_RETRIES=3
BACKOFF_BASE_MS=500
```

**Error handling:**
- **401 (JWT expired)** → auto-refresh token, retry request
- **5xx/network errors** → retry up to `MAX_RETRIES` with exponential backoff + jitter
- **Fatal errors** → exporter stops and sends Telegram notification (if enabled)

---

## 📢 Telegram Notifications

Enable notifications for fatal errors:

```ini
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

**Setup instructions:**
1. Create a new bot via [@BotFather](https://t.me/BotFather)
2. Get the `BOT_TOKEN`
3. Get the `CHAT_ID` by sending a message to your bot, then access `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`

---

## 📄 Output Dataset (NDJSON)

Export output files in the `out/` folder:

```
out/
├── chapters.ndjson
├── chapter_infos.ndjson
├── verses.ndjson
├── words.ndjson
├── quran_uthmani_simple.ndjson
├── quran_uthmani.ndjson
├── quran_indopak.ndjson
├── quran_tajweed.ndjson
├── quran_imlaei_simple.ndjson
├── quran_code_v1.ndjson
├── quran_code_v2.ndjson
├── quran_single_translation.ndjson
├── quran_single_tafsir.ndjson
├── languages.ndjson
├── translation_resources.ndjson
├── tafsir_resources.ndjson
├── translations.ndjson
├── tafsirs.ndjson
├── recitations.ndjson
├── chapter_audio_files.ndjson
├── juzs.ndjson
└── search.ndjson
```

---

## 🗄️ PostgreSQL Import

### 1. Database Setup

```bash
# Create database
createdb quran_local

# Import schema
psql "$DATABASE_URL" -f sql/schema.sql
```

### 2. Import Data

```bash
npm run import
```

---

## ✅ Dataset Validation

Run the validator to check data consistency:

```bash
npm run validate
```

**Validator checks:**
- Row counts per core table
- Consistency of `chapters.verses_count` vs actual count in `verses`
- Verses without `words` (should ideally be 0)
- Consistency of word `position` per verse (1..N)

---

## ⚙️ Complete Configuration (.env)

```ini
# ============================================
# API & OAuth Configuration
# ============================================
BASE_URL=https://apis.quran.foundation/content/api/v4
OAUTH_TOKEN_URL=https://oauth2.quran.foundation/oauth2/token
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
LANGUAGE=en

# ============================================
# Crawl Configuration
# ============================================
PER_PAGE=50
CONCURRENCY=4
SLEEP_MS=200
ONLY=

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quran_local

# ============================================
# Checkpoint Configuration
# ============================================
CHECKPOINT_PATH=.checkpoint.json

# ============================================
# Logging Configuration
# ============================================
LOG_LEVEL=info
LOG_JSON=false
LOG_FILE=
LOG_INTERVAL_MS=10000

# ============================================
# Resource Filtering
# ============================================
RESOURCE_FILTER_MODE=strict
RESOURCE_LANG=
RESOURCE_LANG_FALLBACK=en

# ============================================
# Retry Configuration
# ============================================
MAX_RETRIES=3
BACKOFF_BASE_MS=500

# ============================================
# Telegram Notification
# ============================================
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

---

## 🔧 Troubleshooting

### Module not found (.ts/.js)
- **Dev mode (ts-node/esm)**: relative imports can use `.ts`
- **Build mode (dist)**: ensure relative imports use `.js`

### 429 Rate Limit
- Increase `SLEEP_MS` or decrease `CONCURRENCY`
- Some endpoints have strict rate limits

### Token Expired
- JWT auto-refresh is handled automatically
- Ensure `CLIENT_ID` and `CLIENT_SECRET` are correct

### Partial Data / Interrupted Export
- Run `npm run fetch:resume` to continue
- Use `CHECKPOINT_PATH` for progress tracking

### No Resources for Specific Language
- If `strict` filter returns 0 results, segment is skipped (normal)
- Try using `fallback` or `all` mode

---

## 📋 Development Tips

### TypeScript Configuration
- **Dev**: `tsconfig.dev.json` (no emit, ts-node/esm)
- **Build**: `tsconfig.build.json` (emit → `dist/`)

### Import Statements
```typescript
// ✅ Correct (with .js extension for build)
import { something } from './utils.js';

// ❌ Incorrect (missing .js, will fail in build)
import { something } from './utils';
```

### Performance Tuning
```ini
# For slow APIs
SLEEP_MS=500
CONCURRENCY=2

# For fast connections
SLEEP_MS=100
CONCURRENCY=8
```

---

## 📜 License & Compliance

### License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Data Source Attribution

This project uses data from **Quran Foundation Content APIs v4**, which incorporates data from Quran.com:

- **Quran.com**: Licensed under MIT License (Copyright © 2016 Quran.com)
- **Quran Foundation APIs**: Subject to Quran Foundation's Terms of Service

### Compliance Requirements

**⚠️ IMPORTANT**: Users must comply with:

1. **MIT License terms** for this exporter tool
2. **Quran Foundation's Terms of Service** for API usage
3. **Islamic principles** when handling sacred text
4. **Attribution requirements** when redistributing data

### Data Usage Guidelines

- ✅ **Permitted**: Personal study, research, educational use
- ✅ **Permitted**: Building Islamic applications with proper attribution
- ⚠️ **Required**: Acknowledge data sources in derivative works
- ❌ **Prohibited**: Commercial use without proper licensing
- ❌ **Prohibited**: Misrepresentation or alteration of Quranic text

For the most current terms, visit: https://quran.foundation/terms-of-service

### Disclaimer

This tool is **not officially affiliated** with Quran.com or Quran Foundation. It's an independent project that interfaces with their public APIs. Users are responsible for ensuring compliance with all applicable terms and Islamic guidelines.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

If you encounter issues:

1. Check [Issues](../../issues) for similar problems
2. Create a new issue with error details
3. Include your `.env` configuration (without sensitive credentials)
4. Include log output for debugging

---

**Made with ❤️ for the Ummah**
