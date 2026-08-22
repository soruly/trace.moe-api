import fs from "node:fs/promises";
import path from "node:path";

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

    try {
      const result = await milvus.delete({
        collection_name: "frame_color_layout",
        filter: `file_id == ${row.id}`,
      });
      if (result?.status?.error_code && result.status.error_code !== "Success") {
        throw new Error(
          result.status.reason ||
            result.status.detail ||
            `Milvus error: ${result.status.error_code}`,
        );
      }

      await sql`
        DELETE FROM files
        WHERE
          id = ${row.id}
      `;
    } catch (milvusErr) {
      console.error(`Failed to delete vectors for file ID ${row.id} from Milvus:`, milvusErr);
    }
  }
}

await milvus.closeConnection();

await sql.end();

console.log("Completed");
