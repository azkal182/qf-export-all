import "dotenv/config";
import fs from "node:fs";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL in .env");
  process.exit(1);
}

const outdir = "out";

type MapSpec = {
  file: string;
  table: string;
  columns: string[];
  map: (o: any) => any[];
};

const maps: MapSpec[] = [
  {
    file: "chapters.ndjson",
    table: "chapters",
    columns: [
      "id",
      "revelation_place",
      "revelation_order",
      "bismillah_pre",
      "page_start",
      "page_end",
      "name_simple",
      "name_arabic",
      "verses_count",
    ],
    map: (o) => [
      o.id,
      o.revelation_place,
      o.revelation_order,
      o.bismillah_pre,
      (o.pages || [])[0],
      (o.pages || [])[1],
      o.name_simple,
      o.name_arabic,
      o.verses_count,
    ],
  },
  {
    file: "chapter_infos.ndjson",
    table: "chapter_infos",
    columns: ["chapter_id", "short_text", "source", "language"],
    map: (o) => [
      o.chapter_id || o.id,
      o.short_text || o.text,
      o.source,
      o.language,
    ],
  },
  {
    file: "verses.ndjson",
    table: "verses",
    columns: [
      "id",
      "verse_key",
      "chapter_id",
      "verse_number",
      "juz_number",
      "hizb_number",
      "rub_el_hizb_number",
      "page_number",
      "text_uthmani",
      "text_imlaei_simple",
    ],
    map: (o) => [
      o.id,
      o.verse_key,
      o.chapter_id,
      o.verse_number,
      o.juz_number,
      o.hizb_number,
      o.rub_el_hizb_number,
      o.page_number || o.v1_page,
      o.text_uthmani,
      o.text_imlaei_simple,
    ],
  },
  {
    file: "words.ndjson",
    table: "words",
    columns: [
      "id",
      "verse_id",
      "verse_key",
      "chapter_id",
      "position",
      "line_number",
      "v1_page",
      "v2_page",
      "code_v1",
      "code_v2",
      "text_uthmani",
      "text_imlaei_simple",
      "char_type_name",
    ],
    map: (o) => [
      o.id,
      o.verse_id,
      o.verse_key,
      o.chapter_id,
      o.position,
      o.line_number,
      o.v1_page,
      o.v2_page,
      o.code_v1,
      o.code_v2,
      o.text_uthmani,
      o.text_imlaei_simple,
      o.char_type_name,
    ],
  },
  {
    file: "languages.ndjson",
    table: "languages",
    columns: ["iso_code", "name", "native_name"],
    map: (o) => [o.iso_code || o.iso || o.code, o.name, o.native_name || null],
  },
  {
    file: "translation_resources.ndjson",
    table: "translation_resources",
    columns: ["id", "name", "language", "author_name", "slug"],
    map: (o) => [
      o.id,
      o.name,
      o.language_name || o.language,
      o.author_name,
      o.slug,
    ],
  },
  {
    file: "tafsir_resources.ndjson",
    table: "tafsir_resources",
    columns: ["id", "name", "language", "author_name", "slug"],
    map: (o) => [
      o.id,
      o.name,
      o.language_name || o.language,
      o.author_name,
      o.slug,
    ],
  },
  {
    file: "translations.ndjson",
    table: "translations",
    columns: ["resource_id", "verse_key", "text", "footnotes"],
    map: (o) => [
      o.resource_id,
      o.verse_key || o.aya,
      o.text || o.body || null,
      o.footnotes ? JSON.stringify(o.footnotes) : null,
    ],
  },
  {
    file: "tafsirs.ndjson",
    table: "tafsirs",
    columns: ["resource_id", "verse_key", "text"],
    map: (o) => [o.resource_id, o.verse_key || o.aya, o.text || o.body || null],
  },
  {
    file: "recitations.ndjson",
    table: "recitations",
    columns: [
      "id",
      "reciter_name",
      "style",
      "relative_path",
      "format",
      "files_size",
    ],
    map: (o) => [
      o.id,
      o.reciter_name || o.name,
      o.style,
      o.relative_path,
      o.format,
      o.files_size || null,
    ],
  },
  {
    file: "chapter_audio_files.ndjson",
    table: "chapter_audio_files",
    columns: [
      "id",
      "chapter_id",
      "recitation_id",
      "file_url",
      "duration_seconds",
    ],
    map: (o) => [
      o.id,
      o.chapter_id,
      o.recitation_id,
      o.url || o.audio_url || o.file_url,
      o.duration || o.duration_seconds || null,
    ],
  },
];

function* iterNDJSON(filePath: string) {
  const data = fs.readFileSync(filePath, "utf8");
  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    yield JSON.parse(line);
  }
}

function toCSVRow(values: any[]) {
  return (
    values
      .map((v) => {
        if (v === null || v === undefined) return "";
        let s = String(v);
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      })
      .join(",") + "\n"
  );
}

async function importFile(client: Client, spec: MapSpec) {
  const path = `${outdir}/${spec.file}`;
  if (!fs.existsSync(path)) {
    console.warn(`[skip] ${spec.file} not found`);
    return;
  }
  console.log(`[import] ${spec.file} -> ${spec.table}`);
  await client.query(`TRUNCATE ${spec.table} RESTART IDENTITY CASCADE`);
  const stream = client.query(
    copyFrom(
      `COPY ${spec.table} (${spec.columns.join(
        ","
      )}) FROM STDIN WITH (FORMAT csv)`
    )
  );
  for (const obj of iterNDJSON(path)) {
    const row = spec.map(obj);
    const csv = toCSVRow(row);
    if (!stream.write(csv)) await new Promise((r) => stream.once("drain", r));
  }
  await new Promise((resolve, reject) => stream.end(resolve));
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    for (const m of maps) {
      await importFile(client, m);
    }
    console.log("Import done ✅");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
