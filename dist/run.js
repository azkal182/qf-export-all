import { api } from "./http.js";
import { ndjson, sleep, PER_PAGE, LANGUAGE, onlyWants } from "./util.js";
import { Chapters, Verses, Juz, QuranScripts, Resources, Audio, Translations, Tafsirs, Search, } from "./endpoints.js";
import { normVerse, normWords, normRecitation, } from "./normalizers.js";
import { getCP, setCP } from "./checkpoint.js";
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
function range(n1, n2) {
    return Array.from({ length: n2 - n1 + 1 }, (_, i) => n1 + i);
}
// async function fetchPaged(path: string, params: any = {}, maxPages = 999) {
//   const c = await api();
//   let page = 1;
//   while (page <= maxPages) {
//     const res = await c.get(path, {
//       params: { ...params, page, per_page: PER_PAGE, language: LANGUAGE },
//     });
//     const data = res.data;
//     yield data;
//     const total = data?.pagination?.total_pages;
//     if (!total || page >= total) break;
//     page++;
//     await sleep(Number(process.env.SLEEP_MS || 200));
//   }
// }
async function run() {
    const c = await api();
    // 1) Resources catalogs (IDs untuk downstream fetch)
    if (onlyWants("resources")) {
        // languages
        let r = await c.get(Resources.languages.path, {
            params: { language: LANGUAGE },
        });
        (r.data?.languages || []).forEach((x) => ndjson("languages.ndjson", x));
        // translations & tafsirs & recitations
        r = await c.get(Resources.translations.path, {
            params: { language: LANGUAGE },
        });
        (r.data?.translations || []).forEach((x) => ndjson("translation_resources.ndjson", x));
        r = await c.get(Resources.tafsirs.path, { params: { language: LANGUAGE } });
        (r.data?.tafsirs || []).forEach((x) => ndjson("tafsir_resources.ndjson", x));
        r = await c.get(Resources.recitations.path, {
            params: { language: LANGUAGE },
        });
        (r.data?.recitations || []).forEach((x) => ndjson("recitations.ndjson", x));
    }
    // 2) Chapters (list + info)
    if (onlyWants("chapters")) {
        const r = await c.get(Chapters.list.path, {
            params: { language: LANGUAGE },
        });
        const chapters = r.data?.chapters || [];
        chapters.forEach((ch) => ndjson("chapters.ndjson", ch));
        for (const ch of chapters) {
            const inf = await c.get(Chapters.info.path.replace("{chapter_number}", String(ch.id)), { params: { language: LANGUAGE } });
            ndjson("chapter_infos.ndjson", inf.data?.chapter || { chapter_id: ch.id });
            await sleep(Number(process.env.SLEEP_MS || 200));
        }
    }
    // 3) Verses (+ words) sweeping all scopes
    if (onlyWants("verses") || onlyWants("words")) {
        for (const s of range(1, 114)) {
            const startPage = Number(getCP("verses_by_chapter", `ch_${s}_page`, 1));
            let page = startPage;
            while (true) {
                const r = await c.get(Verses.byChapter.path.replace("{chapter_number}", String(s)), {
                    params: {
                        language: LANGUAGE,
                        page,
                        per_page: PER_PAGE,
                        words: true,
                        fields: "verse_key,words,chapter_id,verse_number,juz_number,hizb_number,rub_el_hizb_number,v1_page,text_uthmani,text_imlaei_simple",
                        word_fields: WORD_FIELDS,
                    },
                });
                const verses = r.data?.verses || [];
                if (!verses.length)
                    break;
                for (const v of verses) {
                    ndjson("verses.ndjson", normVerse(v));
                    for (const w of normWords(v))
                        ndjson("words.ndjson", w);
                }
                setCP("verses_by_chapter", `ch_${s}_page`, page);
                if (page >= (r.data?.pagination?.total_pages || page))
                    break;
                page++;
                await sleep(Number(process.env.SLEEP_MS || 200));
            }
            setCP("verses_by_chapter", `ch_${s}_done`, true);
        }
        // plus scopes by page/juz/hizb/rub/key jika ingin redundansi map
    }
    // 4) Juz (mapping)
    if (onlyWants("juz")) {
        const r = await c.get(Juz.list.path);
        (r.data?.juzs || r.data || []).forEach((j) => ndjson("juzs.ndjson", j));
    }
    // 5) Quran scripts/glyphs (semua kombinasi param umum)
    if (onlyWants("quran")) {
        const combos = [
            { key: "chapter_number", values: range(1, 114) },
            { key: "page_number", values: range(1, 604) },
            { key: "juz_number", values: range(1, 30) },
            { key: "hizb_number", values: range(1, 60) },
            { key: "rub_el_hizb_number", values: range(1, 240) },
        ];
        async function sweep(path, out) {
            for (const cset of combos) {
                for (const v of cset.values) {
                    const r = await c.get(path, { params: { [cset.key]: v } });
                    ndjson(out, { scope: cset.key, value: v, ...r.data });
                    await sleep(Number(process.env.SLEEP_MS || 200));
                }
            }
        }
        await sweep(QuranScripts.uthmani_simple.path, "quran_uthmani_simple.ndjson");
        await sweep(QuranScripts.uthmani.path, "quran_uthmani.ndjson");
        await sweep(QuranScripts.uthmani_tajweed.path, "quran_uthmani_tajweed.ndjson");
        await sweep(QuranScripts.indopak.path, "quran_indopak.ndjson");
        await sweep(QuranScripts.imlaei_simple.path, "quran_imlaei_simple.ndjson");
        await sweep(QuranScripts.code_v1.path, "quran_code_v1.ndjson");
        await sweep(QuranScripts.code_v2.path, "quran_code_v2.ndjson");
    }
    // 6) Translations & Tafsirs (iterate all resources)
    if (onlyWants("translations") || onlyWants("tafsirs")) {
        const tr = await c.get(Resources.translations.path, {
            params: { language: LANGUAGE },
        });
        const tf = await c.get(Resources.tafsirs.path, {
            params: { language: LANGUAGE },
        });
        const trs = tr.data?.translations || [];
        const tfs = tf.data?.tafsirs || [];
        for (const res of trs) {
            for (const s of range(1, 114)) {
                const r = await c.get(Translations.bySurah.path
                    .replace("{resource_id}", String(res.id))
                    .replace("{chapter_number}", String(s)), { params: { language: LANGUAGE } });
                (r.data?.translations || r.data?.result || []).forEach((x) => ndjson("translations.ndjson", { resource_id: res.id, ...x }));
                await sleep(Number(process.env.SLEEP_MS || 200));
            }
        }
        for (const res of tfs) {
            for (const s of range(1, 114)) {
                const r = await c.get(Tafsirs.bySurah.path
                    .replace("{resource_id}", String(res.id))
                    .replace("{chapter_number}", String(s)), { params: { language: LANGUAGE } });
                (r.data?.tafsirs || r.data?.result || []).forEach((x) => ndjson("tafsirs.ndjson", { resource_id: res.id, ...x }));
                await sleep(Number(process.env.SLEEP_MS || 200));
            }
        }
    }
    // 7) Audio (recitations + chapter audio files)
    if (onlyWants("audio")) {
        const r = await c.get(Audio.recitations.path, {
            params: { language: LANGUAGE },
        });
        (r.data?.recitations || []).forEach((x) => ndjson("recitations.ndjson", normRecitation(x)));
        for (const rec of r.data?.recitations || []) {
            const ra = await c.get(Audio.chapterAudioFiles.path.replace("{recitation_id}", String(rec.id)), { params: { language: LANGUAGE } });
            (ra.data?.audio_files || []).forEach((x) => ndjson("chapter_audio_files.ndjson", x));
            await sleep(Number(process.env.SLEEP_MS || 200));
        }
    }
    // 8) Search (opsional seed)
    if (onlyWants("search")) {
        const q = "bismillah"; // contoh
        const r = await c.get(Search.search.path, {
            params: { q, size: 50, page: 1, language: LANGUAGE },
        });
        ndjson("search.ndjson", r.data);
    }
    console.log("Done. NDJSON written to ./out");
}
run().catch((e) => {
    console.error("Fatal:", e?.response?.data || e.message);
    process.exit(1);
});
