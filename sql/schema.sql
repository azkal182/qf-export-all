CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  iso_code TEXT,
  name TEXT,
  native_name TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY,
  revelation_place TEXT,
  revelation_order INTEGER,
  bismillah_pre BOOLEAN,
  page_start INTEGER,
  page_end INTEGER,
  name_simple TEXT,
  name_arabic TEXT,
  verses_count INTEGER
);

CREATE TABLE IF NOT EXISTS chapter_infos (
  chapter_id INTEGER PRIMARY KEY REFERENCES chapters(id),
  short_text TEXT,
  source TEXT,
  language TEXT
);

CREATE TABLE IF NOT EXISTS verses (
  id BIGINT PRIMARY KEY,
  verse_key TEXT UNIQUE,
  chapter_id INTEGER REFERENCES chapters(id),
  verse_number INTEGER,
  juz_number INTEGER,
  hizb_number INTEGER,
  rub_el_hizb_number INTEGER,
  page_number INTEGER,
  text_uthmani TEXT,
  text_imlaei_simple TEXT
);

CREATE TABLE IF NOT EXISTS words (
  id BIGINT PRIMARY KEY,
  verse_id BIGINT REFERENCES verses(id),
  verse_key TEXT,
  chapter_id INTEGER,
  position INTEGER,
  line_number INTEGER,
  v1_page INTEGER,
  v2_page INTEGER,
  code_v1 TEXT,
  code_v2 TEXT,
  text_uthmani TEXT,
  text_imlaei_simple TEXT,
  char_type_name TEXT
);

CREATE TABLE IF NOT EXISTS juzs (
  id INTEGER PRIMARY KEY,
  data JSONB
);

CREATE TABLE IF NOT EXISTS quran_scripts (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT,          -- chapter_number/page_number/juz_number/hizb_number/rub_el_hizb_number
  value INTEGER,
  kind TEXT,           -- uthmani_simple/uthmani/.../code_v1/code_v2
  payload JSONB
);

CREATE TABLE IF NOT EXISTS translation_resources (
  id INTEGER PRIMARY KEY,
  name TEXT,
  language TEXT,
  author_name TEXT,
  slug TEXT
);

CREATE TABLE IF NOT EXISTS tafsir_resources (
  id INTEGER PRIMARY KEY,
  name TEXT,
  language TEXT,
  author_name TEXT,
  slug TEXT
);

CREATE TABLE IF NOT EXISTS translations (
  resource_id INTEGER REFERENCES translation_resources(id),
  verse_key TEXT,
  text TEXT,
  footnotes JSONB,
  PRIMARY KEY (resource_id, verse_key)
);

CREATE TABLE IF NOT EXISTS tafsirs (
  resource_id INTEGER REFERENCES tafsir_resources(id),
  verse_key TEXT,
  text TEXT,
  PRIMARY KEY (resource_id, verse_key)
);

CREATE TABLE IF NOT EXISTS recitations (
  id INTEGER PRIMARY KEY,
  reciter_name TEXT,
  style TEXT,
  relative_path TEXT,
  format TEXT,
  files_size BIGINT
);

CREATE TABLE IF NOT EXISTS chapter_audio_files (
  id BIGINT PRIMARY KEY,
  chapter_id INTEGER,
  recitation_id INTEGER REFERENCES recitations(id),
  file_url TEXT,
  duration_seconds INTEGER
);
