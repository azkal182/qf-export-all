export function normVerse(v: any) {
  return {
    id: v.id,
    verse_key: v.verse_key,
    chapter_id: v.chapter_id,
    verse_number: v.verse_number,
    juz_number: v.juz_number ?? v.juz?.number,
    hizb_number: v.hizb_number,
    rub_el_hizb_number: v.rub_el_hizb_number,
    page_number: v.v1_page ?? v.page_number,
    text_uthmani: v.text_uthmani,
    text_imlaei_simple: v.text_imlaei_simple,
  };
}

export function* normWords(v: any) {
  if (!Array.isArray(v.words)) return;
  for (const w of v.words) {
    yield {
      id: w.id,
      verse_id: v.id,
      verse_key: v.verse_key,
      chapter_id: v.chapter_id,
      position: w.position,
      line_number: w.line_number,
      v1_page: w.v1_page ?? w.page_number,
      v2_page: w.v2_page,
      code_v1: w.code_v1,
      code_v2: w.code_v2,
      text_uthmani: w.text_uthmani,
      text_imlaei_simple: w.text_imlaei_simple,
      char_type_name: w.char_type_name,
    };
  }
}

export function normTranslation(resource_id: number, item: any) {
  return {
    resource_id,
    verse_key: item.verse_key ?? item.aya ?? item.verse?.key,
    text: item.text ?? item.body,
    footnotes: item.footnotes ?? null,
  };
}

export const normTafsir = normTranslation;

export function normRecitation(r: any) {
  return {
    id: r.id,
    reciter_name: r.name,
    style: r.style,
    relative_path: r.relative_path,
    format: r.format,
    files_size: r.files_size,
  };
}

// Normalisasi timestamps (verse-level) dari response chapterAudioTimestamps
export function normVerseTimestamps(audioFileId: number | string, item: any) {
  // item contoh: { verse_key, timestamp_from, timestamp_to, duration, segments?: [[idx,start,end],...] }
  return {
    audio_file_id: Number(audioFileId),
    verse_key: String(item.verse_key),
    from_ms: Number(item.timestamp_from ?? 0),
    to_ms: Number(item.timestamp_to ?? 0),
    duration_ms: Number(
      item.duration ??
        Number(item.timestamp_to ?? 0) - Number(item.timestamp_from ?? 0)
    ),
  };
}

// Normalisasi word-level segments (jika tersedia)
export function* normWordSegments(audioFileId: number | string, item: any) {
  // item.segments: [[word_index, start_ms, end_ms], ...]
  const segs = Array.isArray(item.segments) ? item.segments : [];
  for (const seg of segs) {
    const [word_index, start_ms, end_ms] = seg;
    yield {
      audio_file_id: Number(audioFileId),
      verse_key: String(item.verse_key),
      word_index: Number(word_index),
      start_ms: Number(start_ms),
      end_ms: Number(end_ms),
    };
  }
}
