import path from "node:path";
import fs from "node:fs/promises";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import "../env.ts";
import sql from "../sql.ts";

const { VIDEO_PATH, MILVUS_ADDR, MILVUS_TOKEN } = process.env;

console.log("Removing deleted video files from database");

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

const rows = await sql`
  SELECT
    id,
    path
  FROM
    files
`;

for (const row of rows) {
  try {
    await fs.access(path.join(VIDEO_PATH, row.path));
  } catch {
    console.log(row.path);

    await milvus.delete({
      collection_name: "frame_color_layout",
      filter: `file_id == ${row.id}`,
    });

    await sql`
      DELETE FROM files
      WHERE
        id = ${row.id}
    `;
  }
}

await milvus.closeConnection();

await sql.end();

console.log("Completed");
