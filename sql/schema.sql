-- CREATE TABLE IF NOT EXISTS languages (
--   id SERIAL PRIMARY KEY,
--   iso_code TEXT,
--   name TEXT,
--   native_name TEXT
-- );

-- CREATE TABLE IF NOT EXISTS chapters (
--   id INTEGER PRIMARY KEY,
--   revelation_place TEXT,
--   revelation_order INTEGER,
--   bismillah_pre BOOLEAN,
--   page_start INTEGER,
--   page_end INTEGER,
--   name_simple TEXT,
--   name_arabic TEXT,
--   verses_count INTEGER
-- );

-- CREATE TABLE IF NOT EXISTS chapter_infos (
--   chapter_id INTEGER PRIMARY KEY REFERENCES chapters(id),
--   short_text TEXT,
--   source TEXT,
--   language TEXT
-- );

-- CREATE TABLE IF NOT EXISTS verses (
--   id BIGINT PRIMARY KEY,
--   verse_key TEXT UNIQUE,
--   chapter_id INTEGER REFERENCES chapters(id),
--   verse_number INTEGER,
--   juz_number INTEGER,
--   hizb_number INTEGER,
--   rub_el_hizb_number INTEGER,
--   page_number INTEGER,
--   text_uthmani TEXT,
--   text_imlaei_simple TEXT
-- );

-- CREATE TABLE IF NOT EXISTS words (
--   id BIGINT PRIMARY KEY,
--   verse_id BIGINT REFERENCES verses(id),
--   verse_key TEXT,
--   chapter_id INTEGER,
--   position INTEGER,
--   line_number INTEGER,
--   v1_page INTEGER,
--   v2_page INTEGER,
--   code_v1 TEXT,
--   code_v2 TEXT,
--   text_uthmani TEXT,
--   text_imlaei_simple TEXT,
--   char_type_name TEXT
-- );

-- CREATE TABLE IF NOT EXISTS juzs (
--   id INTEGER PRIMARY KEY,
--   data JSONB
-- );

-- CREATE TABLE IF NOT EXISTS quran_scripts (
--   id BIGSERIAL PRIMARY KEY,
--   scope TEXT,          -- chapter_number/page_number/juz_number/hizb_number/rub_el_hizb_number
--   value INTEGER,
--   kind TEXT,           -- uthmani_simple/uthmani/.../code_v1/code_v2
--   payload JSONB
-- );

-- CREATE TABLE IF NOT EXISTS translation_resources (
--   id INTEGER PRIMARY KEY,
--   name TEXT,
--   language TEXT,
--   author_name TEXT,
--   slug TEXT
-- );

-- CREATE TABLE IF NOT EXISTS tafsir_resources (
--   id INTEGER PRIMARY KEY,
--   name TEXT,
--   language TEXT,
--   author_name TEXT,
--   slug TEXT
-- );

-- CREATE TABLE IF NOT EXISTS translations (
--   resource_id INTEGER REFERENCES translation_resources(id),
--   verse_key TEXT,
--   text TEXT,
--   footnotes JSONB,
--   PRIMARY KEY (resource_id, verse_key)
-- );

-- CREATE TABLE IF NOT EXISTS tafsirs (
--   resource_id INTEGER REFERENCES tafsir_resources(id),
--   verse_key TEXT,
--   text TEXT,
--   PRIMARY KEY (resource_id, verse_key)
-- );

-- CREATE TABLE IF NOT EXISTS recitations (
--   id INTEGER PRIMARY KEY,
--   reciter_name TEXT,
--   style TEXT,
--   relative_path TEXT,
--   format TEXT,
--   files_size BIGINT
-- );

-- CREATE TABLE IF NOT EXISTS chapter_audio_files (
--   id BIGINT PRIMARY KEY,
--   chapter_id INTEGER,
--   recitation_id INTEGER REFERENCES recitations(id),
--   file_url TEXT,
--   duration_seconds INTEGER
-- );




-- Original table definitions with optimized indexes

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  iso_code TEXT,
  name TEXT,
  native_name TEXT
);

-- Indexes for languages
CREATE INDEX IF NOT EXISTS idx_languages_iso_code ON languages(iso_code);
CREATE INDEX IF NOT EXISTS idx_languages_name ON languages(name);

-- Chapters table
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

-- Indexes for chapters
CREATE INDEX IF NOT EXISTS idx_chapters_revelation_order ON chapters(revelation_order);
CREATE INDEX IF NOT EXISTS idx_chapters_revelation_place ON chapters(revelation_place);
CREATE INDEX IF NOT EXISTS idx_chapters_page_range ON chapters(page_start, page_end);
CREATE INDEX IF NOT EXISTS idx_chapters_name_simple ON chapters(name_simple);

-- Chapter infos table
CREATE TABLE IF NOT EXISTS chapter_infos (
  chapter_id INTEGER PRIMARY KEY REFERENCES chapters(id),
  short_text TEXT,
  source TEXT,
  language TEXT
);

-- Indexes for chapter_infos
CREATE INDEX IF NOT EXISTS idx_chapter_infos_language ON chapter_infos(language);

-- Verses table
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

-- Indexes for verses (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_verses_chapter_id ON verses(chapter_id);
CREATE INDEX IF NOT EXISTS idx_verses_chapter_verse ON verses(chapter_id, verse_number);
CREATE INDEX IF NOT EXISTS idx_verses_juz_number ON verses(juz_number);
CREATE INDEX IF NOT EXISTS idx_verses_hizb_number ON verses(hizb_number);
CREATE INDEX IF NOT EXISTS idx_verses_rub_el_hizb_number ON verses(rub_el_hizb_number);
CREATE INDEX IF NOT EXISTS idx_verses_page_number ON verses(page_number);
CREATE INDEX IF NOT EXISTS idx_verses_verse_key ON verses(verse_key);
-- Composite index for common range queries
CREATE INDEX IF NOT EXISTS idx_verses_chapter_range ON verses(chapter_id, verse_number, juz_number);
-- Full text search indexes for Arabic text
CREATE INDEX IF NOT EXISTS idx_verses_text_uthmani_gin ON verses USING gin(to_tsvector('arabic', text_uthmani));
CREATE INDEX IF NOT EXISTS idx_verses_text_imlaei_gin ON verses USING gin(to_tsvector('arabic', text_imlaei_simple));

-- Words table
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

-- Indexes for words
CREATE INDEX IF NOT EXISTS idx_words_verse_id ON words(verse_id);
CREATE INDEX IF NOT EXISTS idx_words_verse_key ON words(verse_key);
CREATE INDEX IF NOT EXISTS idx_words_chapter_id ON words(chapter_id);
CREATE INDEX IF NOT EXISTS idx_words_position ON words(verse_id, position);
CREATE INDEX IF NOT EXISTS idx_words_line_number ON words(line_number);
CREATE INDEX IF NOT EXISTS idx_words_page_v1 ON words(v1_page);
CREATE INDEX IF NOT EXISTS idx_words_page_v2 ON words(v2_page);
CREATE INDEX IF NOT EXISTS idx_words_char_type ON words(char_type_name);
-- Composite index for word lookup within verse
CREATE INDEX IF NOT EXISTS idx_words_verse_position ON words(verse_id, position);
-- Full text search for words
CREATE INDEX IF NOT EXISTS idx_words_text_uthmani_gin ON words USING gin(to_tsvector('arabic', text_uthmani));

-- Juzs table
CREATE TABLE IF NOT EXISTS juzs (
  id INTEGER PRIMARY KEY,
  data JSONB
);

-- GIN index for JSONB data
CREATE INDEX IF NOT EXISTS idx_juzs_data_gin ON juzs USING gin(data);

-- Quran scripts table
CREATE TABLE IF NOT EXISTS quran_scripts (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT,          -- chapter_number/page_number/juz_number/hizb_number/rub_el_hizb_number
  value INTEGER,
  kind TEXT,           -- uthmani_simple/uthmani/.../code_v1/code_v2
  payload JSONB
);

-- Indexes for quran_scripts
CREATE INDEX IF NOT EXISTS idx_quran_scripts_scope ON quran_scripts(scope);
CREATE INDEX IF NOT EXISTS idx_quran_scripts_value ON quran_scripts(value);
CREATE INDEX IF NOT EXISTS idx_quran_scripts_kind ON quran_scripts(kind);
CREATE INDEX IF NOT EXISTS idx_quran_scripts_scope_value ON quran_scripts(scope, value);
CREATE INDEX IF NOT EXISTS idx_quran_scripts_scope_kind ON quran_scripts(scope, kind);
CREATE INDEX IF NOT EXISTS idx_quran_scripts_payload_gin ON quran_scripts USING gin(payload);

-- Translation resources table
CREATE TABLE IF NOT EXISTS translation_resources (
  id INTEGER PRIMARY KEY,
  name TEXT,
  language TEXT,
  author_name TEXT,
  slug TEXT
);

-- Indexes for translation_resources
CREATE INDEX IF NOT EXISTS idx_translation_resources_language ON translation_resources(language);
CREATE INDEX IF NOT EXISTS idx_translation_resources_slug ON translation_resources(slug);
CREATE INDEX IF NOT EXISTS idx_translation_resources_author ON translation_resources(author_name);

-- Tafsir resources table
CREATE TABLE IF NOT EXISTS tafsir_resources (
  id INTEGER PRIMARY KEY,
  name TEXT,
  language TEXT,
  author_name TEXT,
  slug TEXT
);

-- Indexes for tafsir_resources
CREATE INDEX IF NOT EXISTS idx_tafsir_resources_language ON tafsir_resources(language);
CREATE INDEX IF NOT EXISTS idx_tafsir_resources_slug ON tafsir_resources(slug);
CREATE INDEX IF NOT EXISTS idx_tafsir_resources_author ON tafsir_resources(author_name);

-- Translations table
CREATE TABLE IF NOT EXISTS translations (
  resource_id INTEGER REFERENCES translation_resources(id),
  verse_key TEXT,
  text TEXT,
  footnotes JSONB,
  PRIMARY KEY (resource_id, verse_key)
);

-- Indexes for translations
CREATE INDEX IF NOT EXISTS idx_translations_verse_key ON translations(verse_key);
CREATE INDEX IF NOT EXISTS idx_translations_resource_id ON translations(resource_id);
CREATE INDEX IF NOT EXISTS idx_translations_footnotes_gin ON translations USING gin(footnotes);
-- Full text search for translation text
CREATE INDEX IF NOT EXISTS idx_translations_text_gin ON translations USING gin(to_tsvector('english', text));

-- Tafsirs table
CREATE TABLE IF NOT EXISTS tafsirs (
  resource_id INTEGER REFERENCES tafsir_resources(id),
  verse_key TEXT,
  text TEXT,
  PRIMARY KEY (resource_id, verse_key)
);

-- Indexes for tafsirs
CREATE INDEX IF NOT EXISTS idx_tafsirs_verse_key ON tafsirs(verse_key);
CREATE INDEX IF NOT EXISTS idx_tafsirs_resource_id ON tafsirs(resource_id);
-- Full text search for tafsir text
CREATE INDEX IF NOT EXISTS idx_tafsirs_text_gin ON tafsirs USING gin(to_tsvector('arabic', text));

-- Recitations table
CREATE TABLE IF NOT EXISTS recitations (
  id INTEGER PRIMARY KEY,
  reciter_name TEXT,
  style TEXT,
  relative_path TEXT,
  format TEXT,
  files_size BIGINT
);

-- Indexes for recitations
CREATE INDEX IF NOT EXISTS idx_recitations_reciter_name ON recitations(reciter_name);
CREATE INDEX IF NOT EXISTS idx_recitations_style ON recitations(style);
CREATE INDEX IF NOT EXISTS idx_recitations_format ON recitations(format);

-- Chapter audio files table
CREATE TABLE IF NOT EXISTS chapter_audio_files (
  id BIGINT PRIMARY KEY,
  chapter_id INTEGER,
  recitation_id INTEGER REFERENCES recitations(id),
  file_url TEXT,
  duration_seconds INTEGER
);

-- Indexes for chapter_audio_files
CREATE INDEX IF NOT EXISTS idx_chapter_audio_files_chapter_id ON chapter_audio_files(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_files_recitation_id ON chapter_audio_files(recitation_id);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_files_chapter_recitation ON chapter_audio_files(chapter_id, recitation_id);
CREATE INDEX IF NOT EXISTS idx_chapter_audio_files_duration ON chapter_audio_files(duration_seconds);

-- Additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_verses_juz_page ON verses(juz_number, page_number);
CREATE INDEX IF NOT EXISTS idx_words_chapter_verse ON words(chapter_id, verse_id);
CREATE INDEX IF NOT EXISTS idx_translations_multi_lookup ON translations(verse_key, resource_id);

-- Performance monitoring queries (optional - for checking index usage)
/*
-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
*/
