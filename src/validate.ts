import "dotenv/config";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL in .env");
  process.exit(1);
}

async function q(client: Client, sql: string) {
  const r = await client.query(sql);
  return r.rows;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log("== Basic counts ==");
    console.table(
      await q(
        client,
        `
      SELECT 'chapters' AS t, COUNT(*) c FROM chapters UNION ALL
      SELECT 'verses', COUNT(*) FROM verses UNION ALL
      SELECT 'words', COUNT(*) FROM words UNION ALL
      SELECT 'translation_resources', COUNT(*) FROM translation_resources UNION ALL
      SELECT 'tafsir_resources', COUNT(*) FROM tafsir_resources UNION ALL
      SELECT 'translations', COUNT(*) FROM translations UNION ALL
      SELECT 'tafsirs', COUNT(*) FROM tafsirs UNION ALL
      SELECT 'recitations', COUNT(*) FROM recitations UNION ALL
      SELECT 'chapter_audio_files', COUNT(*) FROM chapter_audio_files
      UNION ALL SELECT 'verse_timestamps', COUNT(*) FROM verse_timestamps
      UNION ALL SELECT 'word_segments', COUNT(*) FROM word_segments
    `
      )
    );

    console.log("\n== Chapters verse_count mismatch (should be 0) ==");
    console.table(
      await q(
        client,
        `
      SELECT c.id AS chapter_id, c.verses_count AS expected, COUNT(v.*) AS actual
      FROM chapters c
      LEFT JOIN verses v ON v.chapter_id = c.id
      GROUP BY c.id, c.verses_count
      HAVING COUNT(v.*) <> c.verses_count
      ORDER BY c.id;
    `
      )
    );

    console.log("\n== Verses without words (should be 0 ideally) ==");
    console.table(
      await q(
        client,
        `
      SELECT v.chapter_id, v.verse_number, v.verse_key
      FROM verses v
      LEFT JOIN words w ON w.verse_id = v.id
      WHERE w.id IS NULL
      LIMIT 20;
    `
      )
    );

    console.log(
      "\n== Sample: word positions continuity per verse (first 10 mismatches) =="
    );
    console.table(
      await q(
        client,
        `
      WITH pos AS (
        SELECT verse_key, COUNT(*) AS cnt, MIN(position) AS minp, MAX(position) AS maxp
        FROM words GROUP BY verse_key
      )
      SELECT p.verse_key, p.cnt, p.minp, p.maxp
      FROM pos p
      WHERE NOT (p.minp = 1 AND p.maxp = p.cnt)
      LIMIT 10;
    `
      )
    );

    console.log(
      "\n== Verses yang punya timestamps tapi 0 segmen kata (sekadar sampling) =="
    );
    console.table(
      await q(
        client,
        `
      SELECT vt.verse_key, COUNT(ws.*) AS n_segments
        FROM verse_timestamps vt
        LEFT JOIN word_segments ws USING (audio_file_id, verse_key)
        GROUP BY vt.verse_key
        ORDER BY n_segments ASC
        LIMIT 10;
    `
      )
    );

    console.log("\nValidation done ✅");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
