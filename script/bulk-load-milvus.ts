import { promisify } from "node:util";
import zlib from "node:zlib";

import { MilvusClient } from "@zilliz/milvus2-sdk-node";

import "../env.ts";
import sql from "../sql.ts";

const zstdDecompress = promisify(zlib.zstdDecompress);

const { MILVUS_ADDR, MILVUS_TOKEN } = process.env;

const BATCH_SIZE = Number.parseInt(process.argv[2] || "500", 10);

function deduplicate(hashList: any[]) {
  const sorted = hashList.sort((a: any, b: any) => a.time - b.time);
  const dedupedHashList: any[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const currentFrame = sorted[i];
    let isDuplicate = false;

    const startIndex = Math.max(0, dedupedHashList.length - 50);
    for (let j = dedupedHashList.length - 1; j >= startIndex; j--) {
      const frame = dedupedHashList[j];
      if (currentFrame.time - frame.time < 2) {
        let exactMatch = true;
        for (let k = 0; k < frame.vector.length; k++) {
          if (frame.vector[k] !== currentFrame.vector[k]) {
            exactMatch = false;
            break;
          }
        }
        if (exactMatch) {
          isDuplicate = true;
          break;
        }
      }
    }
    if (!isDuplicate) dedupedHashList.push(currentFrame);
  }
  return dedupedHashList;
}

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

let totalProcessed = 0;

try {
  while (true) {
    const rows = await sql`
      SELECT
        id,
        path,
        color_layout
      FROM
        files
      WHERE
        loaded IS NULL
        AND media_info IS NOT NULL
        AND scene_changes IS NOT NULL
        AND color_layout IS NOT NULL
        AND anilist_id IN (
          SELECT
            id
          FROM
            anilist
        )
      ORDER BY
        id DESC
      LIMIT
        ${BATCH_SIZE}
    `;

    if (rows.length === 0) {
      console.log("No more pending files to load into Milvus.");
      break;
    }

    const batchData: Array<{ file_id: number; time: number; vector: number[] }> = [];
    const loadedFileIds: number[] = [];

    for (const row of rows) {
      try {
        const decompressed = await zstdDecompress(row.color_layout);
        const hashList = JSON.parse(decompressed.toString());
        const deduped = deduplicate(hashList);

        for (const frame of deduped) {
          batchData.push({
            file_id: row.id,
            time: frame.time,
            vector: frame.vector,
          });
        }
        loadedFileIds.push(row.id);
      } catch (err) {
        console.error(`Failed to process video file ID ${row.id}:`, err);
        await sql`
          UPDATE files
          SET
            loaded = false
          WHERE
            id = ${row.id}
        `;
      }
    }

    const MAX_VECTORS_PER_INSERT = 100000;

    if (loadedFileIds.length > 0 && batchData.length > 0) {
      console.log(
        `Inserting batch of ${loadedFileIds.length} files (${batchData.length} vectors) into Milvus...`,
      );

      try {
        for (let i = 0; i < batchData.length; i += MAX_VECTORS_PER_INSERT) {
          const chunk = batchData.slice(i, i + MAX_VECTORS_PER_INSERT);
          const result = await milvus.insert({
            collection_name: "frame_color_layout",
            data: chunk,
          });
          if (result?.status?.error_code && result.status.error_code !== "Success") {
            throw new Error(
              result.status.reason || result.status.detail || `Milvus error: ${result.status.error_code}`,
            );
          }
        }

        await sql`
          UPDATE files
          SET
            loaded = true
          WHERE
            id IN ${sql(loadedFileIds)}
        `;

        totalProcessed += loadedFileIds.length;
        console.log(
          `Successfully loaded ${loadedFileIds.length} files (total: ${totalProcessed}).`,
        );
      } catch (insertError) {
        console.error(`Failed to insert batch into Milvus:`, insertError);
        await sql`
          UPDATE files
          SET
            loaded = false
          WHERE
            id IN ${sql(loadedFileIds)}
        `;
      }
    }
  }
} finally {
  await milvus.closeConnection();
  await sql.end();
}
