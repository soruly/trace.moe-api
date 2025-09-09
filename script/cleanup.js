import path from "node:path";
import fs from "node:fs/promises";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import "../env.js";
import sql from "../sql.js";

const { VIDEO_PATH, HASH_PATH, MILVUS_ADDR, MILVUS_TOKEN } = process.env;

console.log("Checking invalid states");
const rows = await sql`
  SELECT
    id,
    path,
    status
  FROM
    files
`;

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

for (const row of rows) {
  if (["ANALYZED", "HASHED", "LOADING", "LOADED"].includes(row.status)) {
    try {
      await fs.access(path.join(HASH_PATH, `${row.path}.json.zst`));
    } catch {
      console.log(`Hash not found: ${row.path}`);
    }
  }
  const mp4FilePath = path.join(VIDEO_PATH, row.path);
  const hashFilePath = path.join(HASH_PATH, `${row.path}.json.zst`);
  try {
    await fs.access(mp4FilePath);
  } catch {
    console.log(`Found ${mp4FilePath} deleted`);

    await milvus.delete({
      collection_name: "frame_color_layout",
      filter: `file_id == ${row.id}`,
    });

    try {
      await fs.access(hashFilePath);
      console.log(`Deleting ${hashFilePath}`);
      await fs.rm(hashFilePath);
    } catch {}
    await sql`
      DELETE FROM files
      WHERE
        path = ${row.path}
    `;
  }
}

await milvus.closeConnection();

await sql.end();

console.log("Completed");
