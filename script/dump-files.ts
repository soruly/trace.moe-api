import fs from "node:fs/promises";
import { promisify } from "node:util";
import zlib from "node:zlib";

import "../env.ts";
import sql from "../sql.ts";

const gzip = promisify(zlib.gzip);

const sinceIdArg = process.argv[2] ?? process.env.SINCE_ID;

if (sinceIdArg === undefined) {
  console.error("Error: Please specify the starting ID (SINCE_ID).");
  console.error("Usage: node script/dump-files.ts <SINCE_ID> [output_file.sql.gz]");
  console.error("Example: node script/dump-files.ts 12345");
  process.exit(1);
}

const sinceId = Number(sinceIdArg);
const outputFile = process.argv[3] ?? process.env.OUTPUT_FILE ?? `${sinceId}.sql.gz`;

try {
  console.log(`Querying production database for files with id > ${sinceId}...`);

  const prodFiles = await sql`
    SELECT
      id,
      anilist_id,
      episode,
      path,
      crc32,
      created::text AS created,
      updated::text AS updated,
      frame_count,
      media_info,
      scene_changes,
      color_layout
    FROM
      files
    WHERE
      id > ${sinceId}
    ORDER BY
      id ASC
  `;

  console.log(`Found ${prodFiles.length} files to export.`);

  if (prodFiles.length === 0) {
    console.log("No new files found.");
    process.exit(0);
  }

  function escapeString(str: string): string {
    return `'${str.replaceAll("'", "''")}'`;
  }

  function formatSqlValue(val: unknown, isJson = false, isBytea = false): string {
    if (val === null || val === undefined) {
      return "NULL";
    }
    if (isBytea && (Buffer.isBuffer(val) || val instanceof Uint8Array)) {
      return `decode('${Buffer.from(val).toString("hex")}', 'hex')`;
    }
    if (isJson) {
      const jsonStr = typeof val === "string" ? val : JSON.stringify(val);
      return `${escapeString(jsonStr)}::jsonb`;
    }
    if (val instanceof Date) {
      return escapeString(val.toISOString());
    }
    if (typeof val === "number" || typeof val === "bigint" || typeof val === "boolean") {
      return String(val);
    }
    if (typeof val === "string") {
      return escapeString(val);
    }
    return escapeString(String(val));
  }

  const lines: string[] = ["-- Exported files dump from files table", "BEGIN;"];

  const BATCH_SIZE = 200;
  for (let i = 0; i < prodFiles.length; i += BATCH_SIZE) {
    const batch = prodFiles.slice(i, i + BATCH_SIZE);
    const valuesSql = batch
      .map((row) => {
        const id = formatSqlValue(row.id);
        const anilistId = formatSqlValue(row.anilist_id);
        const episode = formatSqlValue(row.episode);
        const path = formatSqlValue(row.path);
        const crc32 = formatSqlValue(row.crc32);
        const loaded = "NULL"; // Force loaded to NULL for local env
        const created = formatSqlValue(row.created);
        const updated = formatSqlValue(row.updated);
        const frameCount = formatSqlValue(row.frame_count);
        const mediaInfo = formatSqlValue(row.media_info, true);
        const sceneChanges = formatSqlValue(row.scene_changes, true);
        const colorLayout = formatSqlValue(row.color_layout, false, true);

        return `(${id}, ${anilistId}, ${episode}, ${path}, ${crc32}, ${loaded}, ${created}, ${updated}, ${frameCount}, ${mediaInfo}, ${sceneChanges}, ${colorLayout})`;
      })
      .join(",\n");

    lines.push(
      `INSERT INTO files (id, anilist_id, episode, path, crc32, loaded, created, updated, frame_count, media_info, scene_changes, color_layout) VALUES\n${valuesSql}\nON CONFLICT (id) DO NOTHING;`,
    );
  }

  lines.push("SELECT setval('files_id_seq', (SELECT MAX(id) FROM files));");
  lines.push("COMMIT;");

  const sqlContent = lines.join("\n\n") + "\n";
  const compressed = await gzip(sqlContent);

  await fs.writeFile(outputFile, compressed);
  console.log(`Successfully generated ${outputFile} (${prodFiles.length} records exported).`);
} catch (err) {
  console.error("Export failed:", err);
} finally {
  await sql.end();
}
