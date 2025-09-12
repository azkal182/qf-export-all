// Referensi kategori & endpoint dari portal API v4. :contentReference[oaicite:1]{index=1}

export const Chapters = {
  list: { path: "/chapters", params: ["language"] }, // GET all
  info: { path: "/chapters/{chapter_number}", params: ["language"] }, // GET one
};

export const Verses = {
  byChapter: {
    path: "/verses/by_chapter/{chapter_number}",
    params: [
      "language",
      "page",
      "per_page",
      "words",
      "fields",
      "word_fields",
      "translations",
      "translation_fields",
      "tafsirs",
      "tafsir_fields",
    ],
  },
  byPage: {
    path: "/verses/by_page/{page_number}",
    params: ["language", "page", "per_page", "words", "fields", "word_fields"],
  },
  byJuz: {
    path: "/verses/by_juz/{juz_number}",
    params: ["language", "page", "per_page", "words", "fields", "word_fields"],
  },
  byHizb: {
    path: "/verses/by_hizb/{hizb_number}",
    params: ["language", "page", "per_page", "words", "fields", "word_fields"],
  },
  byRub: {
    path: "/verses/by_rub_el_hizb/{rub_el_hizb_number}",
    params: ["language", "page", "per_page", "words", "fields", "word_fields"],
  },
  byKey: {
    path: "/verses/by_key/{verse_key}",
    params: ["language", "words", "fields", "word_fields"],
  },
  random: {
    path: "/verses/random",
    params: ["language", "words", "fields", "word_fields"],
  },
};

export const Juz = {
  list: { path: "/juzs", params: [] }, // GET all juzs
};

export const QuranScripts = {
  uthmani_simple: {
    path: "/quran/verses/uthmani_simple",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  uthmani: {
    path: "/quran/verses/uthmani",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  uthmani_tajweed: {
    path: "/quran/verses/uthmani_tajweed",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  indopak: {
    path: "/quran/verses/indopak",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  imlaei_simple: {
    path: "/quran/verses/imlaei_simple",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  code_v1: {
    path: "/quran/verses/code_v1",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  code_v2: {
    path: "/quran/verses/code_v2",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
    ],
  },
  single_translation: {
    path: "/quran/translations/{resource_id}",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
      "language",
    ],
  },
  single_tafsir: {
    path: "/quran/tafsirs/{resource_id}",
    params: [
      "chapter_number",
      "page_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "verse_key",
      "language",
    ],
  },
};
// (Halaman “Quran” berisi 9 item termasuk glyph codes, scripts, single translation/tafsir). :contentReference[oaicite:2]{index=2}

export const Resources = {
  languages: { path: "/resources/languages", params: ["language"] },
  translations: { path: "/resources/translations", params: ["language"] },
  tafsirs: { path: "/resources/tafsirs", params: ["language"] },
  recitations: { path: "/resources/recitations", params: ["language"] },
  // Tambahan resources lain bila tersedia di portal (daftar 9 item). :contentReference[oaicite:3]{index=3}
};

export const Audio = {
  recitations: { path: "/recitations", params: ["language"] }, // list recitations (duplicate to resources but commonly present) :contentReference[oaicite:4]{index=4}
  recitationInfo: { path: "/recitations/{recitation_id}", params: [] },
  chapterAudioFiles: {
    path: "/chapter_recitations/{recitation_id}/audio_files",
    params: ["language"],
  },
};

export const Translations = {
  bySurah: {
    path: "/translations/{resource_id}/surah/{chapter_number}",
    params: ["language", "page", "per_page"],
  },
  byPage: {
    path: "/translations/{resource_id}/page/{page_number}",
    params: ["language", "page", "per_page"],
  },
  byJuz: {
    path: "/translations/{resource_id}/juz/{juz_number}",
    params: ["language", "page", "per_page"],
  },
  byHizb: {
    path: "/translations/{resource_id}/hizb/{hizb_number}",
    params: ["language", "page", "per_page"],
  },
  byRub: {
    path: "/translations/{resource_id}/rub_el_hizb/{rub_el_hizb_number}",
    params: ["language", "page", "per_page"],
  },
  byKey: {
    path: "/translations/{resource_id}/by_ayah/{verse_key}",
    params: ["language"],
  },
};

export const Tafsirs = {
  bySurah: {
    path: "/tafsirs/{resource_id}/surah/{chapter_number}",
    params: ["language", "page", "per_page"],
  },
  byPage: {
    path: "/tafsirs/{resource_id}/page/{page_number}",
    params: ["language", "page", "per_page"],
  },
  byJuz: {
    path: "/tafsirs/{resource_id}/juz/{juz_number}",
    params: ["language", "page", "per_page"],
  },
  byHizb: {
    path: "/tafsirs/{resource_id}/hizb/{hizb_number}",
    params: ["language", "page", "per_page"],
  },
  byRub: {
    path: "/tafsirs/{resource_id}/rub_el_hizb/{rub_el_hizb_number}",
    params: ["language", "page", "per_page"],
  },
  byKey: {
    path: "/tafsirs/{resource_id}/by_ayah/{verse_key}",
    params: ["language"],
  },
};

export const Search = {
  search: { path: "/search", params: ["q", "size", "page", "language"] }, // :contentReference[oaicite:5]{index=5}
};
