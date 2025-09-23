import { api } from "./http.js";
import { ndjson, sleep, PER_PAGE, LANGUAGE, onlyWants } from "./util.js";
import {
  Chapters,
  Verses,
  Juz,
  QuranScripts,
  Resources,
  Audio,
  Translations,
  Tafsirs,
  Search,
} from "./endpoints.js";
import {
  normVerse,
  normWords,
  normRecitation,
  normVerseTimestamps,
  normWordSegments,
} from "./normalizers.js";
import { getCP, setCP } from "./checkpoint.js";
import { log, startHeartbeat, stopHeartbeat } from "./logger.js";

const WORD_FIELDS = [
  "id",
  "position",
  "line_number",
  "v1_page",
  "v2_page",
  "code_v1",
  "code_v2",
  "text_uthmani",
  "text_imlaei_simple",
  "char_type_name",
].join(",");

function wantedResourceLang(): string {
  return (
    process.env.RESOURCE_LANG ||
    process.env.LANGUAGE ||
    "en"
  ).toLowerCase();
}

function normalizeLangCode(input?: string): string {
  if (!input) return "";
  // kebanyakan API pakai 'en','ar','id', dst — normalisasikan saja ke lower-case 2-5 char
  return input.toLowerCase().trim();
}

// Cek apakah resource match bahasa target.
// Properti yang sering muncul: language, language_name, iso_code, language_code, etc.
// Kita coba beberapa kemungkinan.
function resourceMatchesLang(res: any, target: string): boolean {
  const t = normalizeLangCode(target);

  const candidates = [
    normalizeLangCode(res.language),
    normalizeLangCode(res.language_code),
    normalizeLangCode(res.iso_code),
  ].filter(Boolean);

  if (candidates.includes(t)) return true;

  // fallback: cek berdasarkan nama bahasa (mis. "Indonesian", "Bahasa Indonesia")
  const ln = String(res.language_name || res.name || "").toLowerCase();
  if (t === "id" && (ln.includes("indones") || ln.includes("bahasa")))
    return true;
  if (t === "en" && ln.includes("english")) return true;
  if (t === "ar" && (ln.includes("arab") || ln.includes("العرب"))) return true;

  return false;
}

function range(n1: number, n2: number) {
  return Array.from({ length: n2 - n1 + 1 }, (_, i) => n1 + i);
}

async function run() {
  log.info("export started", {
    BASE_URL: process.env.BASE_URL,
    LANGUAGE: process.env.LANGUAGE,
    PER_PAGE: process.env.PER_PAGE,
    ONLY: process.env.ONLY || "(all)",
  });

  // progress snapshot untuk heartbeat
  const progress = {
    chapters_done: 0,
    verses_ch_done: 0,
    verses_total_pages: 0,
    verses_last: { chapter: 0, page: 0 },
    q_kind: "",
    q_scope: "",
    q_value: 0,
    quran_scripts_done: 0,
    translations_done: 0,
    tafsirs_done: 0,
    audio_reciters_done: 0,
  };

  startHeartbeat(() => ({ ...progress }));

  const c = await api();

  // 1) Resources catalogs (IDs untuk downstream fetch)
  if (onlyWants("resources")) {
    log.info("resources: fetching catalogs");

    const langForMeta = LANGUAGE;

    // languages
    let r = await c.get(Resources.languages.path, {
      params: { language: langForMeta },
    });
    (r.data?.languages || []).forEach((x: any) =>
      ndjson("languages.ndjson", x)
    );

    // translations
    r = await c.get(Resources.translations.path, {
      params: { language: langForMeta },
    });
    const allTr = r.data?.translations || [];
    const target = wantedResourceLang();
    const mode = (process.env.RESOURCE_FILTER_MODE || "strict").toLowerCase();

    const trFiltered =
      mode === "all"
        ? allTr
        : allTr.filter((x: any) => resourceMatchesLang(x, target));

    log.info("resources: translations catalog", {
      mode,
      target,
      total: allTr.length,
      filtered: trFiltered.length,
    });
    trFiltered.forEach((x: any) => ndjson("translation_resources.ndjson", x));

    // tafsirs
    r = await c.get(Resources.tafsirs.path, {
      params: { language: langForMeta },
    });
    const allTf = r.data?.tafsirs || [];
    const tfFiltered =
      mode === "all"
        ? allTf
        : allTf.filter((x: any) => resourceMatchesLang(x, target));

    log.info("resources: tafsirs catalog", {
      mode,
      target,
      total: allTf.length,
      filtered: tfFiltered.length,
    });
    tfFiltered.forEach((x: any) => ndjson("tafsir_resources.ndjson", x));

    // recitations (tidak difilter bahasa)
    r = await c.get(Resources.recitations.path, {
      params: { language: langForMeta },
    });
    (r.data?.recitations || []).forEach((x: any) =>
      ndjson("recitations.ndjson", x)
    );

    log.info("resources: done");
  }

  // 2) Chapters (list + info)
  if (onlyWants("chapters")) {
    log.info("chapters: list + info");

    const r = await c.get(Chapters.list.path, {
      params: { language: LANGUAGE },
    });
    const chapters = r.data?.chapters || [];
    chapters.forEach((ch: any) => ndjson("chapters.ndjson", ch));
    for (const ch of chapters) {
      const inf = await c.get(
        Chapters.info.path.replace("{chapter_number}", String(ch.id)),
        { params: { language: LANGUAGE } }
      );
      ndjson(
        "chapter_infos.ndjson",
        inf.data?.chapter || { chapter_id: ch.id }
      );
      await sleep(Number(process.env.SLEEP_MS || 200));
    }
    progress.chapters_done = (r.data?.chapters || []).length;
    log.info("chapters: done", { count: progress.chapters_done });
  }

  // 3) Verses (+ words) sweeping by chapter, with resume per chapter/page
  if (onlyWants("verses") || onlyWants("words")) {
    for (const s of range(1, 114)) {
      log.info("verses: chapter start", { chapter: s });

      const startPage = Number(getCP("verses_by_chapter", `ch_${s}_page`, 1));
      let page = startPage;

      while (true) {
        const r = await c.get(
          Verses.byChapter.path.replace("{chapter_number}", String(s)),
          {
            params: {
              language: LANGUAGE,
              page,
              per_page: PER_PAGE,
              words: true,
              fields:
                "verse_key,words,chapter_id,verse_number,juz_number,hizb_number,rub_el_hizb_number,v1_page,text_uthmani,text_imlaei_simple",
              word_fields: WORD_FIELDS,
            },
          }
        );

        const verses = r.data?.verses || [];
        if (!verses.length) break;

        for (const v of verses) {
          ndjson("verses.ndjson", normVerse(v));
          for (const w of normWords(v)) ndjson("words.ndjson", w);
        }

        // checkpoint & progress
        setCP("verses_by_chapter", `ch_${s}_page`, page);
        progress.verses_ch_done = s;
        progress.verses_total_pages++;
        progress.verses_last = { chapter: s, page };
        log.debug("verses: page done", {
          chapter: s,
          page,
          total_pages: r.data?.pagination?.total_pages,
        });

        const totalPages = r.data?.pagination?.total_pages || page;
        if (page >= totalPages) break;
        page++;
        await sleep(Number(process.env.SLEEP_MS || 200));
      }

      setCP("verses_by_chapter", `ch_${s}_done`, true);
      log.info("verses: chapter done", { chapter: s });
    }
    log.info("verses: all chapters done");
  }

  // 4) Juz (mapping/catalog)
  if (onlyWants("juz")) {
    log.info("juz: fetching list");
    const r = await c.get(Juz.list.path);
    (r.data?.juzs || r.data || []).forEach((j: any) =>
      ndjson("juzs.ndjson", j)
    );
    log.info("juz: done");
  }

  // 5) Quran scripts/glyphs with resume per kind+scope
  if (onlyWants("quran")) {
    const scripts = [
      { kind: "uthmani_simple", path: QuranScripts.uthmani_simple.path },
      { kind: "uthmani", path: QuranScripts.uthmani.path },
      { kind: "uthmani_tajweed", path: QuranScripts.uthmani_tajweed.path },
      { kind: "indopak", path: QuranScripts.indopak.path },
      { kind: "imlaei_simple", path: QuranScripts.imlaei_simple.path },
      { kind: "code_v1", path: QuranScripts.code_v1.path },
      { kind: "code_v2", path: QuranScripts.code_v2.path },
    ];

    const scopes = [
      { key: "chapter_number", values: range(1, 114) },
      { key: "page_number", values: range(1, 604) },
      { key: "juz_number", values: range(1, 30) },
      { key: "hizb_number", values: range(1, 60) },
      { key: "rub_el_hizb_number", values: range(1, 240) },
    ];

    log.info("quran: scripts sweep start");

    for (const sc of scopes) {
      for (const s of scripts) {
        const last = Number(getCP(`quran_${s.kind}`, sc.key, 0));
        for (const v of sc.values) {
          if (v <= last) continue;

          const r = await c.get(s.path, { params: { [sc.key]: v } });
          ndjson("quran_scripts.ndjson", {
            kind: s.kind,
            scope: sc.key,
            value: v,
            payload: r.data,
          });

          setCP(`quran_${s.kind}`, sc.key, v);
          progress.q_kind = s.kind;
          progress.q_scope = sc.key;
          progress.q_value = v;
          progress.quran_scripts_done++;
          log.debug("quran: fetched", {
            kind: s.kind,
            scope: sc.key,
            value: v,
          });

          await sleep(Number(process.env.SLEEP_MS || 200));
        }
        setCP(`quran_${s.kind}`, `${sc.key}_done`, true);
      }
    }
    log.info("quran: scripts done", { fetched: progress.quran_scripts_done });

    // === Quran: single translation / single tafsir (FILTERED by resource language) ===
    {
      const langForMeta = LANGUAGE;
      const target = wantedResourceLang();
      const mode = (process.env.RESOURCE_FILTER_MODE || "strict").toLowerCase();
      const fallback = (
        process.env.RESOURCE_LANG_FALLBACK || "en"
      ).toLowerCase();

      // ambil katalog translations & tafsirs untuk di-filter
      const tr = await c.get(Resources.translations.path, {
        params: { language: langForMeta },
      });
      const tf = await c.get(Resources.tafsirs.path, {
        params: { language: langForMeta },
      });

      let trs = tr.data?.translations || [];
      let tfs = tf.data?.tafsirs || [];

      // filter translation resources
      let trsFiltered = trs;
      if (mode !== "all") {
        trsFiltered = trs.filter((x: any) => resourceMatchesLang(x, target));
        if (mode === "fallback" && trsFiltered.length === 0) {
          log.warn(
            "quran/single_translation: no resource matched target, using fallback",
            { target, fallback }
          );
          trsFiltered = trs.filter((x: any) =>
            resourceMatchesLang(x, fallback)
          );
        }
      }
      log.info("quran/single_translation: resources to fetch", {
        count: trsFiltered.length,
        mode,
        target,
      });

      // filter tafsir resources
      let tfsFiltered = tfs;
      if (mode !== "all") {
        tfsFiltered = tfs.filter((x: any) => resourceMatchesLang(x, target));
        if (mode === "fallback" && tfsFiltered.length === 0) {
          log.warn(
            "quran/single_tafsir: no resource matched target, using fallback",
            { target, fallback }
          );
          tfsFiltered = tfs.filter((x: any) =>
            resourceMatchesLang(x, fallback)
          );
        }
      }
      log.info("quran/single_tafsir: resources to fetch", {
        count: tfsFiltered.length,
        mode,
        target,
      });

      // scopes yang didukung endpoint quran/*: per chapter/page/juz/hizb/rub + verse_key
      const scopes = [
        { key: "chapter_number", values: range(1, 114) },
        { key: "page_number", values: range(1, 604) },
        { key: "juz_number", values: range(1, 30) },
        { key: "hizb_number", values: range(1, 60) },
        { key: "rub_el_hizb_number", values: range(1, 240) },
      ];

      // ---- single translation (per resource) ----
      for (const res of trsFiltered) {
        for (const sc of scopes) {
          const last = Number(
            getCP(`quran_single_translation_res_${res.id}`, sc.key, 0)
          );
          for (const v of sc.values) {
            if (v <= last) continue;

            const path = QuranScripts.single_translation.path.replace(
              "{resource_id}",
              String(res.id)
            );
            const r = await c.get(path, {
              params: { [sc.key]: v, language: langForMeta },
            });

            ndjson("quran_single_translation.ndjson", {
              resource_id: res.id,
              scope: sc.key,
              value: v,
              payload: r.data,
            });

            setCP(`quran_single_translation_res_${res.id}`, sc.key, v);
            log.debug("quran/single_translation: fetched", {
              resource_id: res.id,
              scope: sc.key,
              value: v,
            });

            await sleep(Number(process.env.SLEEP_MS || 200));
          }
          setCP(
            `quran_single_translation_res_${res.id}`,
            `${sc.key}_done`,
            true
          );
        }
      }

      // ---- single tafsir (per resource) ----
      for (const res of tfsFiltered) {
        for (const sc of scopes) {
          const last = Number(
            getCP(`quran_single_tafsir_res_${res.id}`, sc.key, 0)
          );
          for (const v of sc.values) {
            if (v <= last) continue;

            const path = QuranScripts.single_tafsir.path.replace(
              "{resource_id}",
              String(res.id)
            );
            const r = await c.get(path, {
              params: { [sc.key]: v, language: langForMeta },
            });

            ndjson("quran_single_tafsir.ndjson", {
              resource_id: res.id,
              scope: sc.key,
              value: v,
              payload: r.data,
            });

            setCP(`quran_single_tafsir_res_${res.id}`, sc.key, v);
            log.debug("quran/single_tafsir: fetched", {
              resource_id: res.id,
              scope: sc.key,
              value: v,
            });

            await sleep(Number(process.env.SLEEP_MS || 200));
          }
          setCP(`quran_single_tafsir_res_${res.id}`, `${sc.key}_done`, true);
        }
      }

      log.info("quran: single translation/tafsir done", {
        translations_resources: trsFiltered.length,
        tafsirs_resources: tfsFiltered.length,
      });
    }
  }

  // 6) Translations & Tafsirs (iterate all resources) with resume per resource+chapter+page
  if (onlyWants("translations")) {
    const langForMeta = LANGUAGE;
    const target = wantedResourceLang();
    const mode = (process.env.RESOURCE_FILTER_MODE || "strict").toLowerCase();
    const fallback = (process.env.RESOURCE_LANG_FALLBACK || "en").toLowerCase();

    const tr = await c.get(Resources.translations.path, {
      params: { language: langForMeta },
    });
    let trs = tr.data?.translations || [];

    let trsFiltered = trs;
    if (mode !== "all") {
      trsFiltered = trs.filter((x: any) => resourceMatchesLang(x, target));
      if (mode === "fallback" && trsFiltered.length === 0) {
        log.warn("translations: no resource matched target, using fallback", {
          target,
          fallback,
        });
        trsFiltered = trs.filter((x: any) => resourceMatchesLang(x, fallback));
      }
    }

    log.info("translations: resources to fetch", {
      count: trsFiltered.length,
      mode,
      target,
    });

    for (const res of trsFiltered) {
      log.info("translations: resource start", {
        resource_id: res.id,
        name: res.name,
      });

      for (const s of range(1, 114)) {
        let page = Number(
          getCP(`translations_res_${res.id}`, `ch_${s}_page`, 1)
        );
        while (true) {
          const r = await c.get(
            Translations.bySurah.path
              .replace("{resource_id}", String(res.id))
              .replace("{chapter_number}", String(s)),
            { params: { language: langForMeta, page, per_page: PER_PAGE } }
          );

          const items = r.data?.translations || r.data?.result || [];
          if (!items.length) break;

          for (const x of items) {
            ndjson("translations.ndjson", { resource_id: res.id, ...x });
          }

          setCP(`translations_res_${res.id}`, `ch_${s}_page`, page);
          log.debug("translations: page", {
            resource_id: res.id,
            chapter: s,
            page,
            count: items.length,
          });

          const total = r.data?.pagination?.total_pages || page;
          if (page >= total) break;
          page++;
          await sleep(Number(process.env.SLEEP_MS || 200));
        }
        setCP(`translations_res_${res.id}`, `ch_${s}_done`, true);
      }

      progress.translations_done++;
      setCP("translations", `res_${res.id}_done`, true);
      log.info("translations: resource done", { resource_id: res.id });
    }
    log.info("translations: all done", {
      resources: progress.translations_done,
    });
  }

  if (onlyWants("tafsirs")) {
    const langForMeta = LANGUAGE;
    const target = wantedResourceLang();
    const mode = (process.env.RESOURCE_FILTER_MODE || "strict").toLowerCase();
    const fallback = (process.env.RESOURCE_LANG_FALLBACK || "en").toLowerCase();

    const tf = await c.get(Resources.tafsirs.path, {
      params: { language: langForMeta },
    });
    let tfs = tf.data?.tafsirs || [];

    let tfsFiltered = tfs;
    if (mode !== "all") {
      tfsFiltered = tfs.filter((x: any) => resourceMatchesLang(x, target));
      if (mode === "fallback" && tfsFiltered.length === 0) {
        log.warn("tafsirs: no resource matched target, using fallback", {
          target,
          fallback,
        });
        tfsFiltered = tfs.filter((x: any) => resourceMatchesLang(x, fallback));
      }
    }

    log.info("tafsirs: resources to fetch", {
      count: tfsFiltered.length,
      mode,
      target,
    });

    for (const res of tfsFiltered) {
      log.info("tafsirs: resource start", {
        resource_id: res.id,
        name: res.name,
      });

      for (const s of range(1, 114)) {
        let page = Number(getCP(`tafsirs_res_${res.id}`, `ch_${s}_page`, 1));
        while (true) {
          const r = await c.get(
            Tafsirs.bySurah.path
              .replace("{resource_id}", String(res.id))
              .replace("{chapter_number}", String(s)),
            { params: { language: langForMeta, page, per_page: PER_PAGE } }
          );

          const items = r.data?.tafsirs || r.data?.result || [];
          if (!items.length) break;

          for (const x of items) {
            ndjson("tafsirs.ndjson", { resource_id: res.id, ...x });
          }

          setCP(`tafsirs_res_${res.id}`, `ch_${s}_page`, page);
          log.debug("tafsirs: page", {
            resource_id: res.id,
            chapter: s,
            page,
            count: items.length,
          });

          const total = r.data?.pagination?.total_pages || page;
          if (page >= total) break;
          page++;
          await sleep(Number(process.env.SLEEP_MS || 200));
        }
        setCP(`tafsirs_res_${res.id}`, `ch_${s}_done`, true);
      }

      progress.tafsirs_done++;
      setCP("tafsirs", `res_${res.id}_done`, true);
      log.info("tafsirs: resource done", { resource_id: res.id });
    }
    log.info("tafsirs: all done", { resources: progress.tafsirs_done });
  }

  // 7) Audio (recitations + chapter audio files) with resume per reciter id
  if (onlyWants("audio")) {
    log.info("audio: recitations catalog");
    const r = await c.get(Audio.recitations.path, {
      params: { language: LANGUAGE },
    });
    (r.data?.recitations || []).forEach((x: any) =>
      ndjson("recitations.ndjson", normRecitation(x))
    );

    log.info("audio: chapter_audio_files start");
    for (const rec of r.data?.recitations || []) {
      if (getCP("audio", `reciter_${rec.id}_done`, false)) {
        log.debug("audio: skip reciter (already done)", { reciter_id: rec.id });
        continue;
      }

      log.debug("audio: reciter", { reciter_id: rec.id, name: rec.name });
      const ra = await c.get(
        Audio.chapterAudioFiles.path.replace("{recitation_id}", String(rec.id)),
        { params: { language: LANGUAGE } }
      );
      (ra.data?.audio_files || []).forEach((x: any) =>
        ndjson("chapter_audio_files.ndjson", x)
      );

      setCP("audio", `reciter_${rec.id}_done`, true);
      progress.audio_reciters_done++;
      await sleep(Number(process.env.SLEEP_MS || 200));
    }
    log.info("audio: chapter_audio_files done", {
      reciters: progress.audio_reciters_done,
    });
  }

  // === AUDIO SEGMENTS (chapter-level timestamps & word segments) ===
  if (
    onlyWants("audio") ||
    String(process.env.AUDIO_SEGMENTS || "false").toLowerCase() === "true"
  ) {
    const enableSegments =
      String(process.env.AUDIO_SEGMENTS || "false").toLowerCase() === "true";
    if (!enableSegments) {
      log.info("audio-segments: disabled (AUDIO_SEGMENTS=false) — skip");
    } else {
      log.info("audio-segments: start");

      // Ambil katalog recitations
      const recRes = await c.get(Audio.recitations.path, {
        params: { language: LANGUAGE },
      });
      const reciters = recRes.data?.recitations || [];

      // Filter reciter jika diset
      const recFilter = (process.env.AUDIO_SEGMENTS_RECITERS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number);
      const recList = recFilter.length
        ? reciters.filter((r: any) => recFilter.includes(Number(r.id)))
        : reciters;

      // Siapkan daftar chapter
      const chEnv = String(process.env.AUDIO_SEGMENTS_CHAPTERS || "").trim();
      let chapters: number[] = [];
      if (chEnv) {
        // parse "1-3,5,7-9"
        for (const token of chEnv.split(",")) {
          const t = token.trim();
          if (!t) continue;
          if (t.includes("-")) {
            const [a, b] = t.split("-").map((x) => Number(x.trim()));
            if (Number.isFinite(a) && Number.isFinite(b)) {
              const lo = Math.min(a, b),
                hi = Math.max(a, b);
              for (let i = lo; i <= hi; i++) chapters.push(i);
            }
          } else {
            const n = Number(t);
            if (Number.isFinite(n)) chapters.push(n);
          }
        }
      } else {
        chapters = Array.from({ length: 114 }, (_, i) => i + 1);
      }

      // Loop reciter → chapter (RESUME per reciter+chapter)
      for (const rec of recList) {
        for (const ch of chapters) {
          const lastDone = getCP(
            "audio_segments",
            `rec_${rec.id}_ch_${ch}_done`,
            false
          );
          if (lastDone) {
            log.debug("audio-segments: skip (done)", {
              reciter_id: rec.id,
              chapter: ch,
            });
            continue;
          }

          // panggil endpoint chapter-level timestamps
          const path = Audio.chapterAudioTimestamps.path
            .replace("{recitation_id}", String(rec.id))
            .replace("{chapter_number}", String(ch));

          // segments=true agar dapat word-level segments (jika tersedia)
          const r = await c.get(path, {
            params: { language: LANGUAGE, segments: true },
          });

          // Normalisasi & simpan
          const audioFile = r.data?.audio_file || r.data || {};
          const audioFileId = audioFile.id ?? audioFile.audio_file?.id;
          const timestamps = r.data?.timestamps || audioFile.timestamps || [];

          // mungkin beberapa reciter tidak punya timestamps
          if (
            !audioFileId ||
            !Array.isArray(timestamps) ||
            timestamps.length === 0
          ) {
            log.warn("audio-segments: no timestamps", {
              reciter_id: rec.id,
              chapter: ch,
            });
            setCP("audio_segments", `rec_${rec.id}_ch_${ch}_done`, true);
            await sleep(Number(process.env.SLEEP_MS || 200));
            continue;
          }

          for (const item of timestamps) {
            // verse-level timestamps
            const vt = normVerseTimestamps(audioFileId, item);
            ndjson("verse_timestamps.ndjson", vt);

            // word-level segments (jika ada)
            for (const ws of normWordSegments(audioFileId, item)) {
              ndjson("word_segments.ndjson", ws);
            }
          }

          setCP("audio_segments", `rec_${rec.id}_ch_${ch}_done`, true);
          log.debug("audio-segments: chapter done", {
            reciter_id: rec.id,
            chapter: ch,
            items: timestamps.length,
          });
          await sleep(Number(process.env.SLEEP_MS || 200));
        }
      }

      log.info("audio-segments: done");
    }
  }

  // 8) Search (opsional seed)
  //   if (onlyWants("search")) {
  //     const q = "bismillah"; // contoh
  //     const r = await c.get(Search.search.path, {
  //       params: { q, size: 50, page: 1, language: LANGUAGE },
  //     });
  //     ndjson("search.ndjson", r.data);
  //   }

  stopHeartbeat();
  log.info("export finished ✅");
}

run().catch((e) => {
  log.error("export failed", {
    error: (e as any)?.message || String(e),
    data: (e as any)?.response?.data,
  });
  stopHeartbeat();
  process.exit(1);
});
